# LOKI PostgreSQL Backend Setup Guide

## Overview
This guide walks through setting up the barber app backend on LOKI PostgreSQL for production deployment.

## Prerequisites
- SSH access to LOKI: `root@75.119.140.69` (port 22)
- OR Tailscale access: `100.84.100.96` (key auth)
- PostgreSQL 13+ installed on LOKI
- psql CLI tools available

## Step 1: Connect to LOKI and Create Database

```bash
# SSH into LOKI
ssh root@75.119.140.69

# Or via Tailscale (if configured)
ssh root@100.84.100.96

# Create barber app database
psql -U postgres -c "CREATE DATABASE shorter_app;"

# Verify creation
psql -U postgres -l | grep shorter_app
```

## Step 2: Deploy Database Schema

```bash
# From your local machine, copy schema to LOKI
scp docs/DATABASE_SCHEMA.sql root@75.119.140.69:/tmp/

# Connect to LOKI and run schema
ssh root@75.119.140.69

# Run the schema migration
psql -U postgres -d shorter_app -f /tmp/DATABASE_SCHEMA.sql

# Verify tables were created
psql -U postgres -d shorter_app -c "\dt"
```

## Step 3: Configure Application Environment

### Create .env.local (DO NOT commit to git)

```bash
# Generate strong JWT secret
openssl rand -base64 32
# Save the output

# Create .env.local with:
VITE_LOKI_HOST=75.119.140.69
VITE_LOKI_PORT=5432
VITE_LOKI_DATABASE=shorter_app
VITE_LOKI_USER=postgres
VITE_LOKI_PASSWORD=<your-postgres-password>
VITE_JWT_SECRET=<generated-secret-from-above>
VITE_APP_URL=http://barber.htf.solutions
VITE_API_URL=http://localhost:5000
```

### Security Notes
- Store passwords in `.env.local` (git-ignored)
- Never commit secrets to version control
- Use strong passwords (20+ characters, mixed case, numbers, symbols)

## Step 4: Set Up Application Backend

### Option A: Node.js/Express Backend (Recommended)

```bash
# Install dependencies
npm install pg express cors dotenv

# Create src/server/index.ts with PostgreSQL client
```

### Option B: Use Supabase Library (Easier Integration)

If using Supabase library pointing to LOKI PostgreSQL:

```bash
npm install @supabase/supabase-js

# In your code:
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'postgresql://postgres:password@75.119.140.69:5432/shorter_app',
  'your-jwt-secret'
)
```

## Step 5: Test Database Connection

```bash
# Create a simple test script (src/lib/test-db.ts)
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_LOKI_HOST,
  process.env.VITE_JWT_SECRET
)

async function testConnection() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Connection failed:', error)
    return false
  }
  console.log('✅ Database connection successful')
  return true
}

testConnection()
```

Run the test:
```bash
npx ts-node src/lib/test-db.ts
```

## Step 6: Deploy to Production

### Build for Production
```bash
npm run build
```

### Copy to LOKI Server
```bash
# Copy build output to LOKI
scp -r dist/* root@75.119.140.69:/var/www/barber-app/

# Setup systemd service or PM2
```

### Run on LOKI with Systemd
```bash
# Create /etc/systemd/system/barber-app.service
[Unit]
Description=Barber App Backend
After=network.target postgresql.service

[Service]
Type=simple
User=app
WorkingDirectory=/opt/barber-app
EnvironmentFile=/opt/barber-app/.env
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target

# Enable and start
systemctl enable barber-app
systemctl start barber-app
systemctl status barber-app
```

### Run on LOKI with PM2
```bash
# On LOKI server
pm2 start dist/server/index.js --name "barber-app" --env production
pm2 save
pm2 startup
```

## Step 7: Verify Production Deployment

```bash
# Check application is running
curl http://75.119.140.69:5000/health

# Check database connectivity
curl http://75.119.140.69:5000/api/barbers

# Monitor logs
pm2 logs barber-app
# OR
journalctl -u barber-app -f
```

## Environment Variables Reference

| Variable | Value | Notes |
|----------|-------|-------|
| VITE_LOKI_HOST | 75.119.140.69 | LOKI PostgreSQL server IP |
| VITE_LOKI_PORT | 5432 | PostgreSQL default port |
| VITE_LOKI_DATABASE | shorter_app | Database name (must exist) |
| VITE_LOKI_USER | postgres | PostgreSQL user (can create custom user) |
| VITE_LOKI_PASSWORD | (secret) | PostgreSQL password |
| VITE_JWT_SECRET | (secret) | Used for signing JWTs |
| VITE_APP_URL | http://barber.htf.solutions | Frontend URL |
| VITE_API_URL | http://localhost:5000 | Backend API URL |

## Troubleshooting

### Connection Refused
```
Error: connect ECONNREFUSED 75.119.140.69:5432

Solution:
- Verify PostgreSQL is running: systemctl status postgresql
- Check firewall: sudo ufw allow 5432
- Verify IP address and port in .env
```

### Permission Denied
```
Error: role "postgres" does not exist

Solution:
- Verify user exists: psql -U postgres -l
- Create user if needed: createuser postgres
- Grant privileges: ALTER ROLE postgres CREATEDB
```

### Authentication Failed
```
Error: password authentication failed

Solution:
- Reset PostgreSQL password: sudo -u postgres psql
- ALTER USER postgres WITH PASSWORD 'newpassword';
- Update .env.local with new password
```

### RLS Policies Not Working
```
Solution:
- RLS requires authenticated user context
- Ensure auth.uid() is set in application
- Test with: SELECT * FROM users WHERE auth.uid() = id;
```

## Next Steps

1. ✅ Create database on LOKI
2. ✅ Deploy schema with RLS policies
3. ✅ Configure application environment
4. ⏳ Build backend API (Phase 4)
5. ⏳ Wire API calls in frontend components
6. ⏳ Test end-to-end booking flow
7. ⏳ Set up monitoring and alerting

## Support

For LOKI access issues, contact your infrastructure team.
For database schema questions, refer to DATABASE_SCHEMA.sql comments.
