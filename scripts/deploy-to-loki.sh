#!/bin/bash
# Deploy Barber App Database to LOKI PostgreSQL via Tailscale

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🚀 Barber App - LOKI Database Deployment${NC}"

# Default to Tailscale IP (secure private network)
LOKI_HOST=${LOKI_HOST:-100.84.100.96}
LOKI_USER=${LOKI_USER:?LOKI_USER must be set - the superuser is never used (RULES_NEVER_POSTGRES_USER); use the application role}
LOKI_PASSWORD=${LOKI_PASSWORD:-}
LOKI_PORT=${LOKI_PORT:-5432}
LOKI_DB=${LOKI_DB:-shorter_admin}

# Check required variables
if [ -z "$LOKI_PASSWORD" ]; then
  echo -e "${RED}❌ LOKI_PASSWORD environment variable required${NC}"
  echo ""
  echo "Usage:"
  echo "  LOKI_PASSWORD='your-password' ./scripts/deploy-to-loki.sh"
  echo ""
  echo "Optional:"
  echo "  LOKI_HOST=100.84.100.96 (default: Tailscale private IP)"
  echo "  LOKI_USER=<the application role - never the superuser>"
  echo "  LOKI_PORT=5432 (default)"
  echo "  LOKI_DB=shorter_admin (default)"
  exit 1
fi

echo -e "${GREEN}✓${NC} Using LOKI: $LOKI_HOST:$LOKI_PORT (Tailscale private network)"

# Test connection
echo -e "${YELLOW}Testing connection to LOKI...${NC}"
PGPASSWORD="$LOKI_PASSWORD" psql -h "$LOKI_HOST" -p "$LOKI_PORT" -U "$LOKI_USER" -d postgres -c "SELECT version();" > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓${NC} Connection successful"
else
  echo -e "${RED}❌ Connection failed${NC}"
  exit 1
fi

# Create database
echo -e "${YELLOW}Creating database: $LOKI_DB${NC}"
PGPASSWORD="$LOKI_PASSWORD" psql -h "$LOKI_HOST" -p "$LOKI_PORT" -U "$LOKI_USER" -d postgres -c "CREATE DATABASE $LOKI_DB;" 2>/dev/null || echo "Database already exists"

# Run schema migration
echo -e "${YELLOW}Deploying schema...${NC}"
if [ ! -f "docs/DATABASE_SCHEMA.sql" ]; then
  echo -e "${RED}❌ Schema file not found: docs/DATABASE_SCHEMA.sql${NC}"
  exit 1
fi

PGPASSWORD="$LOKI_PASSWORD" psql -h "$LOKI_HOST" -p "$LOKI_PORT" -U "$LOKI_USER" -d "$LOKI_DB" -f "docs/DATABASE_SCHEMA.sql"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓${NC} Schema deployed successfully"
else
  echo -e "${RED}❌ Schema deployment failed${NC}"
  exit 1
fi

# Verify deployment
echo -e "${YELLOW}Verifying tables...${NC}"
TABLE_COUNT=$(PGPASSWORD="$LOKI_PASSWORD" psql -h "$LOKI_HOST" -p "$LOKI_PORT" -U "$LOKI_USER" -d "$LOKI_DB" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")

echo -e "${GREEN}✓${NC} Database ready with $TABLE_COUNT tables"

# Summary
echo ""
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo ""
echo "Database Configuration:"
echo "  Host: $LOKI_HOST"
echo "  Port: $LOKI_PORT"
echo "  Database: $LOKI_DB"
echo "  User: $LOKI_USER"
echo ""
echo "Next steps:"
echo "  1. Update .env.local with LOKI credentials"
echo "  2. Run: npm run build"
echo "  3. Deploy to production with: pm2 start dist/server/index.js"
echo ""
