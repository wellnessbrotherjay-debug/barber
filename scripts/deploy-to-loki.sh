#!/bin/bash
# Deploy Barber App Database to LOKI PostgreSQL via Tailscale

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🚀 Barber App - LOKI Database Deployment${NC}"

# Nothing about the destination is written into this script. A default host is
# how a deployment silently lands on the wrong machine, and the address of a
# server is not something a repository should carry.
LOKI_HOST=${LOKI_HOST:?LOKI_HOST must be set - this script never assumes which server it is talking to}
LOKI_USER=${LOKI_USER:?LOKI_USER must be set - the superuser is never used (RULES_NEVER_POSTGRES_USER); use the application role}
LOKI_PASSWORD=${LOKI_PASSWORD:-}
LOKI_PORT=${LOKI_PORT:?LOKI_PORT must be set}
LOKI_DB=${LOKI_DB:?LOKI_DB must be set - name the database you mean}

# Check required variables
if [ -z "$LOKI_PASSWORD" ]; then
  echo -e "${RED}❌ LOKI_PASSWORD environment variable required${NC}"
  echo ""
  echo "Usage:"
  echo "  LOKI_PASSWORD=... LOKI_HOST=... LOKI_USER=... LOKI_PORT=... LOKI_DB=... ./scripts/deploy-to-loki.sh"
  echo ""
  echo "Optional:"
  echo "  LOKI_HOST=<the server, over the private network>"
  echo "  LOKI_USER=<the application role - never the superuser>"
  echo "  LOKI_PORT=<the database port>"
  echo "  LOKI_DB=<the database to deploy into>"
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
# THE SCHEMA IS THE MIGRATIONS, IN ORDER. This used to apply a hand-kept copy in
# docs/ that had drifted two tables behind the real database - so a database
# built by this script was not the database the application expects.
if [ ! -d "migrations" ]; then
  echo -e "${RED}Schema folder not found: migrations/${NC}"
  exit 1
fi

for MIGRATION in migrations/*.sql; do
  echo -e "${YELLOW}applying $(basename "$MIGRATION")${NC}"
  PGPASSWORD="$LOKI_PASSWORD" psql -h "$LOKI_HOST" -p "$LOKI_PORT" -U "$LOKI_USER" -d "$LOKI_DB" -v ON_ERROR_STOP=1 -f "$MIGRATION" || exit 1
done
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
