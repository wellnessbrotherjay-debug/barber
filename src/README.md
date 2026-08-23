# src/ — application source

React + TypeScript client and the Express API server, in one tree. The Figma 63-frame export is the locked UI spec — screens are built verbatim from it.

## Top-level files

| File | Purpose |
|---|---|
| `main.tsx` | Vite entry — mounts `<App />`, imports `index.css` |
| `App.tsx` | All React Router routes: onboarding, auth, customer, barber, admin and legal screens, wrapped in `AppLayout` |
| `index.css` | Tailwind layers + global styles (fonts, safe-area handling for the iOS shell) |
| `types.ts` | Shared TypeScript domain types used across features |
| `vite-env.d.ts` | Vite env typing (`import.meta.env`) |

## Subdirectories

| Dir | Contents |
|---|---|
| `components/` | Shared layout, nav and UI primitives (see its README) |
| `features/` | Screen components grouped by role: `auth/`, `onboarding/`, `customer/`, `barber/`, `admin/`, `legal/` (see its README) |
| `lib/` | Client-side helpers: API fetch wrapper, booking engine, geo/date utils (see its README) |
| `server/` | The Express API — auth, multi-tenant middleware, all `/api` and `/admin` routes, uploads (see its README) |
| `store/` | Zustand stores (`useAuthStore`) (see its README) |
| `constants/` | `mockData.ts` — leftover demo fixtures used by a few screens as placeholder display data only; production data comes from the API |

## Data flow

UI screen → `lib/api.ts` `authFetch` (JWT from localStorage) → `server/index.ts` route → `server/middleware/tenant.ts` (verifies JWT, resolves tenant Postgres pool) → tenant DB. Roles (`customer`/`barber`/`admin`) are enforced server-side on every route.
