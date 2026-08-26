# Barber App - Production Deployment Quick Start

## Complete the Barber SaaS Platform in 6 Steps

### Step 1: Setup LOKI PostgreSQL (20 min)
```bash
# SSH to LOKI
ssh root@100.84.100.96

# Create admin database
createdb shorter_app

# Apply admin schema
psql -U postgres -d shorter_app < /path/to/docs/ADMIN_DATABASE_SCHEMA.sql

# Create tenant template
createdb shorter_template
psql -U postgres -d shorter_template < /path/to/docs/DATABASE_SCHEMA.sql

# Verify
psql -U postgres -l | grep barber
```

### Step 2: Configure Domain & SSL (15 min)
```bash
# On LOKI:

# 1. Certbot (get SSL certificate)
apt-get install certbot python3-certbot-nginx
certbot certonly --standalone -d barber.safetykat.com

# 2. Verify certificate
ls -la /etc/letsencrypt/live/barber.safetykat.com/

# 3. Confirm DNS points to LOKI
# barber.safetykat.com A 75.119.140.69
nslookup barber.safetykat.com
```

### Step 3: Deploy Application (15 min)
```bash
# On local machine:
cd /Users/jaydengle/barber

# Build
npm run build
npm run build:server

# Deploy to LOKI
ssh root@100.84.100.96 'mkdir -p /opt/htf/barber-app'
scp -r dist root@100.84.100.96:/opt/htf/barber-app/
scp -r docs root@100.84.100.96:/opt/htf/barber-app/
scp package.json package-lock.json root@100.84.100.96:/opt/htf/barber-app/

# Install deps on LOKI
ssh root@100.84.100.96 'cd /opt/htf/barber-app && npm install --production'
```

### Step 4: Configure Environment & Service (10 min)
```bash
# On LOKI:

# Create .env.production
cat > /opt/htf/barber-app/.env.production <<'EOF'
NODE_ENV=production
PORT=5000
VITE_LOKI_HOST=localhost
VITE_LOKI_PORT=5432
VITE_LOKI_DATABASE=shorter_app
VITE_LOKI_USER=postgres
VITE_API_URL=https://barber.safetykat.com
EOF

chmod 600 /opt/htf/barber-app/.env.production

# Create systemd service (copy from LOKI_PRODUCTION_DEPLOY.md)
# Then:
systemctl daemon-reload
systemctl enable barber-app.service
systemctl start barber-app.service
systemctl status barber-app.service
```

### Step 5: Configure Nginx (10 min)
```bash
# On LOKI:

# Create nginx config (copy full config from LOKI_PRODUCTION_DEPLOY.md)
cat > /etc/nginx/sites-available/barber.safetykat.com << 'EOF'
# [see LOKI_PRODUCTION_DEPLOY.md for full config]
EOF

# Enable and test
ln -s /etc/nginx/sites-available/barber.safetykat.com /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Step 6: Verify & Test (10 min)
```bash
# Test API
curl https://barber.safetykat.com/health
# Should return: {"status":"ok","timestamp":"..."}

# Create first company (replace with your email)
curl -X POST https://barber.safetykat.com/admin/companies \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  -H "X-Admin-Role: true" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Barbershop",
    "owner_email": "test@example.com",
    "subscription_tier": "pro"
  }'

# Should return company data with api_key

# Access admin dashboard
open https://barber.safetykat.com/admin/dashboard
```

---

## What's Live After Deployment

### ✅ Customer App
- Browse barbers
- Book appointments
- Leave reviews
- Booking history

### ✅ Admin Dashboard (Owner Sees All)
- All companies
- All bookings
- Global revenue
- Metrics & reports

### ✅ Company Dashboards (Each Barber Owner)
- Their bookings
- Their income (30-day)
- Their barbers
- Their settings

### ✅ Multi-Tenant Infrastructure
- Per-company databases
- API key authentication
- Feature gating (starter/pro/enterprise)
- Audit logging

---

## Post-Deployment Checklist

- [ ] LOKI PostgreSQL setup complete
- [ ] Domain DNS configured
- [ ] SSL certificate installed
- [ ] Application deployed to LOKI
- [ ] Systemd service running
- [ ] Nginx reverse proxy working
- [ ] Health check passing
- [ ] Admin endpoint accessible
- [ ] First company created
- [ ] First tenant database cloned
- [ ] Admin dashboard loads
- [ ] Company dashboard loads
- [ ] SSL certificate auto-renewal verified
- [ ] Database backups configured
- [ ] Monitoring/alerting configured

---

## Key URLs After Deployment

```
HTTPS Frontend:    https://barber.safetykat.com
Health Check:      https://barber.safetykat.com/health
Admin Dashboard:   https://barber.safetykat.com/admin/dashboard
Company Dashboard: https://barber.safetykat.com/api/v1/company/dashboard
API Docs:          See MULTITENANT_ARCHITECTURE.md
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Service won't start | `journalctl -u barber-app.service` |
| DB connection error | `psql -U postgres -d shorter_app "SELECT NOW();"` |
| SSL error | Check `/etc/letsencrypt/live/barber.safetykat.com/` |
| Nginx 502 | Check backend: `curl localhost:5000/health` |
| API key not working | Verify company in: `psql -d shorter_app "SELECT * FROM companies;"` |

---

## Full Documentation

For complete details, see:
- `docs/MULTITENANT_ARCHITECTURE.md` - Technical design
- `docs/LOKI_PRODUCTION_DEPLOY.md` - Detailed deployment guide
- `docs/MULTITENANT_PROJECT_STATUS.md` - Project overview

---

## Live Metrics Dashboard

After deployment, monitor at:
```bash
# Watch service logs
ssh root@100.84.100.96
journalctl -u barber-app.service -f

# Watch nginx access
tail -f /var/log/nginx/barber.access.log

# Watch database connections
watch -n 5 'psql -U postgres -d shorter_app -c "SELECT count(*) as connections FROM pg_stat_activity;"'

# Watch API usage
psql -U postgres -d shorter_app \
  "SELECT company_id, COUNT(*) as requests FROM api_key_usage WHERE timestamp > NOW() - INTERVAL '1 hour' GROUP BY company_id;"
```

---

## Scale to 100+ Barber Companies

Each company:
1. Gets their own database (`the company's own database (see companies.database_name)`)
2. Gets their own API key
3. Has their own dashboard
4. Pays monthly based on tier (starter/pro/enterprise)
5. Sees only their data

Platform handles it all automatically via tenant middleware.

---

## Ready to Deploy! 🚀

All code, databases, documentation, and systemd configs are ready.

**Estimated time to production: 90 minutes**

Follow the 6 steps above, and you'll have a fully-functional multi-tenant barber booking SaaS platform running on LOKI with SSL, monitoring, and support for 100+ barber companies.

Start with Step 1!
