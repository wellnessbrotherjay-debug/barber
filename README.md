# Shorter — barber booking platform

On-demand barber marketplace (working name "Shorter"). Customers find nearby barbers on a map, request a booking, pay a small booking fee, and pay for the haircut directly at the appointment. Barbers manage availability, services, verification and jobs. The approved **Figma 63-frame export is the locked specification** — see `docs/SCOPE_RECONCILIATION.md`, `docs/figma-pdf-index.md` and `docs/figma-screen-map.txt`.

Production: `barber.safetykat.com` (LOKI). Datastore is **LOKI Postgres only** (multi-tenant, one DB per tenant company). No Supabase, no Resend, no Vercel in this codebase.

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind, React Router, Zustand. Leaflet/OpenStreetMap for maps.
- **Backend:** Express (TypeScript, `src/server/`), JWT auth (bcrypt), multi-tenant Postgres pools, Stripe (booking fee — 501 until client keys arrive).
- **Native:** Capacitor iOS shell in `ios/` (`npm run build:ios`). Android not yet generated.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on :3000 |
| `npm run dev:server` | Express API via tsx watch |
| `npm run build` | Production web build to `dist/` |
| `npm run build:ios` | Build with prod API URL + `cap sync ios` |
| `npm run lint` | `tsc --noEmit` typecheck |

## Feature map

| Area | Status | Where |
|---|---|---|
| Auth (signup/login, roles: customer/barber/admin) | Done | `src/features/auth/`, `src/server/index.ts`, `src/server/middleware/tenant.ts` |
| Barber onboarding (multi-step, resumable) | Done | `src/features/barber/BarberOnboarding.tsx` |
| Verification docs upload + admin review | Done | `src/server/routes/uploads.ts`, `src/features/admin/` |
| Barber profile, services, schedule, online status | Done | `src/features/barber/`, `/api/barber/*` |
| Avatar + work gallery uploads | Done | `src/server/routes/uploads.ts` |
| Geo discovery (SQL distance, radius, pagination) | Done | `/api/barbers/nearby`, `src/features/customer/BrowseBarbers.tsx`, `BarbersMap.tsx` |
| Booking lifecycle (pending→confirmed→completed/cancelled/no_show) | Done | `/api/bookings*`, customer + barber feature screens |
| Reviews (completed bookings only, one per booking) | Done | `/api/reviews` |
| Issue / no-show reporting | Done | `/api/issues` |
| Notifications (lifecycle-driven, per-user) | Done (in-app; no push) | `/api/notifications*`, `CustomerNotifications.tsx` |
| Chat & call v1 (native `sms:`/`tel:`, number revealed after acceptance) | Done | `BookingConfirmed.tsx`, `BookingHistory.tsx`, `BarberJobs.tsx` |
| Stripe booking fee | Blocked — 501 until client provides keys | `/api/payments/*`, `docs/STRIPE_SETUP.md` |
| Push/email notifications | Not built | — |
| Android shell | Not built | — |
| Customer location capture / approximate-address gating | Change order (§4.1) | `docs/SCOPE_RECONCILIATION.md` |
| Account deletion, privacy/terms, App Store compliance | Done | `/api/account`, `src/features/legal/` |
| Admin dashboard (companies, bookings, income, verification) | Done | `src/features/admin/`, `/admin/*` routes |

## Directory guide

Each major directory has its own `README.md`: `src/`, `src/components/`, `src/features/`, `src/lib/`, `src/server/`, `src/store/`, `scripts/`, `migrations/`, `ios/`, `docs/`.

## Design

Design tokens and visual rules live in `DESIGN.md` at the repo root. The Figma export frames are in `public/figma/` and indexed in `docs/figma-pdf-index.md`.
