# Backend API Setup & Development

## Overview
Express.js backend server running on Node.js that connects the barber app frontend to LOKI PostgreSQL database.

## Prerequisites
- Node.js 18+ (check: `node --version`)
- npm/pnpm (check: `npm --version`)
- LOKI PostgreSQL database running (see [LOKI_SETUP_GUIDE.md](./docs/LOKI_SETUP_GUIDE.md))
- Tailscale connection to LOKI (100.84.100.96)

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create `.env.local` file in project root (git-ignored):
```bash
# LOKI PostgreSQL Connection
VITE_LOKI_HOST=100.84.100.96
VITE_LOKI_PORT=5432
VITE_LOKI_DATABASE=shorter_app
VITE_LOKI_USER=postgres
VITE_LOKI_PASSWORD=<your-postgres-password>

# API Configuration
VITE_API_URL=http://localhost:5000
PORT=5000
```

### 3. Run Backend Server
```bash
npm run dev:server
```

Expected output:
```
🚀 Barber App API running on http://localhost:5000
📦 Connected to LOKI PostgreSQL at 100.84.100.96:5432/shorter_app
```

### 4. Run Frontend (in another terminal)
```bash
npm run dev
```

Frontend will run on: `http://localhost:3000`

## API Endpoints

### Barbers
```
GET    /api/barbers              - List all barbers
GET    /api/barbers/:id          - Get single barber with services & reviews
GET    /api/barbers/:id/reviews  - Get reviews for barber
```

### Bookings
```
GET    /api/bookings             - Get user's bookings (requires x-user-id header)
POST   /api/bookings             - Create new booking
POST   /api/bookings/:id/accept  - Accept booking request (barber)
POST   /api/bookings/:id/complete - Complete booking
```

### Reviews
```
POST   /api/reviews              - Create review/rating
GET    /api/barbers/:id/reviews  - Get barber reviews
```

### Services
```
GET    /api/services             - List all services
```

### Health
```
GET    /health                   - Server health check
GET    /api/health               - Database connection check
```

## Development Workflow

### Terminal 1: Backend
```bash
npm run dev:server
# Server watches for changes and auto-restarts
```

### Terminal 2: Frontend
```bash
npm run dev
# Frontend runs with HMR (hot module replacement)
```

### Testing API Endpoints
```bash
# Get all barbers
curl http://localhost:5000/api/barbers

# Get specific barber
curl http://localhost:5000/api/barbers/b1

# Create booking
curl -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -H "x-user-id: customer-id" \
  -d '{
    "customer_id": "customer-id",
    "barber_id": "b1",
    "service_id": "s1",
    "booking_date": "2026-08-15",
    "start_time": "10:00"
  }'

# Get bookings
curl -H "x-user-id: customer-id" http://localhost:5000/api/bookings
```

## Database Connection

### Check Database
```bash
# From any machine with Tailscale access:
psql -h 100.84.100.96 -U postgres -d shorter_app

# List tables
\dt

# View barbers
SELECT id, display_name, shop_name FROM barber_profiles;

# View bookings
SELECT * FROM bookings;
```

## Deployment

### Build for Production
```bash
npm run build
npm run build:server
```

### Run on LOKI Server
```bash
# Copy to LOKI
scp -r dist root@100.84.100.96:/opt/barber-app

# SSH into LOKI
ssh root@100.84.100.96

# Start with PM2 or systemd
pm2 start dist/server/index.js --name barber-api
```

## Troubleshooting

### Connection Refused
```
Error: connect ECONNREFUSED 100.84.100.96:5432

Solution:
- Check Tailscale is connected: tailscale status
- Verify VITE_LOKI_PASSWORD is set correctly
- Check LOKI PostgreSQL is running: psql -h 100.84.100.96 -U postgres
```

### Environment Variables Not Loading
```
Error: Cannot read property 'VITE_LOKI_HOST' of undefined

Solution:
- Create .env.local file in project root
- Restart backend server: npm run dev:server
- Check file is not .gitignored (it should be)
```

### CORS Errors in Frontend
```
Error: Access to XMLHttpRequest blocked by CORS

Solution:
- Backend has CORS enabled for all origins in dev
- Check VITE_API_URL is correctly set (http://localhost:5000)
- Check backend is running on correct port
```

### Database Connection Pool Exhausted
```
Error: Client is unable to acquire a connection from the pool within the specified time

Solution:
- Increase pool size in src/server/index.ts
- Close idle connections
- Check for connection leaks in error handlers
```

## Architecture

```
┌─────────────────────────────────────┐
│        React Frontend               │
│    (http://localhost:3000)          │
└──────────────────┬──────────────────┘
                   │ HTTP API calls
                   │
┌──────────────────▼──────────────────┐
│      Express.js Backend             │
│     (http://localhost:5000)         │
├──────────────────────────────────────┤
│ - Route handlers                    │
│ - Request/response middleware       │
│ - Database query builders           │
│ - Error handling                    │
└──────────────────┬──────────────────┘
                   │ SQL queries
                   │ (Tailscale)
┌──────────────────▼──────────────────┐
│   LOKI PostgreSQL Database          │
│  (100.84.100.96:5432)               │
├──────────────────────────────────────┤
│ - 9 tables with indexes             │
│ - Seed data (barbers, services)     │
│ - Triggers for audit trail          │
└──────────────────────────────────────┘
```

## File Structure
```
src/
├── server/
│   └── index.ts          # Express app with API endpoints
├── services/
│   └── api.ts            # Frontend API client for backend
├── features/
│   ├── customer/         # Customer UI components (using real API)
│   └── barber/           # Barber UI components (using real API)
└── ...
```

## Next Steps

1. ✅ Install dependencies
2. ✅ Set up `.env.local` with LOKI credentials  
3. ✅ Start backend: `npm run dev:server`
4. ✅ Start frontend: `npm run dev`
5. ⏳ Test API endpoints (see Testing section)
6. ⏳ Wire frontend components to real API (BrowseBarbers, BookingFlow, etc.)
7. ⏳ Test end-to-end booking flow
8. ⏳ Deploy to production on LOKI

## Support

For issues, check:
1. [LOKI_SETUP_GUIDE.md](./docs/LOKI_SETUP_GUIDE.md#troubleshooting) - Database issues
2. Logs: `npm run dev:server` console output
3. Network: Verify Tailscale connected (`tailscale status`)
4. Database: Test connection (`psql -h 100.84.100.96 -U postgres`)
