# docs/

Project documentation. **Start with `SCOPE_RECONCILIATION.md`** — it is the contract-vs-Figma-vs-built gap analysis and governs what gets built vs quoted as a change order.

| File | Purpose |
|---|---|
| `SCOPE_RECONCILIATION.md` | Delivered / outstanding / change-order classification against the contract and the locked Figma spec |
| `figma-pdf-index.md` | Index of the 63-frame approved Figma export (the locked specification) |
| `figma-screen-map.txt` | Frame-to-implemented-screen mapping |
| `DATABASE_SCHEMA.sql` | Reference schema for each tenant database (users, barber_profiles, services, bookings, reviews, payments, barber_schedule, notifications) |
| `ADMIN_DATABASE_SCHEMA.sql` | Shared admin database schema (companies, entitlements, audit_log) |
| `MULTITENANT_ARCHITECTURE.md` | One-DB-per-tenant design: tenant resolution, pools, API-key company access |
| `MULTITENANT_PROJECT_STATUS.md` / `PROJECT_STATUS.md` | Historical status snapshots |
| `LOKI_SETUP_GUIDE.md` / `LOKI_PRODUCTION_DEPLOY.md` | Server setup and production deploy runbooks (LOKI). Production actions need explicit approval |
| `STRIPE_SETUP.md` | What is needed from the client to enable the booking-fee payment (keys, webhook secret); endpoints return 501 until then |
