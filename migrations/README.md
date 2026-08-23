# migrations/

SQL migrations for the per-tenant barber databases (LOKI Postgres).

| File | Purpose |
|---|---|
| `002_barber_production.sql` | Production hardening migration: barber profile columns (service mode, radius, buffer, online status, onboarding step, verification status enum), schedule, verification documents, photos, issue reports, indexes |

Reference schemas live in `docs/DATABASE_SCHEMA.sql` (tenant DB: users, barber_profiles, services, bookings, reviews, payments, barber_schedule, notifications) and `docs/ADMIN_DATABASE_SCHEMA.sql` (companies, entitlements, audit_log).

Apply migrations manually per tenant database — there is no migration runner. Never point anything at Supabase; `supabase_schema.sql` at the repo root is a historical artifact only.
