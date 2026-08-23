# src/server/ — Express API

Single Express app (`index.ts`) serving the JSON API, the admin API and the built SPA from `dist/`. Runs on LOKI under the platform's process manager. Datastore is **LOKI Postgres only** — one database per tenant company plus a shared admin database.

| File | Purpose |
|---|---|
| `index.ts` | All routes (see below), Stripe wiring (null-safe: 501 until keys exist), SPA fallback, CORS allowlist incl. Capacitor origins |
| `middleware/tenant.ts` | `tenantMiddleware` (verifies the JWT, resolves the tenant Postgres pool onto `req.tenant`), auth guards `requireAdmin`, `requireBarberAuth`, `requireCustomerAuth`, `requireUserAuth`, `requireEntitlement(feature)`, pool management (`getTenantPool`, `closeTenantPools`), `getJwtSecret` |
| `routes/uploads.ts` | Authenticated multipart uploads: avatar, work gallery, verification documents. MIME + magic-byte validation, 8MB cap, ownership-scoped delete/reorder. Files stored on local disk (`UPLOAD_DIR`), served from `/uploads/...` |

## Route groups (all in `index.ts`)

- **Auth:** `POST /api/auth/signup`, `POST /api/auth/login` (bcrypt + JWT)
- **Discovery:** `GET /api/barbers`, `GET /api/barbers/nearby` (SQL earthdistance), `GET /api/barbers/:id`, `GET /api/services`, `GET /api/reviews-by-barber/:barberId`
- **Bookings:** `GET /api/bookings` (customer; reveals `barber_phone` only when confirmed/completed), `GET /api/barber/bookings` (reveals `customer_phone` likewise), `POST /api/bookings`, `POST /api/bookings/:id/accept|complete|cancel` — all ownership-enforced; lifecycle events write notifications
- **Notifications:** `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all` (requireUserAuth; user id from JWT only). Written by `createNotification()` — inserts are non-fatal to the parent action
- **Reviews / issues:** `POST /api/reviews` (completed bookings only), `POST /api/issues`
- **Payments:** `POST /api/payments/create-intent`, `POST /api/payments/webhook` (raw body; both 501 until Stripe keys are configured)
- **Barber self-service:** `/api/barber/status|profile|services|schedule|online|onboarding/complete|verification/*|profile/photos` (all `requireBarberAuth`, own-profile-only)
- **Account:** `DELETE /api/account` (Apple 5.1.1(v): guard, transactional cascade, upload cleanup, audit log)
- **Admin:** `/admin/*` (all `requireAdmin`): dashboard, companies CRUD/status, per-company bookings/barbers/payments/onboarding, verification approve/reject, income
- **Company API:** `/api/v1/company/*` (API-key tenant access)

## Security rules (do not regress)

- Caller identity comes from the verified JWT (`req.tenant.userId`) — never from body or headers.
- Every mutation is ownership-scoped in SQL (`WHERE ... AND barber_id = $own` etc.).
- New endpoints must use one of the `require*` guards.
- Contact details (phone) are revealed cross-party only after booking acceptance.
