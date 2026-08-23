# src/lib/ — client helpers

| File | Purpose / key exports |
|---|---|
| `api.ts` | `authFetch(path, init)` — fetch wrapper attaching the JWT (`barberSyncToken` in localStorage) and auto-clearing stale sessions on 401; `getToken`/`setToken`/`clearToken`; `fetchBarberBookingsForUser` (legacy header-auth booking fetch); upload helpers `uploadAvatar`, `uploadGalleryPhotos`, `fetchBarberPhotos`, `deleteBarberPhoto` (+ `BarberPhoto` type); `normalisePhone` (digits + optional leading `+`) |
| `booking-engine.ts` | Client-side booking slot logic: builds available time slots from a barber's schedule, buffer and existing bookings |
| `datetime.ts` | Date/time formatting shared across screens (e.g. `formatShortDateTime` matching the Figma "Tue, Oct 24 • 10:00 AM" style) |
| `geo.ts` | Haversine distance / ETA helpers used by browse + map screens |
| `utils.ts` | `cn()` classname combiner and misc small utilities |

All server communication goes through `authFetch`; never call `fetch` with hand-built auth headers in new code.
