import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

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

// Admin database (shared across all tenants)
const adminDbPool = new Pool({
  host: process.env.VITE_LOKI_HOST || '100.84.100.96',
  port: parseInt(process.env.VITE_LOKI_PORT || '5432'),
  database: 'barber_app',
  user: process.env.VITE_LOKI_USER || 'postgres',
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
    user: process.env.VITE_LOKI_USER || 'postgres',
    password: process.env.VITE_LOKI_PASSWORD,
    ssl: false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test connection immediately (fail-closed)
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
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

    // Check for admin SSO (auth cookie with admin role). This must never
    // shadow a real Bearer token (JWT customer/barber session, or company
    // API key) — a stray leftover admin cookie in the browser would
    // otherwise silently break every authenticated request forever. Only
    // consider the admin-cookie path when no Bearer header is present at
    // all, and require the explicit x-admin-role header rather than a loose
    // substring match on the cookie value (e.g. "admin-owner" trivially
    // contains "admin" and is not a real credential check).
    const sessionCookie = req.cookies?.session;
    const hasBearerAuth = !!req.headers.authorization?.startsWith('Bearer ');
    if (sessionCookie && !hasBearerAuth) {
      const isAdmin = req.headers['x-admin-role'] === 'true';

      if (isAdmin) {
        // Admin context - no specific tenant, has access to all
        req.tenant = {
          companyId: 'admin',
          companyName: 'Admin',
          tier: 'enterprise',
          isAdmin: true,
          userId: req.headers['x-user-id'] as string,
          pool: adminDbPool,
        };
        return next();
      }
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
          'SELECT id, name, subscription_tier FROM companies WHERE api_key = $1 AND status = $2',
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
          `INSERT INTO api_key_usage (company_id, endpoint, method, status_code, timestamp)
           VALUES ($1, $2, $3, $4, NOW())`,
          [company.id, req.path, req.method, 200]
        ).catch(console.error); // Don't block on logging error

        return next();
      } catch (err) {
        console.error('API key validation error:', err);
        return res.status(500).json({ error: 'Authentication failed' });
      }
    }

    // Check for customer session (per-tenant session token)
    const customerSession = req.headers['x-session-token'] as string;
    if (customerSession) {
      const parts = customerSession.split(':');
      if (parts.length === 2) {
        const [tenantId, sessionId] = parts;
        const pool = await getTenantPool(tenantId);

        req.tenant = {
          companyId: tenantId,
          companyName: `Company ${tenantId}`,
          tier: 'starter',
          isAdmin: false,
          userId: req.headers['x-user-id'] as string,
          pool,
        };
        return next();
      }
    }

    // No valid authentication found
    return res.status(401).json({
      error: 'Tenant authentication required',
      hint: 'Provide: (1) admin session cookie, (2) API key header, or (3) customer session token'
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

export function requireEntitlement(feature: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.tenant || req.tenant.isAdmin) {
      return next(); // Admins have all entitlements
    }

    try {
      const result = await req.adminDb!.query(
        `SELECT enabled FROM company_entitlements
         WHERE company_id = $1 AND feature = $2`,
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
