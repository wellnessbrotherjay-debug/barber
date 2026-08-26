# Barber App Multi-Tenant Architecture

## Overview

The barber app operates as a **standalone module** on LOKI with **per-tenant database isolation** following HTF architecture rules.

- **Shared Admin DB**: `shorter_app` on LOKI (companies, API keys, subscriptions)
- **Per-Tenant DBs**: `foundation_barber_<company_id>` on LOKI (barbers, bookings, reviews, payments)
- **Authentication**: 
  - **Admin/Owner**: SSO via UnifiedLogin (httpOnly cookie)
  - **Barber Companies**: API Key + Bearer token
  - **Customers**: Session-based (per tenant)

## Tenant Routing

### Request Flow

```
Client Request
    ↓
Nginx (reverse proxy, SSL)
    ↓
Express Backend (localhost:5000)
    ↓
Tenant Detection Middleware
    ├─ SSO Cookie? → Load admin session → /admin/* routes
    ├─ API Key header? → Load company → /api/v1/* routes (API)
    └─ Session token? → Load customer → /customer/* routes
    ↓
Per-Tenant Database Pool
    ↓
Response
```

### Admin Routes (SSO Protected)
```
GET  /admin                      → Admin dashboard (owner sees all)
GET  /admin/companies            → List all barber companies
POST /admin/companies            → Create new company
GET  /admin/companies/:id        → Company details
GET  /admin/bookings             → All bookings across all companies
GET  /admin/income               → Income reports (all companies)
GET  /admin/settings             → Global settings
```

### API Routes (API Key Protected)
```
GET  /api/v1/barbers             → Company's barbers
POST /api/v1/bookings            → Create booking
GET  /api/v1/bookings            → Company's bookings
GET  /api/v1/income              → Company's income
POST /api/v1/income/export       → Download income reports
```

### Customer Routes (Session Protected)
```
GET  /customer/dashboard         → Customer bookings & history
GET  /customer/bookings/:id      → Booking details
POST /customer/reviews           → Submit review
```

## Database Schema

### Shared Admin DB (`shorter_app`)

```sql
-- Companies/Tenants
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_email VARCHAR(255) NOT NULL UNIQUE,
  api_key UUID NOT NULL UNIQUE,
  subscription_tier VARCHAR(50) DEFAULT 'starter',  -- starter, pro, enterprise
  status VARCHAR(50) DEFAULT 'active',  -- active, suspended, canceled
  createddate TIMESTAMP DEFAULT NOW(),
  modifieddate TIMESTAMP DEFAULT NOW()
);

-- API Key Audit Log
CREATE TABLE api_key_usage (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id),
  endpoint VARCHAR(255),
  method VARCHAR(10),
  status_code INTEGER,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

### Per-Tenant DB (`foundation_barber_<company_id>`)

Inherits the barber app schema:
- users
- barber_profiles
- services
- bookings
- reviews
- payments
- barber_schedule
- notifications
- service_categories

Plus new tables:
```sql
-- Company Income Ledger
CREATE TABLE income_ledger (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER REFERENCES bookings(id),
  barber_id INTEGER REFERENCES barber_profiles(id),
  amount DECIMAL(10, 2) NOT NULL,
  fee_amount DECIMAL(10, 2),
  net_amount DECIMAL(10, 2),
  ledger_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',  -- pending, processed, paid
  createddate TIMESTAMP DEFAULT NOW(),
  modifieddate TIMESTAMP DEFAULT NOW()
);

-- Subscription/Entitlements
CREATE TABLE company_entitlements (
  id SERIAL PRIMARY KEY,
  feature VARCHAR(255) NOT NULL,  -- 'custom_branding', 'api_access', 'advanced_reports'
  enabled BOOLEAN DEFAULT FALSE,
  createddate TIMESTAMP DEFAULT NOW()
);
```

## Connection Pooling

Each tenant connection uses a **fail-closed pool**:

```typescript
// No tenant context = throw immediately, don't default to shared DB
async function getTenantPool(tenantId: string): Promise<Pool> {
  if (!tenantId) throw new Error('Tenant context required');
  
  const dbName = `companies.database_name`;
  const pool = new Pool({
    host: process.env.LOKI_HOST,
    port: parseInt(process.env.LOKI_PORT),
    database: dbName,
    user: process.env.LOKI_USER,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
  
  // Test connection immediately
  try {
    const client = await pool.connect();
    client.release();
  } catch (err) {
    pool.end();
    throw new Error(`Tenant DB ${dbName} unreachable: ${err.message}`);
  }
  
  return pool;
}
```

## API Key Management

Barber companies receive API keys for programmatic access:

```typescript
// Generate API key
POST /admin/companies/:id/api-keys
→ Returns: { apiKey: <the company key, read from configuration>, secret: "...", expiresAt: "2027-07-30" }

// Rotate API key
POST /admin/companies/:id/api-keys/rotate
→ Returns: { newApiKey: <the company key, read from configuration>, old: "sk_live_..." }

// Revoke API key
DELETE /admin/companies/:id/api-keys/:keyId
```

## Entitlements (Feature Gating)

```typescript
// Check entitlement before serving feature
async function requireEntitlement(companyId, feature) {
  const adminDb = getAdminPool();
  const result = await adminDb.query(
    'SELECT enabled FROM company_entitlements WHERE company_id=$1 AND feature=$2',
    [companyId, feature]
  );
  
  if (!result.rows[0]?.enabled) {
    return res.status(402).json({ error: 'Feature not entitled', feature });
  }
}

// Usage
router.get('/api/v1/income/export', async (req, res) => {
  await requireEntitlement(req.tenant.companyId, 'advanced_reports');
  // ... export logic
});
```

## Deployment

### Prerequisites
- LOKI PostgreSQL with `shorter_app` database created
- Per-tenant database templates or factory
- Domain configured (DNS A record pointing to LOKI)
- SSL certificate (Let's Encrypt)

### Systemd Service
```ini
[Unit]
Description=Barber App Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/htf/barber-app
ExecStart=/usr/bin/node dist/server/index.js
Environment="NODE_ENV=production"
Environment="LOKI_HOST=localhost"
Environment="LOKI_PORT=5432"
Environment="LOKI_DATABASE=shorter_app"
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Nginx Reverse Proxy
```nginx
upstream barber_backend {
  server <the server, over the private network>:5000;
}

server {
  listen 443 ssl http2;
  server_name barber.safetykat.com;
  
  ssl_certificate /etc/letsencrypt/live/barber.safetykat.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/barber.safetykat.com/privkey.pem;
  
  location / {
    proxy_pass http://barber_backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Cookie $http_cookie;
  }
}

server {
  listen 80;
  server_name barber.safetykat.com;
  return 301 https://$host$request_uri;
}
```

## Security

### Tenant Isolation

1. **No tenant ID in JWT** - use server-issued session cookie or API key
2. **Per-tenant DB lookup** - fetch company from admin DB before querying tenant DB
3. **API Key rotation** - require rotation every 90 days
4. **Rate limiting** - per API key (1000 req/min for starter, 10k/min for enterprise)
5. **Audit logging** - all API key usage logged to `api_key_usage`

### CORS & Headers

```typescript
// Allow barber company origins only
const allowedOrigins = ['<the site address, from configuration>', 'https://api.barber.safetykat.com'];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
    },
  },
}));
```

## Monitoring

### Key Metrics
- Active tenants
- API key usage (requests/sec per tenant)
- Booking volume (per tenant)
- Income processed (per tenant)
- Database connection pool health
- SSL certificate expiry

### Alerts
- Tenant DB connection failure
- API key exhausted rate limit
- High latency (>1s p99)
- SSL certificate expiring <30 days

## Migration Path

When David's `/empire/barber` plugin API is ready, migrate:
```
Express Backend (LOKI/freyja direct) 
    ↓
Plugin API Layer (`/empire/barber/<TService>/<Method>`)
    ↓
Delphi Plugins (Foundation functions)
    ↓
Same LOKI/freyja databases
```

No UI changes needed - just backend rewiring.
