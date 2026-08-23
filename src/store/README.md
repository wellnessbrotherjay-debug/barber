# src/store/ — client state

| File | Purpose |
|---|---|
| `useAuthStore.ts` | Zustand store for the signed-in user (id, role, name, onboarding state), persisted to localStorage (`barbersync-auth`). Login/signup write here; `authFetch` clears it on stale sessions. |

Keep global state minimal — screen data is fetched per-screen from the API, not cached here.
