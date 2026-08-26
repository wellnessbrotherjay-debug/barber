# Barber App - LOKI Production Deployment

## Overview

Complete guide to deploy the barber app as a production systemd service on LOKI with:
- Multi-tenant architecture
- SSL/TLS via Let's Encrypt
- Nginx reverse proxy
- Admin dashboard (owner sees all companies)
- Company dashboards (each barber company sees their data)

## Prerequisites

- SSH access to LOKI server (root@<the server> or via Tailscale <the server, over the private network>)
- Domain name pointing to LOKI IP
- PostgreSQL running on LOKI (port 5432)
- Node.js 18+ installed
- Nginx installed

## Phase 1: Prepare LOKI PostgreSQL

### 1. Create Admin Database

```bash
# SSH to LOKI
ssh root@<the server>

# Connect to PostgreSQL
psql -U postgres

# Create admin database
CREATE DATABASE shorter_app;
\c shorter_app

# Run admin schema
\i /opt/htf/barber-app/docs/ADMIN_DATABASE_SCHEMA.sql

# Verify
\dt
\dv
```

### 2. Create Tenant Database Template

```sql
-- Create template database (one-time)
CREATE DATABASE shorter_template TEMPLATE template0;

\c shorter_template

-- Run barber app schema
\i /opt/htf/barber-app/docs/DATABASE_SCHEMA.sql

-- This template is cloned for each new company
```

### 3. Verify Databases

```bash
psql -U postgres -l | grep barber

# Should show:
# shorter_app           | postgres | UTF8
# shorter_template  | postgres | UTF8
```

## Phase 2: Configure Domain & SSL

### 1. DNS Setup

```bash
# Add A record to your domain registrar
barber.safetykat.com  A  <the server, over the private network>

# Verify
nslookup barber.safetykat.com
```

### 2. Install Certbot & Get Certificate

```bash
# SSH to LOKI
ssh root@<the server>

# Install certbot
apt-get update
apt-get install -y certbot python3-certbot-nginx

# Get certificate
certbot certonly --standalone -d barber.safetykat.com

# Verify certificate
ls -la /etc/letsencrypt/live/barber.safetykat.com/

# Certificate is valid for 90 days, auto-renews
certbot renew --dry-run  # Test renewal
```

## Phase 3: Deploy Barber App

### 1. Copy Application to LOKI

```bash
# From your local machine
cd /Users/jaydengle/barber

# Build
npm run build
npm run build:server

# Deploy to LOKI
ssh root@<the server> 'mkdir -p /opt/htf/barber-app'
scp -r dist root@<the server>:/opt/htf/barber-app/
scp -r docs root@<the server>:/opt/htf/barber-app/
scp package.json package-lock.json root@<the server>:/opt/htf/barber-app/

# Install production dependencies on LOKI
ssh root@<the server> 'cd /opt/htf/barber-app && npm install --production'
```

### 2. Create Environment Configuration

```bash
# SSH to LOKI
ssh root@<the server>

# Create .env.production
cat > /opt/htf/barber-app/.env.production <<'EOF'
NODE_ENV=production
PORT=5000
VITE_LOKI_HOST=localhost
VITE_LOKI_PORT=5432
VITE_LOKI_DATABASE=shorter_app
VITE_LOKI_USER=postgres
VITE_API_URL=https://barber.safetykat.com
VITE_ADMIN_SECRET=your-secret-key-here-change-me
LOG_LEVEL=info
EOF

# Restrict permissions
chmod 600 /opt/htf/barber-app/.env.production
```

### 3. Create Systemd Service

```bash
# SSH to LOKI
ssh root@<the server>

# Create systemd unit file
cat > /etc/systemd/system/barber-app.service <<'EOF'
[Unit]
Description=Barber App Service
Documentation=https://github.com/your-repo/barber-app
After=network-online.target
Wants=network-online.target
PartOf=multi-user.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/opt/htf/barber-app

# Environment
EnvironmentFile=/opt/htf/barber-app/.env.production

# Startup
ExecStart=/usr/bin/node /opt/htf/barber-app/dist/server/index.js

# Restart policy
Restart=on-failure
RestartSec=10
StartLimitInterval=600
StartLimitBurst=10

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=barber-app

# Security
NoNewPrivileges=yes
PrivateTmp=yes

# Resource limits
LimitNOFILE=65536
LimitNPROC=32768

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable barber-app.service
systemctl start barber-app.service

# Check status
systemctl status barber-app.service
journalctl -u barber-app.service -f  # Follow logs
```

## Phase 4: Configure Nginx Reverse Proxy

```bash
# SSH to LOKI
ssh root@<the server>

# Create nginx config
cat > /etc/nginx/sites-available/barber.safetykat.com <<'EOF'
# Redirect HTTP to HTTPS
server {
  listen 80;
  listen [::]:80;
  server_name barber.safetykat.com;

  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }

  location / {
    return 301 https://$server_name$request_uri;
  }
}

# HTTPS server
server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name barber.safetykat.com;

  # SSL Certificate
  ssl_certificate /etc/letsencrypt/live/barber.safetykat.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/barber.safetykat.com/privkey.pem;

  # SSL Configuration
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 10m;

  # Security Headers
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;

  # CORS/API Proxy
  location / {
    proxy_pass http://<the server, over the private network>:5000;
    proxy_http_version 1.1;

    # Headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $server_name;

    # Cookies
    proxy_set_header Cookie $http_cookie;
    proxy_cookie_flags ~ secure httponly samesite=lax;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # WebSocket support (if needed)
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Buffering
    proxy_buffering on;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    proxy_busy_buffers_size 8k;
  }

  # Static files (if serving frontend from nginx)
  location /static/ {
    alias /opt/htf/barber-app/dist/public/;
    expires 30d;
    add_header Cache-Control "public, immutable";
  }

  # Health check
  location /health {
    proxy_pass http://<the server, over the private network>:5000/health;
    access_log off;
  }

  # Logs
  access_log /var/log/nginx/barber.access.log;
  error_log /var/log/nginx/barber.error.log;
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/barber.safetykat.com /etc/nginx/sites-enabled/

# Test nginx config
nginx -t

# Reload nginx
systemctl reload nginx
```

## Phase 5: Verification

### Test API Endpoints

```bash
# Health check
curl https://barber.safetykat.com/health

# Admin dashboard (with API key)
curl -H "Authorization: Bearer <the key from the environment>" \
  -H "X-Admin-Role: true" \
  https://barber.safetykat.com/admin/dashboard

# Company dashboard
curl -H "Authorization: Bearer <the key from the environment>" \
  https://barber.safetykat.com/api/v1/company/dashboard
```

### Check Logs

```bash
# Barber app logs
journalctl -u barber-app.service -n 100

# Nginx logs
tail -f /var/log/nginx/barber.access.log
tail -f /var/log/nginx/barber.error.log

# Database connections
psql -U postgres -d shorter_app \
  "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"
```

### Monitor Service Health

```bash
# Check service status
systemctl status barber-app.service

# Monitor CPU/Memory
watch -n 1 'ps aux | grep node | grep barber'

# Check open files
lsof -p $(pgrep -f "barber-app")
```

## Phase 6: Configure Tenant Databases

### Create New Company

```bash
# API call to admin endpoint
curl -X POST https://barber.safetykat.com/admin/companies \
  -H "Authorization: Bearer <the admin key from the environment>" \
  -H "X-Admin-Role: true" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Elite Barbershop",
    "owner_email": "<an email address>",
    "subscription_tier": "pro",
    "max_barbers": 5
  }'

# Response includes:
# {
#   "id": 2,
#   "name": "Elite Barbershop",
#   "owner_email": "<an email address>",
#   "api_key": "sk_live_...",
#   "subscription_tier": "pro"
# }
```

### Clone Tenant Database

```bash
# SSH to LOKI
ssh root@<the server>

# Clone template for new tenant
psql -U postgres <<'EOF'
CREATE DATABASE a second company's database
  TEMPLATE shorter_template
  OWNER postgres;
EOF

# Verify
psql -U postgres -d a second company's database "\dt"
```

## Phase 7: SSL Certificate Renewal

```bash
# Automatic renewal (certbot cron job)
# Check it's running
systemctl status certbot.timer

# Manual renewal if needed
certbot renew --force-renewal -d barber.safetykat.com

# Post-renewal hook (reload nginx)
# Edit /etc/letsencrypt/renewal/barber.safetykat.com.conf
renew_hook = systemctl reload nginx
```

## Phase 8: Monitoring & Maintenance

### Setup Monitoring

```bash
# Monitor uptime
watch -n 5 'curl -s https://barber.safetykat.com/health | jq .'

# Monitor database connections
psql -U postgres -d shorter_app \
  -c "SELECT * FROM pg_stat_activity WHERE state != 'idle';"

# Monitor API usage
psql -U postgres -d shorter_app \
  "SELECT company_id, COUNT(*) as requests FROM api_key_usage \
   WHERE timestamp > NOW() - INTERVAL '1 hour' \
   GROUP BY company_id ORDER BY requests DESC;"
```

### Backup Strategy

```bash
# Daily backup of all databases
cat > /usr/local/bin/barber-backup.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/barber-app"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup admin DB
pg_dump -U postgres shorter_app | gzip > $BACKUP_DIR/barber_app_$DATE.sql.gz

# Backup all tenant DBs
for db in $(psql -U postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'foundation_barber_%'")
do
  pg_dump -U postgres $db | gzip > $BACKUP_DIR/${db}_$DATE.sql.gz
done

# Keep only last 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete
EOF

chmod +x /usr/local/bin/barber-backup.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/barber-backup.sh") | crontab -
```

### Log Rotation

```bash
# Setup logrotate for nginx
cat > /etc/logrotate.d/barber-app <<'EOF'
/var/log/nginx/barber*.log {
  daily
  missingok
  rotate 14
  compress
  delaycompress
  notifempty
  create 0640 www-data www-data
  sharedscripts
  postrotate
    systemctl reload nginx
  endscript
}
EOF
```

## Production Checklist

- [ ] PostgreSQL admin database created
- [ ] PostgreSQL tenant template created
- [ ] Domain DNS record configured
- [ ] SSL certificate installed (Let's Encrypt)
- [ ] Nginx reverse proxy configured
- [ ] Systemd service created and enabled
- [ ] Environment variables configured
- [ ] Database backups configured
- [ ] Log rotation configured
- [ ] Monitoring alerts configured
- [ ] First company created
- [ ] First tenant database cloned
- [ ] Admin dashboard accessible
- [ ] Company dashboard accessible
- [ ] API key authentication tested
- [ ] SSL certificate auto-renewal verified

## Troubleshooting

### Service Won't Start

```bash
# Check logs
journalctl -u barber-app.service -n 50

# Test connection to database
psql -h localhost -U postgres -d shorter_app \
  "SELECT NOW();"

# Check if port 5000 is in use
netstat -tlnp | grep 5000
```

### Database Connection Error

```bash
# Verify PostgreSQL is running
systemctl status postgresql

# Check if shorter_app database exists
psql -U postgres -c "\l" | grep barber

# Test direct connection
psql -U postgres -d shorter_app -c "SELECT NOW();"
```

### SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in /etc/letsencrypt/live/barber.safetykat.com/cert.pem -text -noout

# Force renewal
certbot renew --force-renewal -d barber.safetykat.com

# Check renewal logs
grep barber /var/log/letsencrypt/letsencrypt.log
```

## Rollback Procedure

```bash
# If deployment fails, rollback:
systemctl stop barber-app.service

# Restore previous version
git -C /opt/htf/barber-app checkout HEAD~1

# Reinstall and restart
cd /opt/htf/barber-app
npm install --production
systemctl start barber-app.service
```

## Support & Debugging

For issues:
1. Check systemd logs: `journalctl -u barber-app.service`
2. Check nginx logs: `tail -f /var/log/nginx/barber.error.log`
3. Check database connections: `psql -c "SELECT * FROM pg_stat_activity;"`
4. Test API directly: `curl -v https://barber.safetykat.com/health`
5. Check environment variables: `cat /opt/htf/barber-app/.env.production`
