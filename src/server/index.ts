import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import path from 'path';
import fsp from 'fs/promises';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import { tenantMiddleware, requireAdmin, requireEntitlement, requireBarberAuth, requireUserAuth, requireCustomerAuth, closeTenantPools, getTenantPool, getJwtSecret, AuthTokenPayload } from './middleware/tenant';
import { createUploadsRouter, UPLOAD_DIR } from './routes/uploads';
import { sendEmail } from './mailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, '../../dist');

// Load environment variables
dotenv.config({ path: '.env.local' });

const app: Express = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://barber.safetykat.com',
    'https://api.barber.safetykat.com',
    // Native shells. Capacitor serves the bundled app from a custom scheme, so
    // requests to this API are cross-origin and must be allowlisted explicitly:
    // iOS uses capacitor://localhost, Android http://localhost, and older
    // Ionic/WKWebView builds ionic://localhost.
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost'
  ],
  credentials: true,
  // PATCH is required by /api/barber/online and /api/barber/photos/reorder.
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-ID', 'X-Admin-Role', 'X-Session-Token']
}));
// Stripe client — only initialized if a secret key is present in this
// environment. Until the client provides real keys, this stays null and
// every payments route responds with a clean 501 instead of crashing.
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

// Stripe webhook needs the raw request body (unparsed) to verify the
// signature, so this route is registered BEFORE the global express.json()
// middleware and uses its own express.raw() body parser.
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return res.status(501).json({ error: 'Stripe not configured for this environment yet' });
  }

  const signature = req.headers['stripe-signature'];
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature as string, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', (err as Error).message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${(err as Error).message}` });
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const bookingId = intent.metadata?.booking_id;
      const tenantId = intent.metadata?.tenant_id;

      if (!bookingId || !tenantId) {
        console.error('Stripe webhook: payment_intent.succeeded missing booking_id/tenant_id metadata', intent.id);
        return res.status(200).json({ received: true, warning: 'missing metadata, no booking updated' });
      }

      const pool = await getTenantPool(tenantId);
      const result = await pool.query(
        `UPDATE bookings SET payment_status = 'paid' WHERE id = $1 RETURNING id`,
        [bookingId]
      );

      if (result.rows.length === 0) {
        console.error(`Stripe webhook: booking ${bookingId} not found in tenant ${tenantId}`);
      } else {
        console.log(`Stripe webhook: booking ${bookingId} (tenant ${tenantId}) marked paid via ${intent.id}`);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

app.use(express.json());
app.use(cookieParser());

// Serve the built frontend directly (Apache proxies everything to this app —
// no separate static web server). Must run before tenantMiddleware so asset
// and SPA-shell requests never require tenant auth.
app.use(express.static(DIST_DIR));

// Barber-uploaded images. Read-only public serving of the upload directory —
// all WRITES go through the authenticated, ownership-checked uploads router
// below; nothing here can create or overwrite a file.
app.use('/uploads', express.static(UPLOAD_DIR, { fallthrough: true, maxAge: '7d' }));

app.get(/^(?!\/(api|admin|health)).*/, (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'GET' || !req.accepts('html')) return next();
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// ============================================================================
// AUTH ROUTES (real signup/login — registered BEFORE tenantMiddleware since
// there is no tenant credential yet at this point in the request lifecycle;
// tenant_id comes from the request body instead, defaulting to 1)
// ============================================================================

const BCRYPT_ROUNDS = 12;

function issueToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '30d' });
}

// POST /api/auth/signup — creates a real user row (bcrypt-hashed password) in
// the tenant's own DB. role='barber' also creates a barrber_profiles row.
// TEMP: single-tenant demo mode — tenant_id defaults to 1 (foundation_barber_1)
// since that's the only real company/tenant in production right now. Same
// stopgap pattern as the rest of this codebase's single-tenant assumptions.
app.post('/api/auth/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, full_name, role, tenant_id } = req.body || {};

    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ error: 'email, password, full_name, and role are required' });
    }
    if (!['customer', 'barber'].includes(role)) {
      return res.status(400).json({ error: "role must be 'customer' or 'barber'" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const tenantId = String(tenant_id || 1); // TEMP: single-tenant demo mode
    const pool = await getTenantPool(tenantId);

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [String(email).toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);

    const userResult = await pool.query(
      `INSERT INTO users (email, full_name, role, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role, avatar_url, phone, created_at`,
      [String(email).toLowerCase(), full_name, role, passwordHash]
    );
    const user = userResult.rows[0];

    let barberStatus: { onboarding_completed: boolean; is_verified: boolean } | undefined;
    if (role === 'barber') {
      await pool.query(
        `INSERT INTO barber_profiles (user_id, display_name, is_verified, is_approved, onboarding_completed)
         VALUES ($1, $2, false, false, false)`,
        [user.id, full_name]
      );
      barberStatus = { onboarding_completed: false, is_verified: false };
    }

    const token = issueToken({ sub: user.id, role, tenant_id: tenantId });
    res.status(201).json({ token, user: { ...user, tenant_id: tenantId, ...barberStatus } });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password, tenant_id } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const tenantId = String(tenant_id || 1); // TEMP: single-tenant demo mode
    const pool = await getTenantPool(tenantId);

    const result = await pool.query(
      `SELECT id, email, full_name, role, avatar_url, phone, password_hash
       FROM users WHERE email = $1 AND is_active = true`,
      [String(email).toLowerCase()]
    );

    if (result.rows.length === 0 || !result.rows[0].password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(String(password), user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    delete user.password_hash;

    let barberStatus: { onboarding_completed: boolean; is_verified: boolean } | undefined;
    if (user.role === 'barber') {
      const bp = await pool.query(
        'SELECT onboarding_completed, is_verified FROM barber_profiles WHERE user_id = $1',
        [user.id]
      );
      if (bp.rows[0]) {
        barberStatus = {
          onboarding_completed: !!bp.rows[0].onboarding_completed,
          is_verified: !!bp.rows[0].is_verified,
        };
      }
    }

    const token = issueToken({ sub: user.id, role: user.role, tenant_id: tenantId });
    res.json({ token, user: { ...user, tenant_id: tenantId, ...barberStatus } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Health check — must sit ABOVE tenantMiddleware so uptime monitors and the
// reverse proxy can probe it without credentials.
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Tenant routing middleware (must be before API routes)
app.use(tenantMiddleware);

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} (tenant: ${req.tenant?.companyId || 'unknown'})`);
  next();
});

// Barber image uploads (avatar + work gallery). Mounted after tenantMiddleware
// so req.tenant is populated; every route inside is requireBarberAuth-guarded
// and resolves the owning barber server-side from the JWT.
app.use(createUploadsRouter(requireBarberAuth));

// Database connection test
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    if (!req.tenant) {
      return res.status(401).json({ status: 'error', message: 'Tenant context required' });
    }

    const result = await req.tenant.pool.query('SELECT NOW()');
    res.json({
      status: 'ok',
      database: 'connected',
      tenant: req.tenant.companyId,
      timestamp: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: (error as Error).message
    });
  }
});

// ============================================================================
// ADMIN ROUTES (Owner Dashboard - All Companies & Bookings)
// ============================================================================

// GET /admin - Admin dashboard data
//
// booking_metrics is a pre-aggregated rollup table that nothing in this codebase
// writes to, so it is always empty and the old revenue chart always looked broken.
// Real booking/revenue data lives per-tenant in each company's own database
// (foundation_barber_<id> — see getTenantPool in middleware/tenant.ts). This
// iterates every active company's tenant DB and computes real numbers on the fly.
app.get('/admin/dashboard', requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminDb = req.adminDb!;

    const stats = await adminDb.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active_companies,
        COUNT(*) FILTER (WHERE status = 'suspended') as suspended_companies,
        COUNT(*) as total_companies,
        SUM(CAST(max_barbers AS BIGINT)) as total_max_barbers
      FROM companies
    `);

    const companiesResult = await adminDb.query(
      `SELECT id, name FROM companies WHERE status = 'active' ORDER BY id`
    );

    const revenueByDate = new Map<string, { date: string; revenue: number; bookings: number }>();
    let totalBookings = 0;
    let totalRevenue = 0;

    for (const company of companiesResult.rows) {
      try {
        const pool = await getTenantPool(company.id.toString());
        const dailyResult = await pool.query(`
          SELECT
            booking_date::text as date,
            COUNT(*) as bookings,
            COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0) as revenue
          FROM bookings
          WHERE booking_date >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY booking_date
        `);

        for (const row of dailyResult.rows) {
          const existing = revenueByDate.get(row.date) || { date: row.date, revenue: 0, bookings: 0 };
          existing.revenue += Number(row.revenue);
          existing.bookings += Number(row.bookings);
          revenueByDate.set(row.date, existing);
        }

        const totalsResult = await pool.query(`
          SELECT
            COUNT(*) as booking_count,
            COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0) as paid_revenue
          FROM bookings
        `);
        totalBookings += Number(totalsResult.rows[0].booking_count);
        totalRevenue += Number(totalsResult.rows[0].paid_revenue);
      } catch (err) {
        console.error(`Dashboard: failed to query tenant DB for company ${company.id}:`, (err as Error).message);
      }
    }

    const revenue = Array.from(revenueByDate.values()).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      stats: {
        ...stats.rows[0],
        total_bookings: totalBookings,
        total_revenue: totalRevenue,
      },
      revenue,
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /admin/companies - List all companies
app.get('/admin/companies', requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminDb = req.adminDb!;
    const result = await adminDb.query(`
      SELECT
        c.id,
        c.name,
        c.owner_email,
        c.subscription_tier,
        c.status,
        c.max_barbers,
        s.renewal_date,
        COUNT(DISTINCT u.company_id) as api_usage_count
      FROM companies c
      LEFT JOIN company_subscriptions s ON c.id = s.company_id
      LEFT JOIN api_key_usage u ON c.id = u.company_id AND u.timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY c.id, s.renewal_date
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /admin/companies - Create new company
app.post('/admin/companies', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, owner_email, subscription_tier = 'starter', max_barbers = 10 } = req.body;

    if (!name || !owner_email) {
      return res.status(400).json({ error: 'Name and email required' });
    }

    const adminDb = req.adminDb!;

    const result = await adminDb.query(`
      INSERT INTO companies (name, owner_email, subscription_tier, max_barbers)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, owner_email, api_key, subscription_tier
    `, [name, owner_email, subscription_tier, max_barbers]);

    const company = result.rows[0];

    // Add default entitlements based on tier
    const features = subscription_tier === 'starter'
      ? ['basic_booking', 'basic_reviews']
      : subscription_tier === 'pro'
      ? ['basic_booking', 'basic_reviews', 'custom_branding', 'api_access', 'advanced_reports', 'team_management']
      : ['basic_booking', 'basic_reviews', 'custom_branding', 'api_access', 'advanced_reports', 'team_management', 'sso_integration'];

    for (const feature of features) {
      await adminDb.query(
        'INSERT INTO company_entitlements (company_id, feature, enabled) VALUES ($1, $2, true)',
        [company.id, feature]
      );
    }

    res.status(201).json({
      ...company,
      message: `Company created. API key: ${company.api_key}`
    });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error('Error creating company:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /admin/companies/:id - Company details
app.get('/admin/companies/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminDb = req.adminDb!;

    const result = await adminDb.query(`
      SELECT
        c.*,
        s.renewal_date,
        s.status as subscription_status,
        COUNT(DISTINCT aku.company_id) as api_calls_24h
      FROM companies c
      LEFT JOIN company_subscriptions s ON c.id = s.company_id
      LEFT JOIN api_key_usage aku ON c.id = aku.company_id AND aku.timestamp > NOW() - INTERVAL '24 hours'
      WHERE c.id = $1
      GROUP BY c.id, s.renewal_date, s.status
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// PATCH /admin/companies/:id/status - Suspend / reactivate a company
app.patch('/admin/companies/:id/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (status !== 'active' && status !== 'suspended') {
      return res.status(400).json({ error: "status must be 'active' or 'suspended'" });
    }

    const adminDb = req.adminDb!;
    const result = await adminDb.query(
      `UPDATE companies SET status = $1 WHERE id = $2
       RETURNING id, name, owner_email, subscription_tier, status, max_barbers, created_at`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating company status:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /admin/companies/:id/bookings - Real bookings for ONE company, pulled
// straight from that company's own tenant database (foundation_barber_<id>).
app.get('/admin/companies/:id/bookings', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminDb = req.adminDb!;

    const companyResult = await adminDb.query('SELECT id, name FROM companies WHERE id = $1', [id]);
    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const pool = await getTenantPool(id);
    const result = await pool.query(`
      SELECT
        b.id,
        b.booking_reference,
        b.booking_date,
        b.start_time,
        b.end_time,
        b.status,
        b.payment_status,
        b.total_amount,
        b.currency,
        b.created_at,
        json_build_object(
          'id', bp.id,
          'display_name', bp.display_name,
          'shop_name', bp.shop_name
        ) as barber,
        json_build_object(
          'id', s.id,
          'name', s.name,
          'price', s.price,
          'duration_minutes', s.duration_minutes
        ) as service
      FROM bookings b
      JOIN barber_profiles bp ON b.barber_id = bp.id
      JOIN services s ON b.service_id = s.id
      ORDER BY b.created_at DESC
      LIMIT 50
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching company bookings:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /admin/companies/:id/barbers - Full barber roster for ONE company, pulled
// from that company's own tenant database (foundation_barber_<id>). This is the
// "profile / verification / onboarding" data — is_verified is the verification flag.
app.get('/admin/companies/:id/barbers', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminDb = req.adminDb!;

    const companyResult = await adminDb.query('SELECT id, name FROM companies WHERE id = $1', [id]);
    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const pool = await getTenantPool(id);
    const result = await pool.query(`
      SELECT
        bp.id,
        bp.display_name,
        bp.bio,
        bp.experience_years,
        bp.rating_avg,
        bp.rating_count,
        bp.shop_name,
        bp.address_text,
        bp.is_verified,
        bp.is_approved,
        bp.is_active,
        bp.onboarding_completed,
        bp.created_at,
        u.email,
        u.full_name,
        u.phone,
        u.avatar_url,
        u.is_active as user_is_active
      FROM barber_profiles bp
      JOIN users u ON bp.user_id = u.id
      ORDER BY bp.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching company barbers:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /admin/companies/:id/barbers/:barberId - Deep dive on one barber: profile,
// services, schedule/availability, recent bookings, reviews, summary stats.
app.get('/admin/companies/:id/barbers/:barberId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id, barberId } = req.params;
    const adminDb = req.adminDb!;

    const companyResult = await adminDb.query('SELECT id, name FROM companies WHERE id = $1', [id]);
    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const pool = await getTenantPool(id);

    const profileResult = await pool.query(`
      SELECT
        bp.id, bp.display_name, bp.bio, bp.experience_years, bp.rating_avg, bp.rating_count,
        bp.shop_name, bp.address_text, bp.latitude, bp.longitude,
        bp.is_verified, bp.is_approved, bp.is_active, bp.created_at, bp.updated_at,
        u.id as user_id, u.email, u.full_name, u.phone, u.avatar_url, u.is_active as user_is_active
      FROM barber_profiles bp
      JOIN users u ON bp.user_id = u.id
      WHERE bp.id = $1
    `, [barberId]);

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Barber not found' });
    }

    const [servicesResult, scheduleResult, bookingsResult, reviewsResult, statsResult] = await Promise.all([
      pool.query(
        `SELECT id, name, description, price, currency, duration_minutes, is_active, created_at
         FROM services WHERE barber_id = $1 ORDER BY price ASC`,
        [barberId]
      ),
      pool.query(
        `SELECT id, day_of_week, start_time, end_time, is_available
         FROM barber_schedule WHERE barber_id = $1 ORDER BY day_of_week ASC, start_time ASC`,
        [barberId]
      ),
      pool.query(
        `SELECT b.id, b.booking_reference, b.booking_date, b.start_time, b.end_time,
                b.status, b.payment_status, b.total_amount, b.currency, b.created_at,
                json_build_object('id', s.id, 'name', s.name) as service,
                json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email) as customer
         FROM bookings b
         JOIN services s ON b.service_id = s.id
         JOIN users u ON b.customer_id = u.id
         WHERE b.barber_id = $1
         ORDER BY b.created_at DESC
         LIMIT 50`,
        [barberId]
      ),
      pool.query(
        `SELECT r.id, r.rating, r.comment, r.created_at,
                json_build_object('id', u.id, 'full_name', u.full_name) as customer
         FROM reviews r
         JOIN users u ON r.customer_id = u.id
         WHERE r.barber_id = $1
         ORDER BY r.created_at DESC
         LIMIT 50`,
        [barberId]
      ),
      pool.query(
        `SELECT
           COUNT(*) as total_bookings,
           COUNT(*) FILTER (WHERE status = 'completed') as completed_bookings,
           COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_bookings,
           COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0) as total_paid_revenue,
           COALESCE(AVG(total_amount), 0) as avg_booking_value
         FROM bookings WHERE barber_id = $1`,
        [barberId]
      ),
    ]);

    res.json({
      profile: profileResult.rows[0],
      services: servicesResult.rows,
      schedule: scheduleResult.rows,
      recent_bookings: bookingsResult.rows,
      reviews: reviewsResult.rows,
      stats: statsResult.rows[0],
    });
  } catch (error) {
    console.error('Error fetching barber detail:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /admin/companies/:id/payments - Payments table rows (if any) joined to
// bookings for context, PLUS a payment_status breakdown straight off the bookings
// table itself (since real payment processing writes payment_status on bookings,
// not necessarily a payments row). Honest empty state if payments table has no rows.
app.get('/admin/companies/:id/payments', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminDb = req.adminDb!;

    const companyResult = await adminDb.query('SELECT id, name FROM companies WHERE id = $1', [id]);
    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const pool = await getTenantPool(id);

    const [paymentsResult, bookingPaymentStatusResult] = await Promise.all([
      pool.query(`
        SELECT
          p.id, p.amount, p.currency, p.payment_method, p.transaction_id, p.status, p.notes, p.created_at,
          json_build_object(
            'id', b.id, 'booking_reference', b.booking_reference, 'booking_date', b.booking_date,
            'total_amount', b.total_amount, 'payment_status', b.payment_status
          ) as booking,
          json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email) as customer
        FROM payments p
        JOIN bookings b ON p.booking_id = b.id
        JOIN users u ON p.customer_id = u.id
        ORDER BY p.created_at DESC
        LIMIT 100
      `),
      pool.query(`
        SELECT payment_status, payment_method, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total_amount
        FROM bookings
        GROUP BY payment_status, payment_method
        ORDER BY payment_status
      `),
    ]);

    res.json({
      payments: paymentsResult.rows,
      booking_payment_status_breakdown: bookingPaymentStatusResult.rows,
    });
  } catch (error) {
    console.error('Error fetching company payments:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /admin/companies/:id/onboarding - Setup/entitlements summary: which features
// are enabled, capacity usage (max_barbers vs actual), tier, created/last-active.
app.get('/admin/companies/:id/onboarding', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminDb = req.adminDb!;

    const companyResult = await adminDb.query(
      `SELECT id, name, subscription_tier, max_barbers, status, created_at FROM companies WHERE id = $1`,
      [id]
    );
    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    const company = companyResult.rows[0];

    const [entitlementsResult, lastActiveResult] = await Promise.all([
      adminDb.query(
        `SELECT feature, enabled, updated_at FROM company_entitlements WHERE company_id = $1 ORDER BY feature`,
        [id]
      ),
      adminDb.query(
        `SELECT MAX(timestamp) as last_active, COUNT(*) as calls_7d
         FROM api_key_usage WHERE company_id = $1 AND timestamp > NOW() - INTERVAL '7 days'`,
        [id]
      ),
    ]);

    let barberCount = 0;
    try {
      const pool = await getTenantPool(id);
      const barberCountResult = await pool.query(
        `SELECT COUNT(*) as count FROM barber_profiles WHERE is_active = true`
      );
      barberCount = Number(barberCountResult.rows[0].count);
    } catch (err) {
      console.error(`Onboarding summary: failed to query tenant DB for company ${id}:`, (err as Error).message);
    }

    res.json({
      company,
      entitlements: entitlementsResult.rows,
      capacity: {
        max_barbers: company.max_barbers,
        active_barbers: barberCount,
        usage_pct: company.max_barbers ? Math.round((barberCount / company.max_barbers) * 100) : null,
      },
      activity: lastActiveResult.rows[0],
    });
  } catch (error) {
    console.error('Error fetching onboarding summary:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /admin/bookings - Real bookings across ALL companies. booking_metrics is a
// dead rollup table nothing writes to (see comment above /admin/dashboard) — the
// actual booking rows live per-tenant, so this iterates every active company's
// own tenant DB (foundation_barber_<id>) and merges recent bookings, tagged with
// which company they belong to. Capped per-company and overall to keep payload sane.
app.get('/admin/bookings', requireAdmin, async (req: Request, res: Response) => {
  const PER_COMPANY_LIMIT = 50;
  const TOTAL_CAP = 500;
  try {
    const adminDb = req.adminDb!;
    const companiesResult = await adminDb.query(
      `SELECT id, name FROM companies WHERE status = 'active' ORDER BY id`
    );

    const allBookings: any[] = [];

    for (const company of companiesResult.rows) {
      if (allBookings.length >= TOTAL_CAP) break;
      try {
        const pool = await getTenantPool(company.id.toString());
        const result = await pool.query(
          `
          SELECT
            b.id,
            b.booking_reference,
            b.booking_date,
            b.start_time,
            b.status,
            b.payment_status,
            b.total_amount,
            b.currency,
            b.created_at,
            bp.display_name as barber_name,
            s.name as service_name
          FROM bookings b
          JOIN barber_profiles bp ON b.barber_id = bp.id
          JOIN services s ON b.service_id = s.id
          ORDER BY b.created_at DESC
          LIMIT $1
        `,
          [PER_COMPANY_LIMIT]
        );

        for (const row of result.rows) {
          allBookings.push({
            ...row,
            company_id: company.id,
            company_name: company.name,
          });
        }
      } catch (err) {
        console.error(`Bookings: failed to query tenant DB for company ${company.id}:`, (err as Error).message);
      }
    }

    allBookings.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json(allBookings.slice(0, TOTAL_CAP));
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /admin/income - Global income report
app.get('/admin/income', requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminDb = req.adminDb!;

    const result = await adminDb.query(`
      SELECT
        DATE(metric_date) as date,
        SUM(total_revenue) as total_revenue,
        COUNT(DISTINCT company_id) as active_companies,
        SUM(completed_bookings) as total_bookings
      FROM booking_metrics
      GROUP BY DATE(metric_date)
      ORDER BY date DESC
      LIMIT 90
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching income:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================================================
// COMPANY DASHBOARD ROUTES (Barber Company - Sees Own Data Only)
// ============================================================================

// GET /api/v1/company/dashboard - Company dashboard data
app.get('/api/v1/company/dashboard', async (req: Request, res: Response) => {
  try {
    if (!req.tenant || req.tenant.isAdmin) {
      return res.status(401).json({ error: 'Company context required' });
    }

    const companyId = req.tenant.companyId;
    const adminDb = req.adminDb!;

    // Get company metrics
    const metrics = await adminDb.query(`
      SELECT
        SUM(total_bookings) as total_bookings,
        SUM(completed_bookings) as completed_bookings,
        SUM(canceled_bookings) as canceled_bookings,
        SUM(total_revenue) as total_revenue,
        AVG(average_rating) as average_rating,
        COUNT(*) as metric_days
      FROM booking_metrics
      WHERE company_id = $1 AND metric_date >= CURRENT_DATE - INTERVAL '30 days'
    `, [companyId]);

    // Get today's bookings from tenant DB
    const todayBookings = await req.tenant.pool.query(`
      SELECT COUNT(*) as count FROM bookings
      WHERE DATE(booking_date) = CURRENT_DATE
    `);

    res.json({
      company: {
        id: req.tenant.companyId,
        name: req.tenant.companyName,
        tier: req.tenant.tier
      },
      metrics: metrics.rows[0],
      today: {
        bookings: todayBookings.rows[0].count
      }
    });
  } catch (error) {
    console.error('Company dashboard error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/v1/company/bookings - Company's bookings
app.get('/api/v1/company/bookings', async (req: Request, res: Response) => {
  try {
    if (!req.tenant || req.tenant.isAdmin) {
      return res.status(401).json({ error: 'Company context required' });
    }

    const result = await req.tenant!.pool.query(`
      SELECT
        b.id,
        b.booking_reference,
        b.customer_id,
        b.barber_id,
        b.service_id,
        b.booking_date,
        b.start_time,
        b.status,
        b.payment_status,
        b.total_amount,
        bp.display_name as barber_name,
        s.name as service_name
      FROM bookings b
      JOIN barber_profiles bp ON b.barber_id = bp.id
      JOIN services s ON b.service_id = s.id
      ORDER BY b.booking_date DESC
      LIMIT 100
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/v1/company/income - Company's income reports
app.get('/api/v1/company/income', async (req: Request, res: Response) => {
  try {
    if (!req.tenant || req.tenant.isAdmin) {
      return res.status(401).json({ error: 'Company context required' });
    }

    const adminDb = req.adminDb!;
    const companyId = req.tenant.companyId;

    const result = await adminDb.query(`
      SELECT
        metric_date,
        total_bookings,
        completed_bookings,
        canceled_bookings,
        total_revenue,
        average_rating
      FROM booking_metrics
      WHERE company_id = $1
      ORDER BY metric_date DESC
      LIMIT 90
    `, [companyId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching income:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/v1/company/barbers - Company's barbers
app.get('/api/v1/company/barbers', async (req: Request, res: Response) => {
  try {
    if (!req.tenant || req.tenant.isAdmin) {
      return res.status(401).json({ error: 'Company context required' });
    }

    const result = await req.tenant!.pool.query(`
      SELECT
        bp.id,
        bp.display_name,
        bp.bio,
        bp.experience_years,
        bp.rating_avg,
        bp.rating_count,
        bp.is_active,
        COUNT(b.id) as total_bookings,
        COUNT(b.id) FILTER (WHERE b.status = 'completed') as completed_bookings
      FROM barber_profiles bp
      LEFT JOIN bookings b ON bp.id = b.barber_id
      GROUP BY bp.id
      ORDER BY bp.rating_avg DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching barbers:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================================================
// CUSTOMER API ROUTES (Customers & Barber Apps)
// ============================================================================

// Shared projection for public barber listings. Services come from a scalar
// subquery rather than a LEFT JOIN + GROUP BY so that LIMIT/OFFSET applies to
// BARBERS (the join would multiply rows before the limit, and paginating a
// multiplied set returns partial barbers). The subquery only runs for the rows
// actually returned in the page.
const PUBLIC_BARBER_COLUMNS = `
        bp.id,
        bp.user_id,
        bp.display_name,
        bp.bio,
        bp.experience_years,
        bp.rating_avg,
        bp.rating_count,
        bp.shop_name,
        bp.address_text,
        bp.latitude,
        bp.longitude,
        bp.is_verified,
        bp.is_active,
        bp.is_online,
        bp.service_mode,
        bp.service_radius_km,
        bp.work_photos,
        json_build_object(
          'full_name', u.full_name,
          'email', u.email,
          'avatar_url', u.avatar_url
        ) as users,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', s.id,
            'name', s.name,
            'description', s.description,
            'price', s.price,
            'currency', s.currency,
            'duration_minutes', s.duration_minutes
          ) ORDER BY s.price ASC)
          FROM services s
          WHERE s.barber_id = bp.id AND s.is_active = true
        ), '[]'::json) as services`;

/** Clamp a query-string integer into a safe range (guards against ?limit=1e9). */
function intParam(raw: unknown, def: number, min: number, max: number): number {
  const n = parseInt(String(raw ?? ''), 10);
  if (Number.isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
}

// GET /api/barbers — paginated barber list.
// Pagination is enforced at the DATABASE (LIMIT/OFFSET), never by slicing a
// full table fetch in JS, so this stays flat as the tenant grows.
app.get('/api/barbers', async (req: Request, res: Response) => {
  try {
    const limit = intParam(req.query.limit, 20, 1, 100);
    const offset = intParam(req.query.offset, 0, 0, 1_000_000);

    const result = await req.tenant!.pool.query(
      `SELECT ${PUBLIC_BARBER_COLUMNS}
      FROM barber_profiles bp
      JOIN users u ON bp.user_id = u.id
      WHERE bp.is_active = true
      ORDER BY bp.rating_avg DESC, bp.id
      LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching barbers:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/barbers/nearby?lat=&lng=&radius_km=&limit=&offset=
//
// Geographic discovery done IN POSTGRES. Distance is computed with the
// earthdistance extension; the earth_box() predicate is what lets the GiST
// index (idx_barber_profiles_earth) prune candidates instead of scanning the
// whole table, and the precise earth_distance() filter runs only on survivors.
//
// Eligibility differs by service mode, per the board:
//   mobile / both -> the barber travels, so they qualify when the CUSTOMER is
//                    inside the barber's own service_radius_km.
//   in_shop       -> the customer travels, so they qualify when the shop is
//                    inside the customer's requested search radius.
// Either way distance_km is the real customer->barber great-circle distance
// and ordering is done by the database.
//
// NOTE: must be registered BEFORE '/api/barbers/:id', otherwise Express would
// match "nearby" as an :id.
app.get('/api/barbers/nearby', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(String(req.query.lat));
    const lng = parseFloat(String(req.query.lng));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({ error: 'Valid lat and lng query parameters are required' });
    }
    const radiusKm = Math.min(200, Math.max(1, parseFloat(String(req.query.radius_km ?? '25')) || 25));
    const limit = intParam(req.query.limit, 20, 1, 100);
    const offset = intParam(req.query.offset, 0, 0, 1_000_000);
    const onlineOnly = String(req.query.online_only ?? '') === 'true';

    // Outer bound for the index probe: the widest distance any row could
    // qualify at — the customer's search radius or the largest travel radius
    // a barber may configure (capped at 50km by the profile validation).
    const boxMeters = Math.max(radiusKm, 50) * 1000;

    const result = await req.tenant!.pool.query(
      `WITH origin AS (SELECT ll_to_earth($1::float8, $2::float8) AS pt)
       SELECT ${PUBLIC_BARBER_COLUMNS},
         round((earth_distance(origin.pt, ll_to_earth(bp.latitude::float8, bp.longitude::float8)) / 1000)::numeric, 2) AS distance_km
       FROM barber_profiles bp
       JOIN users u ON bp.user_id = u.id
       CROSS JOIN origin
       WHERE bp.is_active = true
         AND bp.latitude IS NOT NULL AND bp.longitude IS NOT NULL
         AND ($6::boolean = false OR bp.is_online = true)
         AND earth_box(origin.pt, $5::float8) @> ll_to_earth(bp.latitude::float8, bp.longitude::float8)
         AND earth_distance(origin.pt, ll_to_earth(bp.latitude::float8, bp.longitude::float8))
             <= CASE WHEN bp.service_mode IN ('mobile','both')
                     THEN GREATEST($3::float8 * 1000, bp.service_radius_km::float8 * 1000)
                     ELSE $3::float8 * 1000 END
       ORDER BY distance_km ASC, bp.rating_avg DESC, bp.id
       LIMIT $4 OFFSET $7`,
      [lat, lng, radiusKm, limit, boxMeters, onlineOnly, offset]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching nearby barbers:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/barbers/:id - Get single barber
app.get('/api/barbers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await req.tenant!.pool.query(`
      SELECT
        bp.id,
        bp.user_id,
        bp.display_name,
        bp.bio,
        bp.experience_years,
        bp.rating_avg,
        bp.rating_count,
        bp.shop_name,
        bp.address_text,
        bp.work_photos,
        json_build_object(
          'full_name', u.full_name,
          'email', u.email,
          'avatar_url', u.avatar_url
        ) as users,
        json_agg(json_build_object(
          'id', s.id,
          'name', s.name,
          'description', s.description,
          'price', s.price,
          'currency', s.currency,
          'duration_minutes', s.duration_minutes
        )) as services
      FROM barber_profiles bp
      JOIN users u ON bp.user_id = u.id
      LEFT JOIN services s ON s.barber_id = bp.id
      WHERE bp.id = $1
      GROUP BY bp.id, u.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Barber not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching barber:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/bookings - Get user's bookings
app.get('/api/bookings', async (req: Request, res: Response) => {
  try {
    // SECURITY: the caller's identity comes from the verified JWT (tenantMiddleware),
    // never from a client-supplied x-user-id header — trusting that header let any
    // signed-in user read another user's bookings by editing one request header.
    const customerId = req.tenant?.userId;

    if (!customerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await req.tenant!.pool.query(`
      SELECT
        b.id,
        b.booking_reference,
        b.customer_id,
        b.barber_id,
        b.service_id,
        b.booking_date,
        b.start_time,
        b.end_time,
        b.status,
        b.payment_status,
        b.total_amount,
        json_build_object(
          'id', bp.id,
          'display_name', bp.display_name,
          'shop_name', bp.shop_name
        ) as barber_profiles,
        -- Chat & call v1 (SCOPE_RECONCILIATION §5): the barber's phone number
        -- is only revealed AFTER the barber accepts — the same unlock moment
        -- the Figma promises for chat/call. Pending/declined bookings get NULL.
        CASE WHEN b.status IN ('confirmed', 'completed') THEN bu.phone END as barber_phone,
        json_build_object(
          'id', s.id,
          'name', s.name,
          'price', s.price,
          'duration_minutes', s.duration_minutes
        ) as services
      FROM bookings b
      JOIN barber_profiles bp ON b.barber_id = bp.id
      JOIN users bu ON bp.user_id = bu.id
      JOIN services s ON b.service_id = s.id
      WHERE b.customer_id = $1
      ORDER BY b.booking_date DESC
    `, [customerId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/barber/bookings - Get bookings for the logged-in barber.
// Identity comes from the verified JWT (req.tenant.userId), never headers.
app.get('/api/barber/bookings', requireBarberAuth, async (req: Request, res: Response) => {
  try {
    const barberUserId = req.tenant!.userId!;

    const result = await req.tenant!.pool.query(`
      SELECT
        b.id,
        b.booking_reference,
        b.customer_id,
        b.barber_id,
        b.service_id,
        b.booking_date,
        b.start_time,
        b.end_time,
        b.status,
        b.payment_status,
        b.total_amount,
        b.notes,
        json_build_object(
          'id', u.id,
          'full_name', u.full_name,
          'email', u.email
        ) as users,
        json_build_object(
          'id', s.id,
          'name', s.name,
          'price', s.price,
          'duration_minutes', s.duration_minutes
        ) as services,
        json_build_object(
          'shop_name', bp.shop_name,
          'address_text', bp.address_text
        ) as barber_profiles,
        -- Chat & call v1 (SCOPE_RECONCILIATION §5): the customer's phone is
        -- only revealed once the barber has accepted the job.
        CASE WHEN b.status IN ('confirmed', 'completed') THEN u.phone END as customer_phone
      FROM bookings b
      JOIN barber_profiles bp ON b.barber_id = bp.id
      JOIN users u ON b.customer_id = u.id
      JOIN services s ON b.service_id = s.id
      WHERE bp.user_id = $1
      ORDER BY b.booking_date DESC
    `, [barberUserId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching barber bookings:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/bookings - Create booking
app.post('/api/bookings', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const { barber_id, service_id, booking_date, start_time, notes } = req.body;
    // SECURITY: the customer is ALWAYS the authenticated caller. Never accept
    // customer_id from the body — doing so let anyone create bookings in
    // another user's name.
    const customer_id = req.tenant!.userId!;

    if (!barber_id || !service_id || !booking_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate booking reference
    const bookingRef = `BS-${Date.now().toString(36).toUpperCase()}`;

    // Get service details for total amount + duration
    const serviceResult = await req.tenant!.pool.query(
      'SELECT price, duration_minutes FROM services WHERE id = $1',
      [service_id]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const totalAmount = serviceResult.rows[0].price;
    const durationMinutes = serviceResult.rows[0].duration_minutes || 30;
    const startTime = start_time || '09:00';
    const [startHour, startMin] = startTime.split(':').map(Number);
    const endTotalMinutes = startHour * 60 + startMin + durationMinutes;
    const endTime = `${String(Math.floor(endTotalMinutes / 60) % 24).padStart(2, '0')}:${String(endTotalMinutes % 60).padStart(2, '0')}`;

    // Create booking
    const result = await req.tenant!.pool.query(`
      INSERT INTO bookings (
        booking_reference, customer_id, barber_id, service_id,
        booking_date, start_time, end_time, status, payment_status, total_amount, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      bookingRef, customer_id, barber_id, service_id,
      booking_date, startTime, endTime, 'pending', 'unpaid', totalAmount, notes
    ]);

    // Notify the barber that a new request has arrived (non-fatal).
    const barberUserId = await getBarberUserId(req.tenant!.pool, barber_id);
    await createNotification(
      req.tenant!.pool,
      barberUserId,
      'New booking request',
      `You have a new booking request for ${booking_date} at ${startTime}.`,
      'booking',
      result.rows[0].id
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/bookings/:id/accept - Barber accepts booking
app.post('/api/bookings/:id/accept', requireBarberAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // SECURITY: only the barber the booking was addressed to may accept it.
    const barberId = await getOwnBarberProfileId(req.tenant!.pool, req.tenant!.userId!);
    if (!barberId) return res.status(404).json({ error: 'Barber profile not found' });

    const result = await req.tenant!.pool.query(
      `UPDATE bookings SET status = $1
        WHERE id = $2 AND barber_id = $3 AND status = 'pending' RETURNING *`,
      ['confirmed', id, barberId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found, not yours, or no longer pending' });
    }

    // Notify the customer their request was accepted (non-fatal).
    await createNotification(
      req.tenant!.pool,
      result.rows[0].customer_id,
      'Booking confirmed',
      'Your barber accepted your request. Chat and call are now unlocked.',
      'booking',
      result.rows[0].id
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error accepting booking:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/bookings/:id/complete - Barber marks booking complete
app.post('/api/bookings/:id/complete', requireBarberAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // SECURITY: only the assigned barber may mark their own job complete.
    const barberId = await getOwnBarberProfileId(req.tenant!.pool, req.tenant!.userId!);
    if (!barberId) return res.status(404).json({ error: 'Barber profile not found' });

    const result = await req.tenant!.pool.query(
      `UPDATE bookings SET status = $1
        WHERE id = $2 AND barber_id = $3 AND status = 'confirmed' RETURNING *`,
      ['completed', id, barberId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found, not yours, or not confirmed' });
    }

    // Notify the customer the job is done — this also unlocks leaving a review.
    await createNotification(
      req.tenant!.pool,
      result.rows[0].customer_id,
      'Booking completed',
      'Your appointment is complete. You can now rate your barber.',
      'booking',
      result.rows[0].id
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error completing booking:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/bookings/:id/cancel - Barber (or customer) cancels booking
app.post('/api/bookings/:id/cancel', requireUserAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.tenant!.userId!;
    // SECURITY: either side of the booking may cancel it, but nobody else.
    // A barber cancels via their profile id, a customer via their user id.
    const barberId = req.tenant!.userRole === 'barber'
      ? await getOwnBarberProfileId(req.tenant!.pool, userId)
      : null;

    const result = await req.tenant!.pool.query(
      `UPDATE bookings SET status = $1
        WHERE id = $2
          AND status IN ('pending','confirmed')
          AND (customer_id = $3 OR ($4::uuid IS NOT NULL AND barber_id = $4))
        RETURNING *`,
      ['cancelled', id, userId, barberId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found, not yours, or already closed' });
    }

    // Notify the OTHER party about the cancellation (non-fatal). If the
    // customer cancelled, tell the barber; if the barber cancelled, tell the
    // customer.
    const cancelled = result.rows[0];
    const cancelledByCustomer = cancelled.customer_id === userId;
    const counterpartUserId = cancelledByCustomer
      ? await getBarberUserId(req.tenant!.pool, cancelled.barber_id)
      : cancelled.customer_id;
    await createNotification(
      req.tenant!.pool,
      counterpartUserId,
      'Booking cancelled',
      cancelledByCustomer
        ? 'The customer cancelled this booking.'
        : 'Your barber cancelled this booking.',
      'booking',
      cancelled.id
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/reviews - Create review
app.post('/api/reviews', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const { booking_id, rating, comment } = req.body;
    // SECURITY: the reviewer is the authenticated customer. Previously
    // customer_id/barber_id came from the body with no auth at all, which let
    // anyone post unlimited fake ratings for any barber.
    const customer_id = req.tenant!.userId!;

    if (!booking_id || !rating) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // A review must correspond to a COMPLETED booking that this customer
    // actually had — that also determines which barber is being reviewed, so
    // barber_id can never be spoofed.
    const bookingResult = await req.tenant!.pool.query(
      `SELECT barber_id FROM bookings
        WHERE id = $1 AND customer_id = $2 AND status = 'completed'`,
      [booking_id, customer_id]
    );
    if (bookingResult.rows.length === 0) {
      return res.status(403).json({ error: 'You can only review your own completed bookings' });
    }
    const barber_id = bookingResult.rows[0].barber_id;

    // One review per booking.
    const existing = await req.tenant!.pool.query(
      'SELECT id FROM reviews WHERE booking_id = $1', [booking_id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'This booking has already been reviewed' });
    }

    // Create review
    const result = await req.tenant!.pool.query(`
      INSERT INTO reviews (booking_id, customer_id, barber_id, rating, comment)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [booking_id, customer_id, barber_id, rating, comment]);

    // Update barber's average rating
    await req.tenant!.pool.query(`
      UPDATE barber_profiles
      SET rating_avg = (
        SELECT AVG(rating) FROM reviews WHERE barber_id = $1
      ),
      rating_count = (
        SELECT COUNT(*) FROM reviews WHERE barber_id = $1
      )
      WHERE id = $1
    `, [barber_id]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/payments/create-intent - Create a Stripe PaymentIntent for a booking's
// total_amount. Tenant-scoped like every other /api route. Returns a clean 501 if
// STRIPE_SECRET_KEY isn't set in this environment yet, instead of crashing — the
// rest of the app (and the frontend's "not enabled yet" state) keeps working.
app.post('/api/payments/create-intent', requireCustomerAuth, async (req: Request, res: Response) => {
  if (!stripe) {
    return res.status(501).json({ error: 'Stripe not configured for this environment yet' });
  }

  try {
    const { booking_id } = req.body;

    if (!booking_id) {
      return res.status(400).json({ error: 'booking_id required' });
    }

    if (!req.tenant) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    // SECURITY: only pay for your OWN booking — the customer_id predicate stops
    // a caller creating payment intents against other people's bookings.
    const bookingResult = await req.tenant.pool.query(
      `SELECT id, total_amount, currency, payment_status FROM bookings
        WHERE id = $1 AND customer_id = $2`,
      [booking_id, req.tenant.userId]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];
    const currency = (booking.currency || 'usd').toLowerCase();
    // Stripe amounts are in the smallest currency unit (e.g. cents for USD).
    const amountInSmallestUnit = Math.round(Number(booking.total_amount) * 100);

    if (!amountInSmallestUnit || amountInSmallestUnit <= 0) {
      return res.status(400).json({ error: 'Booking has no payable amount' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInSmallestUnit,
      currency,
      metadata: {
        booking_id: String(booking.id),
        tenant_id: req.tenant.companyId,
      },
    });

    res.json({ client_secret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/services - Get all services
app.get('/api/services', async (req: Request, res: Response) => {
  try {
    const result = await req.tenant!.pool.query(`
      SELECT
        s.id,
        s.barber_id,
        s.name,
        s.description,
        s.price,
        s.currency,
        s.duration_minutes,
        json_build_object(
          'id', bp.id,
          'display_name', bp.display_name
        ) as barber_profiles
      FROM services s
      JOIN barber_profiles bp ON s.barber_id = bp.id
      WHERE s.is_active = true
      ORDER BY s.price ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================================================
// BARBER PROFILE / SERVICES / SCHEDULE CRUD (protected by requireBarberAuth —
// the JWT session issued by /api/auth/login|signup, checked in tenant.ts).
// Every route below resolves the caller's OWN barber_profiles row from
// req.tenant.userId (the JWT's sub claim) — a barber can never touch another
// barber's data because the barber_id is never taken from the client.
// ============================================================================

async function getOwnBarberProfileId(pool: any, userId: string): Promise<string | null> {
  const result = await pool.query('SELECT id FROM barber_profiles WHERE user_id = $1', [userId]);
  return result.rows[0]?.id || null;
}

// ============================================================================
// NOTIFICATIONS (Figma: Notifications screen + customer nav tab)
// Rows are written server-side on booking lifecycle events and read back by
// the owner only. Writing a notification must NEVER fail the parent action —
// a booking that saved but whose notification insert failed is still a booking.
// ============================================================================

async function createNotification(
  pool: any,
  userId: string | null | undefined,
  title: string,
  message: string,
  type: string,
  relatedId: string | null
): Promise<void> {
  if (!userId) return;
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, related_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, title, message, type, relatedId]
    );
    // Best-effort email copy via local Postfix (see mailer.ts) — mirrors the
    // in-app notification so booking events reach users who aren't in the app.
    const userRow = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    const email = userRow.rows[0]?.email as string | undefined;
    if (email) sendEmail(email, `Shorter — ${title}`, `${message}\n\nOpen Shorter to view details.`);
  } catch (error) {
    console.error('Non-fatal: failed to write notification:', error);
  }
}

// Resolve the user account behind a barber_profiles row (for notifying the
// barber when a customer acts on a booking).
async function getBarberUserId(pool: any, barberProfileId: string): Promise<string | null> {
  const result = await pool.query('SELECT user_id FROM barber_profiles WHERE id = $1', [barberProfileId]);
  return result.rows[0]?.user_id || null;
}

// GET /api/notifications — the authenticated user's own notifications, newest
// first. SECURITY: user_id comes from the JWT only; no client-supplied ids.
app.get('/api/notifications', requireUserAuth, async (req: Request, res: Response) => {
  try {
    const result = await req.tenant!.pool.query(
      `SELECT id, title, message, type, related_id, is_read, created_at
         FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [req.tenant!.userId!]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// PATCH /api/notifications/:id/read — mark one of YOUR notifications read.
app.patch('/api/notifications/:id/read', requireUserAuth, async (req: Request, res: Response) => {
  try {
    const result = await req.tenant!.pool.query(
      `UPDATE notifications SET is_read = true
        WHERE id = $1 AND user_id = $2 RETURNING id, is_read`,
      [req.params.id, req.tenant!.userId!]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/notifications/read-all — mark all of YOUR notifications read.
app.post('/api/notifications/read-all', requireUserAuth, async (req: Request, res: Response) => {
  try {
    await req.tenant!.pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [req.tenant!.userId!]
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('Error marking notifications read:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/barber/status — lightweight onboarding/verification status check
// for the logged-in barber, used by the client to refresh gate state on app
// load (e.g. after a previous session's token is restored from localStorage).
app.get('/api/barber/status', requireBarberAuth, async (req: Request, res: Response) => {
  try {
    const pool = req.tenant!.pool;
    const userId = req.tenant!.userId!;
    const result = await pool.query(
      `SELECT onboarding_completed, is_verified, is_approved, is_active,
              onboarding_step, onboarding_completed_at, verification_status,
              is_online, service_radius_km, buffer_minutes,
              service_mode, booking_mode, city, region, country
       FROM barber_profiles WHERE user_id = $1`,
      [userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Barber profile not found' });
    const row = result.rows[0];
    res.json({
      onboarding_completed: !!row.onboarding_completed,
      is_verified: !!row.is_verified,
      is_approved: !!row.is_approved,
      is_active: !!row.is_active,
      onboarding_step: row.onboarding_step ?? 1,
      onboarding_completed_at: row.onboarding_completed_at ?? null,
      verification_status: row.verification_status ?? 'unsubmitted',
      is_online: !!row.is_online,
      service_radius_km: row.service_radius_km != null ? Number(row.service_radius_km) : null,
      buffer_minutes: row.buffer_minutes != null ? Number(row.buffer_minutes) : null,
      service_mode: row.service_mode ?? null,
      booking_mode: row.booking_mode ?? null,
      city: row.city ?? null,
      region: row.region ?? null,
      country: row.country ?? null,
    });
  } catch (error) {
    console.error('Error fetching barber status:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/barber/profile — read the logged-in barber's own full profile row,
// used to prefill the profile-edit screen honestly instead of blank defaults.
app.get('/api/barber/profile', requireBarberAuth, async (req: Request, res: Response) => {
  try {
    const pool = req.tenant!.pool;
    const userId = req.tenant!.userId!;
    const result = await pool.query(
      `SELECT bp.*, u.full_name, u.email, u.phone, u.avatar_url
       FROM barber_profiles bp
       JOIN users u ON u.id = bp.user_id
       WHERE bp.user_id = $1`,
      [userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Barber profile not found' });
    // bp.* already carries every column (including the migration-002 additions:
    // service_radius_km, buffer_minutes, is_online, city, region, country,
    // verification_status, onboarding_step, onboarding_completed_at). Numerics
    // arrive from pg as strings, so normalise the ones the UI binds to inputs.
    const row = result.rows[0];
    res.json({
      ...row,
      service_radius_km: row.service_radius_km != null ? Number(row.service_radius_km) : null,
      buffer_minutes: row.buffer_minutes != null ? Number(row.buffer_minutes) : null,
      onboarding_step: row.onboarding_step != null ? Number(row.onboarding_step) : 1,
      verification_status: row.verification_status ?? 'unsubmitted',
      is_online: !!row.is_online,
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
    });
  } catch (error) {
    console.error('Error fetching barber profile:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/barber/services — the logged-in barber's OWN services only
// (unlike GET /api/services, which lists every barber's active services).
app.get('/api/barber/services', requireBarberAuth, async (req: Request, res: Response) => {
  try {
    const pool = req.tenant!.pool;
    const userId = req.tenant!.userId!;
    const barberId = await getOwnBarberProfileId(pool, userId);
    if (!barberId) return res.status(404).json({ error: 'Barber profile not found' });
    const result = await pool.query(
      'SELECT id, name, description, price, currency, duration_minutes FROM services WHERE barber_id = $1 AND is_active = true',
      [barberId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching own services:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/barber/schedule — read the logged-in barber's own weekly schedule.
app.get('/api/barber/schedule', requireBarberAuth, async (req: Request, res: Response) => {
  try {
    const pool = req.tenant!.pool;
    const userId = req.tenant!.userId!;
    const barberId = await getOwnBarberProfileId(pool, userId);
    if (!barberId) return res.status(404).json({ error: 'Barber profile not found' });
    const result = await pool.query(
      'SELECT id, day_of_week, start_time, end_time, is_available FROM barber_schedule WHERE barber_id = $1 ORDER BY day_of_week',
      [barberId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching barber schedule:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/reviews-by-barber/:barberId — public reviews list for a barber
// (rating distribution + recent feedback), tenant-scoped like every other route.
app.get('/api/reviews-by-barber/:barberId', async (req: Request, res: Response) => {
  try {
    const { barberId } = req.params;
    const result = await req.tenant!.pool.query(
      `SELECT r.id, r.rating, r.comment, r.created_at,
              u.full_name as customer_name
       FROM reviews r
       JOIN users u ON u.id = r.customer_id
       WHERE r.barber_id = $1
       ORDER BY r.created_at DESC`,
      [barberId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching reviews for barber:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// PUT /api/barber/profile — update the logged-in barber's own profile
app.put('/api/barber/profile', requireBarberAuth, async (req: Request, res: Response) => {
  try {
    const pool = req.tenant!.pool;
    const userId = req.tenant!.userId!;
    const barberId = await getOwnBarberProfileId(pool, userId);
    if (!barberId) return res.status(404).json({ error: 'Barber profile not found' });

    const {
      shop_name,
      address_text,
      bio,
      display_name,
      experience_years,
      avatar_url,
      service_mode,
      booking_mode,
      latitude,
      longitude,
      // migration 002 columns — onboarding settings that used to live only in
      // frontend state and never reached the database.
      service_radius_km,
      buffer_minutes,
      is_online,
      city,
      region,
      country,
      onboarding_step,
      // users.phone (not on barber_profiles) — persisted below.
      phone,
    } = req.body || {};

    // ---- server-side validation (never trust the client) --------------------
    const SERVICE_MODES = ['in_shop', 'mobile', 'both'];
    const BOOKING_MODES = ['instant', 'request_only'];
    if (service_mode != null && !SERVICE_MODES.includes(service_mode)) {
      return res.status(400).json({ error: `service_mode must be one of ${SERVICE_MODES.join(', ')}` });
    }
    if (booking_mode != null && !BOOKING_MODES.includes(booking_mode)) {
      return res.status(400).json({ error: `booking_mode must be one of ${BOOKING_MODES.join(', ')}` });
    }
    if (service_radius_km != null) {
      const n = Number(service_radius_km);
      if (!Number.isFinite(n) || n < 1 || n > 50) {
        return res.status(400).json({ error: 'service_radius_km must be a number between 1 and 50' });
      }
    }
    if (buffer_minutes != null) {
      const n = Number(buffer_minutes);
      if (!Number.isInteger(n) || n < 0 || n > 120) {
        return res.status(400).json({ error: 'buffer_minutes must be an integer between 0 and 120' });
      }
    }
    if (onboarding_step != null) {
      const n = Number(onboarding_step);
      if (!Number.isInteger(n) || n < 1 || n > 7) {
        return res.status(400).json({ error: 'onboarding_step must be an integer between 1 and 7' });
      }
    }
    if (is_online != null && typeof is_online !== 'boolean') {
      return res.status(400).json({ error: 'is_online must be a boolean' });
    }
    if (experience_years != null) {
      const n = Number(experience_years);
      if (!Number.isFinite(n) || n < 0 || n > 80) {
        return res.status(400).json({ error: 'experience_years must be a number between 0 and 80' });
      }
    }
    if (latitude != null) {
      const n = Number(latitude);
      if (!Number.isFinite(n) || n < -90 || n > 90) {
        return res.status(400).json({ error: 'latitude must be between -90 and 90' });
      }
    }
    if (longitude != null) {
      const n = Number(longitude);
      if (!Number.isFinite(n) || n < -180 || n > 180) {
        return res.status(400).json({ error: 'longitude must be between -180 and 180' });
      }
    }

    const result = await pool.query(
      `UPDATE barber_profiles SET
         shop_name = COALESCE($1, shop_name),
         address_text = COALESCE($2, address_text),
         bio = COALESCE($3, bio),
         display_name = COALESCE($4, display_name),
         experience_years = COALESCE($5, experience_years),
         service_mode = COALESCE($6, service_mode),
         booking_mode = COALESCE($7, booking_mode),
         latitude = COALESCE($9, latitude),
         longitude = COALESCE($10, longitude),
         service_radius_km = COALESCE($11, service_radius_km),
         buffer_minutes = COALESCE($12, buffer_minutes),
         is_online = COALESCE($13, is_online),
         city = COALESCE($14, city),
         region = COALESCE($15, region),
         country = COALESCE($16, country),
         onboarding_step = GREATEST(COALESCE($17, onboarding_step, 1), COALESCE(onboarding_step, 1))
       WHERE id = $8
       RETURNING *`,
      [
        shop_name ?? null,
        address_text ?? null,
        bio ?? null,
        display_name ?? null,
        experience_years ?? null,
        service_mode ?? null,
        booking_mode ?? null,
        barberId,
        latitude ?? null,
        longitude ?? null,
        service_radius_km ?? null,
        buffer_minutes ?? null,
        is_online ?? null,
        city ?? null,
        region ?? null,
        country ?? null,
        onboarding_step ?? null,
      ]
    );

    if (avatar_url) {
      await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatar_url, userId]);
    }
    // Phone lives on users, not barber_profiles.
    if (typeof phone === 'string' && phone.trim()) {
      await pool.query('UPDATE users SET phone = $1 WHERE id = $2', [phone.trim(), userId]);
    }

    const row = result.rows[0];
    res.json({
      ...row,
      service_radius_km: row.service_radius_km != null ? Number(row.service_radius_km) : null,
      buffer_minutes: row.buffer_minutes != null ? Number(row.buffer_minutes) : null,
      onboarding_step: row.onboarding_step != null ? Number(row.onboarding_step) : 1,
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
      is_online: !!row.is_online,
      phone: typeof phone === 'string' && phone.trim() ? phone.trim() : undefined,
    });
  } catch (error) {
    console.error('Error updating barber profile:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// PATCH /api/barber/online — flip the logged-in barber's own is_online flag.
// Body: { is_online: boolean }. Response: { is_online: boolean }.
app.patch('/api/barber/online', requireBarberAuth, async (req: Request, res: Response) => {
  try {
    const pool = req.tenant!.pool;
    const userId = req.tenant!.userId!;
    const barberId = await getOwnBarberProfileId(pool, userId);
    if (!barberId) return res.status(404).json({ error: 'Barber profile not found' });

    const { is_online } = req.body || {};
    if (typeof is_online !== 'boolean') {
      return res.status(400).json({ error: 'is_online must be a boolean' });
    }

    const result = await pool.query(
      'UPDATE barber_profiles SET is_online = $1 WHERE id = $2 RETURNING is_online',
      [is_online, barberId]
    );
    res.json({ is_online: !!result.rows[0].is_online });
  } catch (error) {
    console.error('Error updating online status:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/barber/services — create a service under the logged-in barber
app.post('/api/barber/services', requireBarberAuth, async (req: Request, res: Response) => {
  try {
    const pool = req.tenant!.pool;
    const userId = req.tenant!.userId!;
    const barberId = await getOwnBarberProfileId(pool, userId);
    if (!barberId) return res.status(404).json({ error: 'Barber profile not found' });

    const { name, description, price, duration_minutes, category_id } = req.body || {};
    if (!name || price == null || !duration_minutes) {
      return res.status(400).json({ error: 'name, price, and duration_minutes are required' });
    }

    const result = await pool.query(
      `INSERT INTO services (barber_id, category_id, name, description, price, duration_minutes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [barberId, category_id || null, name, description || null, price, duration_minutes]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// PUT /api/barber/services/:id — update, ownership-checked
app.put('/api/barber/services/:id', requireBarberAuth, async (req: Request, res: Response) => {
  try {
    const pool = req.tenant!.pool;
    const userId = req.tenant!.userId!;
    const barberId = await getOwnBarberProfileId(pool, userId);
    if (!barberId) return res.status(404).json({ error: 'Barber profile not found' });

    const { name, description, price, duration_minutes, category_id, is_active } = req.body || {};

    const result = await pool.query(
      `UPDATE services SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         price = COALESCE($3, price),
         duration_minutes = COALESCE($4, duration_minutes),
         category_id = COALESCE($5, category_id),
         is_active = COALESCE($6, is_active)
       WHERE id = $7 AND barber_id = $8
       RETURNING *`,
      [name, description, price, duration_minutes, category_id, is_active, req.params.id, barberId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found or not owned by this barber' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// DELETE /api/barber/services/:id — ownership-checked
app.delete('/api/barber/services/:id', requireBarberAuth, async (req: Request, res: Response) => {
  try {
    const pool = req.tenant!.pool;
    const userId = req.tenant!.userId!;
    const barberId = await getOwnBarberProfileId(pool, userId);
    if (!barberId) return res.status(404).json({ error: 'Barber profile not found' });

    const result = await pool.query(
      'DELETE FROM services WHERE id = $1 AND barber_id = $2 RETURNING id',
      [req.params.id, barberId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found or not owned by this barber' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// PUT /api/barber/schedule — replace the logged-in barber's full week
app.put('/api/barber/schedule', requireBarberAuth, async (req: Request, res: Response) => {
  const pool = req.tenant!.pool;
  const userId = req.tenant!.userId!;
  const client = await pool.connect();
  try {
    const barberId = await getOwnBarberProfileId(pool, userId);
    if (!barberId) return res.status(404).json({ error: 'Barber profile not found' });

    const { schedule } = req.body || {};
    if (!Array.isArray(schedule)) {
      return res.status(400).json({ error: 'schedule must be an array of { day_of_week, start_time, end_time, is_available }' });
    }
    for (const row of schedule) {
      if (typeof row.day_of_week !== 'number' || row.day_of_week < 0 || row.day_of_week > 6) {
        return res.status(400).json({ error: 'Each schedule row needs day_of_week 0-6' });
      }
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM barber_schedule WHERE barber_id = $1', [barberId]);
    for (const row of schedule) {
      await client.query(
        `INSERT INTO barber_schedule (barber_id, day_of_week, start_time, end_time, is_available)
         VALUES ($1, $2, $3, $4, $5)`,
        [barberId, row.day_of_week, row.start_time || '09:00', row.end_time || '18:00', row.is_available !== false]
      );
    }
    await client.query('COMMIT');

    const result = await pool.query(
      'SELECT id, day_of_week, start_time, end_time, is_available FROM barber_schedule WHERE barber_id = $1 ORDER BY day_of_week',
      [barberId]
    );
    res.json(result.rows);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: (error as Error).message });
  } finally {
    client.release();
  }
});

// POST /api/barber/onboarding/complete — real server-side validation, not
// just trusting the client: requires display_name, bio, shop_name filled in
// AND at least 1 service before flipping onboarding_completed to true.
app.post('/api/barber/onboarding/complete', requireBarberAuth, async (req: Request, res: Response) => {
  try {
    const pool = req.tenant!.pool;
    const userId = req.tenant!.userId!;
    const barberId = await getOwnBarberProfileId(pool, userId);
    if (!barberId) return res.status(404).json({ error: 'Barber profile not found' });

    const profileResult = await pool.query(
      'SELECT display_name, bio, shop_name FROM barber_profiles WHERE id = $1',
      [barberId]
    );
    const profile = profileResult.rows[0];
    const missing: string[] = [];
    if (!profile?.display_name) missing.push('display_name');
    if (!profile?.bio) missing.push('bio');
    if (!profile?.shop_name) missing.push('shop_name');

    const servicesResult = await pool.query(
      'SELECT COUNT(*)::int as count FROM services WHERE barber_id = $1',
      [barberId]
    );
    const hasServices = servicesResult.rows[0].count > 0;
    if (!hasServices) missing.push('at least 1 service');

    if (missing.length > 0) {
      return res.status(400).json({ error: 'Onboarding incomplete', missing });
    }

    const result = await pool.query(
      `UPDATE barber_profiles SET
         onboarding_completed = true,
         onboarding_completed_at = NOW(),
         onboarding_step = 7
       WHERE id = $1 RETURNING *`,
      [barberId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error completing onboarding:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/barber/verification/submit — records which verification
// documents the barber has submitted (filename-only, no file storage yet).
app.post('/api/barber/verification/submit', requireBarberAuth, async (req: Request, res: Response) => {
  try {
    const pool = req.tenant!.pool;
    const userId = req.tenant!.userId!;
    const barberId = await getOwnBarberProfileId(pool, userId);
    if (!barberId) return res.status(404).json({ error: 'Barber profile not found' });

    const { documentTypes } = req.body || {};
    if (!Array.isArray(documentTypes) || documentTypes.length === 0) {
      return res.status(400).json({ error: 'documentTypes must be a non-empty array' });
    }

    for (const docType of documentTypes) {
      await pool.query(
        `INSERT INTO barber_verification_documents (barber_id, document_type, submitted_at)
         VALUES ($1, $2, NOW())`,
        [barberId, String(docType)]
      );
    }

    const result = await pool.query(
      'SELECT document_type, submitted_at FROM barber_verification_documents WHERE barber_id = $1 ORDER BY submitted_at',
      [barberId]
    );
    res.status(201).json(result.rows);
  } catch (error) {
    console.error('Error submitting verification documents:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/barber/verification/documents — list submitted documents for the
// pending-review screen.
app.get('/api/barber/verification/documents', requireBarberAuth, async (req: Request, res: Response) => {
  try {
    const pool = req.tenant!.pool;
    const userId = req.tenant!.userId!;
    const barberId = await getOwnBarberProfileId(pool, userId);
    if (!barberId) return res.status(404).json({ error: 'Barber profile not found' });

    const result = await pool.query(
      'SELECT document_type, submitted_at FROM barber_verification_documents WHERE barber_id = $1 ORDER BY submitted_at',
      [barberId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching verification documents:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// PATCH /api/barber/profile/photos — persist a count of selected work photos
// (no real file storage backend exists yet, so we honestly store just the count).
app.patch('/api/barber/profile/photos', requireBarberAuth, async (req: Request, res: Response) => {
  try {
    const pool = req.tenant!.pool;
    const userId = req.tenant!.userId!;
    const barberId = await getOwnBarberProfileId(pool, userId);
    if (!barberId) return res.status(404).json({ error: 'Barber profile not found' });

    const { count } = req.body || {};
    if (typeof count !== 'number' || count < 0) {
      return res.status(400).json({ error: 'count must be a non-negative number' });
    }

    const result = await pool.query(
      'UPDATE barber_profiles SET work_photos_count = $1 WHERE id = $2 RETURNING id, work_photos_count',
      [count, barberId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating work photo count:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/issues — submit a safety/issue report. Writes to the shared ADMIN
// database (barber_app, not per-tenant) via req.adminDb so it's visible across
// tenants to the platform owner. No owner-facing UI to view these yet — this
// just makes submission real and persisted.
app.post('/api/issues', requireBarberAuth, async (req: Request, res: Response) => {
  try {
    const adminDb = req.adminDb!;
    const tenantId = req.tenant!.companyId;
    const reporterUserId = req.tenant!.userId!;
    const { reported_type, comments } = req.body || {};

    if (reported_type !== 'barber' && reported_type !== 'customer') {
      return res.status(400).json({ error: "reported_type must be 'barber' or 'customer'" });
    }

    const result = await adminDb.query(
      `INSERT INTO issue_reports (tenant_id, reporter_user_id, reported_type, comments)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tenantId, reporterUserId, reported_type, comments || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error submitting issue report:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// PATCH /admin/companies/:id/barbers/:barberId/verify — admin-only, sets
// is_verified=true on that barber's profile.
app.patch('/admin/companies/:id/barbers/:barberId/verify', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id, barberId } = req.params;
    const adminDb = req.adminDb!;

    const companyResult = await adminDb.query('SELECT id FROM companies WHERE id = $1', [id]);
    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const pool = await getTenantPool(id);
    const result = await pool.query(
      'UPDATE barber_profiles SET is_verified = true WHERE id = $1 RETURNING *',
      [barberId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Barber not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error verifying barber:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================================================
// DELETE /api/account — in-app account deletion.
//
// Required by App Store Review Guideline 5.1.1(v): an app that lets a user
// create an account must let them initiate deletion of that account from
// inside the app.
//
// Identity comes exclusively from the verified JWT on req.tenant — the body is
// only ever read for the { confirm: "DELETE" } re-confirmation token, never for
// a user id. Works for both 'customer' and 'barber' roles (the customer routes
// authenticate the same way: req.tenant?.userId, 401 if absent).
//
// Active-commitment guard: the real bookings.status CHECK constraint is
// ('pending','confirmed','cancelled','completed') — see docs/DATABASE_SCHEMA.sql
// and the accept/complete/cancel handlers above, which write 'confirmed',
// 'completed' and 'cancelled' respectively. So "still open" == pending|confirmed.
// ============================================================================
const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed'];

app.delete('/api/account', async (req: Request, res: Response) => {
  const userId = req.tenant?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if ((req.body || {}).confirm !== 'DELETE') {
    return res.status(400).json({
      error: 'Confirmation required',
      hint: 'Send { "confirm": "DELETE" } to permanently delete this account.',
    });
  }

  const pool = req.tenant!.pool;
  const tenantId = req.tenant!.companyId;
  const role = req.tenant!.userRole;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userRow = await client.query(
      'SELECT id, email, role FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    if (userRow.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Account not found' });
    }
    const effectiveRole = userRow.rows[0].role || role;

    // Resolve the barber profile (if any) — needed both for the commitment
    // check and to clean up uploaded files after the DB work commits.
    const profileRow = await client.query(
      'SELECT id FROM barber_profiles WHERE user_id = $1',
      [userId]
    );
    const barberProfileId: string | null = profileRow.rows[0]?.id ?? null;

    // Business-rule guard: refuse while anything is still open.
    let active = 0;
    if (barberProfileId) {
      const r = await client.query(
        `SELECT COUNT(*)::int AS n FROM bookings
          WHERE (customer_id = $1 OR barber_id = $2) AND status = ANY($3::text[])`,
        [userId, barberProfileId, ACTIVE_BOOKING_STATUSES]
      );
      active = r.rows[0].n;
    } else {
      const r = await client.query(
        `SELECT COUNT(*)::int AS n FROM bookings
          WHERE customer_id = $1 AND status = ANY($2::text[])`,
        [userId, ACTIVE_BOOKING_STATUSES]
      );
      active = r.rows[0].n;
    }

    if (active > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error:
          effectiveRole === 'barber'
            ? `You still have ${active} pending or confirmed job${active === 1 ? '' : 's'}. Complete or cancel them before deleting your account.`
            : `You still have ${active} pending or confirmed booking${active === 1 ? '' : 's'}. Cancel or complete them before deleting your account.`,
        active_bookings: active,
      });
    }

    // Deleting the users row cascades to barber_profiles (and its services,
    // schedule, work photos, verification documents, reviews) plus bookings,
    // notifications, payments and reviews written by this user.
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
    await client.query('COMMIT');

    // Files come off disk only after the DB work is durably committed, so a
    // rolled-back delete can never orphan a profile from its images.
    if (barberProfileId) {
      const dir = path.join(UPLOAD_DIR, 'barber', String(tenantId), String(barberProfileId));
      const resolved = path.resolve(dir);
      const root = path.resolve(UPLOAD_DIR);
      if (resolved.startsWith(root + path.sep)) {
        await fsp.rm(resolved, { recursive: true, force: true }).catch((e) => {
          console.error('Account deletion: failed to remove upload dir', resolved, e);
        });
      }
    }

    // Best-effort audit trail in the shared admin DB. audit_log may not exist
    // in every environment, so a failure here must never fail the deletion.
    if (req.adminDb) {
      await req.adminDb
        .query(
          `INSERT INTO audit_log (admin_user_id, action, resource_type, resource_id, changes, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            'account.delete',
            'user',
            userId,
            JSON.stringify({ tenant_id: tenantId, role: effectiveRole, self_service: true }),
            req.ip || null,
          ]
        )
        .catch((e) => console.error('Account deletion: audit_log write skipped:', e.message));
    }

    return res.json({ deleted: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error deleting account:', error);
    return res.status(500).json({ error: (error as Error).message });
  } finally {
    client.release();
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Shorter API running on http://localhost:${PORT}`);
  console.log(`📦 Connected to LOKI PostgreSQL at ${process.env.VITE_LOKI_HOST}:${process.env.VITE_LOKI_PORT}`);
  console.log(`🏢 Multi-tenant mode: Admin DB + per-tenant databases`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await closeTenantPools();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await closeTenantPools();
  process.exit(0);
});
