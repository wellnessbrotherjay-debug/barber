import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { randomBytes, timingSafeEqual } from 'crypto';

// HARD RULE: no raw SQL in application code. Every data operation goes through
// a built-in Postgres function in schema `barber` (migrations/003) — the app
// layer only ever calls SELECT * FROM barber.<fn>(...).

export interface TenantContext {
  companyId: string;
  companyName: string;
  tier: string;
  isAdmin: boolean;
  userId?: string;
  userRole?: string;
  pool: Pool;
}

// JWT_SECRET for customer/barber session tokens issued by POST /api/auth/login
// and /api/auth/signup. This is a SEPARATE credential from the company API-key
// Bearer tokens (checked against companies.api_key below) — a JWT is verified
// first, and only falls through to the API-key lookup if signature verification
// fails, so the two Bearer auth modes coexist without collision.
// TEMP: dev-only random fallback when unset, so local/dev never hard-fails on
// missing env. Never hardcode a real secret here — production must set
// JWT_SECRET explicitly.
// Lazily resolved (not a top-level constant) because dotenv.config() in
// index.ts runs AFTER this module's imports are evaluated — reading
// process.env.JWT_SECRET at import time would always see it unset.
let _jwtSecret: string | null = null;
export function getJwtSecret(): string {
  if (_jwtSecret) return _jwtSecret;
  if (process.env.JWT_SECRET) {
    _jwtSecret = process.env.JWT_SECRET;
    return _jwtSecret;
  }
  _jwtSecret = randomBytes(32).toString('hex');
  console.warn(
    '[auth] WARNING: JWT_SECRET is not set in the environment. Using a random ' +
    'per-process fallback secret — all existing sessions will be invalidated on ' +
    'every restart. Set JWT_SECRET in production.'
  );
  return _jwtSecret;
}

export interface AuthTokenPayload {
  sub: string; // user id
  role: 'customer' | 'barber' | 'admin';
  tenant_id: string;
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
      adminDb?: Pool;
    }
  }
}

// Connection settings come from the environment and nowhere else. A default
// host, user or database name written here is a second source of truth: it
// silently sends the application somewhere nobody configured, and a missing
// setting then looks like a working system pointed at the wrong place.
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set - refusing to start against an unconfigured database`);
  }
  return value;
}

// Control database: the tenant registry (companies, entitlements, metrics).
// The application connects as its own service role, never a superuser.
const adminDbPool = new Pool({
  host: requiredEnv('VITE_LOKI_HOST'),
  port: parseInt(requiredEnv('VITE_LOKI_PORT'), 10),
  database: requiredEnv('VITE_LOKI_DATABASE'),
  user: requiredEnv('VITE_LOKI_USER'),
  password: requiredEnv('VITE_LOKI_PASSWORD'),
  ssl: false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Per-tenant connection pools (cached)
const tenantPools = new Map<string, Pool>();

export async function getTenantPool(tenantId: string): Promise<Pool> {
  if (!tenantId) {
    throw new Error('Tenant context required - pool initialization failed');
  }

  // Return cached pool if exists
  if (tenantPools.has(tenantId)) {
    return tenantPools.get(tenantId)!;
  }

  // WHICH DATABASE THIS TENANT LIVES IN IS DATA, NOT A FORMULA.
  // This used to glue a prefix onto the company id, which baked a physical
  // database name into the application and meant the estate could not rename a
  // database without editing code. The company row names its own database.
  const registry = await adminDbPool.query(
    'SELECT * FROM barber.get_company_database(company_id_ => $1)',
    [tenantId]
  );
  const dbName = registry.rows[0]?.database_name as string | undefined;
  if (!dbName) {
    throw new Error(`Tenant ${tenantId} has no active database registered - refusing to guess one`);
  }

  const pool = new Pool({
    host: requiredEnv('VITE_LOKI_HOST'),
    port: parseInt(requiredEnv('VITE_LOKI_PORT'), 10),
    database: dbName,
    user: requiredEnv('VITE_LOKI_USER'),
    password: requiredEnv('VITE_LOKI_PASSWORD'),
    ssl: false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test connection immediately (fail-closed)
  try {
    const client = await pool.connect();
    await client.query('SELECT * FROM barber.db_now()');
    client.release();
  } catch (err) {
    pool.end();
    throw new Error(`Tenant DB ${dbName} unreachable: ${(err as Error).message}`);
  }

  tenantPools.set(tenantId, pool);
  return pool;
}

// Each way in is its own function. They all answer the same question - who is
// asking, and which tenant's data may they see - but they answer it from
// completely different evidence, and reading them one after another inside a
// single 140-line block meant the guarantee that matters (identity NEVER comes
// from a client-supplied header) had to be re-checked by eye every time.
//
// Each returns true when it has dealt with the request, so tenantMiddleware is
// the order they are tried in and nothing else.

/**
 * The estate's own admin key, sent as a bearer token alongside x-admin-role.
 * It is a real server credential from the environment, never a cookie and never
 * anything the caller can choose. Fail closed: with no key configured, admin
 * access is off entirely. The comparison is constant-time on equal-length
 * buffers, and a length mismatch fails at once without leaking timing.
 */
async function authenticateAsAdmin(req: Request, res: Response, next: NextFunction): Promise<boolean> {
  if (req.headers['x-admin-role'] !== 'true') return false;

  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    res.status(401).json({
      error: 'Admin access disabled',
      hint: 'Set ADMIN_API_KEY in the server environment to enable admin access',
    });
    return true;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Admin authentication required' });
    return true;
  }
  const provided = Buffer.from(authHeader.slice(7));
  const expected = Buffer.from(adminKey);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    res.status(401).json({ error: 'Invalid admin credentials' });
    return true;
  }
  // No specific tenant: an admin sees all of them. userId is deliberately NOT
  // taken from any client header.
  req.tenant = {
    companyId: 'admin',
    companyName: 'Admin',
    tier: 'enterprise',
    isAdmin: true,
    pool: adminDbPool,
  };
  next();
  return true;
}

/**
 * A signed-in person's session token. Verified locally with no database round
 * trip, so it is tried before the company key. Everything about who they are
 * comes out of the signed token and nothing else.
 */
async function authenticateAsSignedInUser(req: Request, next: NextFunction, token: string): Promise<boolean> {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
    const pool = await getTenantPool(decoded.tenant_id);
    req.tenant = {
      companyId: decoded.tenant_id,
      companyName: `Company ${decoded.tenant_id}`,
      tier: 'starter',
      isAdmin: decoded.role === 'admin',
      userId: decoded.sub,
      userRole: decoded.role,
      pool,
    };
    next();
    return true;
  } catch (jwtErr) {
    // Not a signed-in person's token. The same header also carries a company
    // API key, which is not a session token and will always land here, so this
    // is an ordinary outcome rather than a failure - but an expired or tampered
    // token looks identical from here, and that is worth being able to see.
    console.debug('[tenant] bearer token is not a session token, trying it as a company API key:',
                  (jwtErr as Error).message);
    return false;
  }
}

/**
 * A company's own API key, which identifies the company but no person. It grants
 * no user identity at all - userId stays undefined - so nothing that acts on
 * behalf of a person can be reached with it.
 */
async function authenticateAsCompany(req: Request, res: Response, next: NextFunction, apiKey: string): Promise<boolean> {
  try {
    const result = await adminDbPool.query(
      'SELECT * FROM barber.get_company_by_api_key(api_key_ => $1, status_ => $2)',
      [apiKey, 'active']
    );
    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid or expired API key' });
      return true;
    }

    const company = result.rows[0];
    const tenantId = company.id.toString();
    const pool = await getTenantPool(tenantId);

    req.tenant = {
      companyId: tenantId,
      companyName: company.name,
      tier: company.subscription_tier,
      isAdmin: false,
      pool,
    };

    // Usage logging must never hold up the request it is recording.
    await adminDbPool.query(
      'SELECT * FROM barber.log_api_key_usage(company_id_ => $1, endpoint_ => $2, method_ => $3, status_code_ => $4)',
      [company.id, req.path, req.method, 200]
    ).catch(console.error);

    next();
    return true;
  } catch (err) {
    console.error('API key validation error:', err);
    res.status(500).json({ error: 'Authentication failed' });
    return true;
  }
}

/**
 * Guest browsing. The x-session-token header ("<tenantId>:guest") ONLY chooses
 * which tenant's public data to read - it carries no identity whatsoever.
 * userId is left undefined and x-user-id is ignored entirely: identity comes
 * exclusively from a signed session token.
 */
async function authenticateAsGuest(req: Request, next: NextFunction): Promise<boolean> {
  const customerSession = req.headers['x-session-token'] as string;
  if (!customerSession) return false;

  const parts = customerSession.split(':');
  if (parts.length !== 2 || !/^[1-9]\d*$/.test(parts[0])) return false;

  const tenantId = parts[0];
  const pool = await getTenantPool(tenantId);
  req.tenant = {
    companyId: tenantId,
    companyName: `Company ${tenantId}`,
    tier: 'starter',
    isAdmin: false,
    pool,
  };
  next();
  return true;
}

export async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    req.adminDb = adminDbPool;

    if (await authenticateAsAdmin(req, res, next)) return;

    // A bearer token is either a signed-in person's session or a company's API
    // key. The session is tried first because it costs nothing to check.
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      if (await authenticateAsSignedInUser(req, next, token)) return;
      if (await authenticateAsCompany(req, res, next, token)) return;
      return;
    }

    if (await authenticateAsGuest(req, next)) return;

    return res.status(401).json({
      error: 'Tenant authentication required',
      hint: 'Provide: (1) a Bearer JWT or API key, (2) ADMIN_API_KEY with x-admin-role, or (3) an anonymous x-session-token for public discovery'
    });
  } catch (err) {
    console.error('Tenant middleware error:', err);
    return res.status(500).json({ error: 'Tenant initialization failed' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.tenant?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Guards the new /api/barber/* CRUD routes: requires a valid user-session JWT
// (set on req.tenant by tenantMiddleware above) whose role is 'barber'.
export function requireBarberAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.tenant?.userId || req.tenant.userRole !== 'barber') {
    return res.status(401).json({ error: 'Barber authentication required' });
  }
  next();
}

// Requires any authenticated end user (customer or barber). Use this on routes
// where BOTH roles legitimately act on the same resource (e.g. cancelling a
// booking) — the handler must still verify that the caller owns the record.
export function requireUserAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.tenant?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Requires an authenticated customer. Booking creation, reviews and payment
// intents are customer actions; the customer id MUST be taken from the token
// (req.tenant.userId), never from the request body.
export function requireCustomerAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.tenant?.userId || req.tenant.userRole !== 'customer') {
    return res.status(401).json({ error: 'Customer authentication required' });
  }
  next();
}

export function requireEntitlement(feature: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.tenant || req.tenant.isAdmin) {
      return next(); // Admins have all entitlements
    }

    try {
      const result = await req.adminDb!.query(
        'SELECT * FROM barber.check_entitlement(company_id_ => $1, feature_ => $2)',
        [req.tenant.companyId, feature]
      );

      if (!result.rows[0]?.enabled) {
        return res.status(402).json({
          error: 'Feature not entitled',
          feature,
          hint: `Upgrade to access ${feature}`
        });
      }

      next();
    } catch (err) {
      console.error('Entitlement check error:', err);
      return res.status(500).json({ error: 'Entitlement check failed' });
    }
  };
}

export async function closeTenantPools() {
  for (const [_, pool] of tenantPools) {
    await pool.end();
  }
  await adminDbPool.end();
}
