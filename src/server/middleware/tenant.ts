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

// Admin database (shared across all tenants). The app connects as the
// service role barber_app — never the postgres superuser.
const adminDbPool = new Pool({
  host: process.env.VITE_LOKI_HOST || '100.84.100.96',
  port: parseInt(process.env.VITE_LOKI_PORT || '5432'),
  database: 'barber_app',
  user: process.env.VITE_LOKI_USER || 'barber_app',
  password: process.env.VITE_LOKI_PASSWORD,
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

  // Create new pool for tenant
  const dbName = `foundation_barber_${tenantId}`;
  const pool = new Pool({
    host: process.env.VITE_LOKI_HOST || '100.84.100.96',
    port: parseInt(process.env.VITE_LOKI_PORT || '5432'),
    database: dbName,
    user: process.env.VITE_LOKI_USER || 'barber_app',
    password: process.env.VITE_LOKI_PASSWORD,
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

export async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Attach admin DB
    req.adminDb = adminDbPool;

    // Admin authentication: requests marked with `x-admin-role: true` must
    // carry `Authorization: Bearer <ADMIN_API_KEY>`. The key is a real server
    // credential from the environment — never a cookie, never a client-chosen
    // value. Fail closed: if ADMIN_API_KEY is unset, admin access is disabled
    // entirely. Comparison is constant-time (timingSafeEqual) on equal-length
    // buffers; a length mismatch fails immediately without leaking timing.
    if (req.headers['x-admin-role'] === 'true') {
      const adminKey = process.env.ADMIN_API_KEY;
      if (!adminKey) {
        return res.status(401).json({
          error: 'Admin access disabled',
          hint: 'Set ADMIN_API_KEY in the server environment to enable admin access',
        });
      }
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Admin authentication required' });
      }
      const provided = Buffer.from(authHeader.slice(7));
      const expected = Buffer.from(adminKey);
      if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }
      // Admin context - no specific tenant, has access to all. userId is
      // deliberately NOT taken from any client header.
      req.tenant = {
        companyId: 'admin',
        companyName: 'Admin',
        tier: 'enterprise',
        isAdmin: true,
        pool: adminDbPool,
      };
      return next();
    }

    // Check for API key (barber company authentication) OR a user session JWT
    // issued by /api/auth/login|signup. These share the same Bearer header, so
    // JWT verification is attempted first (cheap, local, no DB round-trip) —
    // company API keys are opaque random strings and will always fail
    // jwt.verify, so there is no ambiguity/collision between the two modes.
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);

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
        return next();
      } catch (jwtErr) {
        // Not a valid JWT (or expired) — fall through to company API-key check.
      }

      const apiKey = token;

      try {
        const result = await adminDbPool.query(
          'SELECT * FROM barber.get_company_by_api_key(api_key_ => $1, status_ => $2)',
          [apiKey, 'active']
        );

        if (result.rows.length === 0) {
          return res.status(401).json({ error: 'Invalid or expired API key' });
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

        // Log API usage
        await adminDbPool.query(
          'SELECT * FROM barber.log_api_key_usage(company_id_ => $1, endpoint_ => $2, method_ => $3, status_code_ => $4)',
          [company.id, req.path, req.method, 200]
        ).catch(console.error); // Don't block on logging error

        return next();
      } catch (err) {
        console.error('API key validation error:', err);
        return res.status(500).json({ error: 'Authentication failed' });
      }
    }

    // Anonymous tenant context for public discovery (guest browse). The
    // x-session-token header ("<tenantId>:guest") ONLY selects a tenant DB —
    // it carries NO identity. userId is left undefined and x-user-id is
    // ignored entirely: identity comes exclusively from the JWT path above.
    const customerSession = req.headers['x-session-token'] as string;
    if (customerSession) {
      const parts = customerSession.split(':');
      if (parts.length === 2 && /^[1-9]\d*$/.test(parts[0])) {
        const tenantId = parts[0];
        const pool = await getTenantPool(tenantId);

        req.tenant = {
          companyId: tenantId,
          companyName: `Company ${tenantId}`,
          tier: 'starter',
          isAdmin: false,
          pool,
        };
        return next();
      }
    }

    // No valid authentication found
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
