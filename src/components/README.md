# src/components/ — shared components

Reusable pieces used across feature screens. Everything matches the locked Figma spec.

| File | Purpose |
|---|---|
| `AppLayout.tsx` | Outer app frame (max-width phone canvas, safe-area padding); wraps every routed screen |
| `CustomerNav.tsx` | Bottom tab bar for customer screens (Home / Bookings / Notifications / Profile); takes an `active` prop |
| `BarberNav.tsx` | Bottom tab bar for barber screens (Jobs / Availability / Performance / Profile) |
| `ShorterLogo.tsx` | Brand wordmark/logo SVG component |
| `ShopLocationMap.tsx` | Leaflet map with draggable pin + Nominatim geocoding, used in barber onboarding/profile to set the precise shop location |
| `DeleteAccountDialog.tsx` | Apple-5.1.1(v) in-app account deletion flow: confirmation, active-booking guard, calls `DELETE /api/account` |

## `ui/` primitives

Small styled building blocks (Tailwind, tokens from `DESIGN.md`):

| File | Purpose |
|---|---|
| `Avatar.tsx` | Circular avatar with image fallback to initials |
| `Badge.tsx` | Status pill (booking/verification statuses) |
| `Button.tsx` | Primary/secondary/ghost buttons, full-round Figma style |
| `Card.tsx` | Rounded bordered card container |
| `Input.tsx` | Labelled text input matching the Figma field style |
