// Shared fetch helper for authenticated requests against the real backend.
// Attaches the JWT issued by POST /api/auth/signup|login (stored under
// 'barberSyncToken') as an Authorization: Bearer header.

const API_BASE = import.meta.env.VITE_API_URL || '';

export const TOKEN_STORAGE_KEY = 'barberSyncToken';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

// If a request carries a token but the server says it's unauthorized (401)
// or resolves to an account that no longer has a matching profile row (404
// "not found" on a /api/barber/* endpoint), the local session is stale —
// e.g. a leftover token from an earlier signup attempt, or an account that
// was cleaned up server-side. Rather than leave the app half-rendered with
// a dead error banner, clear it and force a clean re-login.
function isStaleSessionResponse(status: number, path: string): boolean {
  if (status === 401) return true;
  if (status === 404 && path.startsWith('/api/barber/')) return true;
  return false;
}

export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (token && isStaleSessionResponse(response.status, path)) {
    clearToken();
    localStorage.removeItem('barbersync-auth');
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/welcome')) {
      window.location.href = '/welcome';
    }
  }
  return response;
}

// GET /api/barber/bookings authenticates via X-Session-Token/X-User-ID headers
// (not the Authorization JWT authFetch normally sends — see
// src/server/index.ts and src/server/middleware/tenant.ts), matching the
// pattern BarberJobs.tsx already uses. Shared here so Wallet/Performance/
// ProfileEdit can pull the same real booking data.
export async function fetchBarberBookingsForUser(userId: string): Promise<Response> {
  return fetch(`${API_BASE}/api/barber/bookings`, {
    headers: {
      'X-Session-Token': `1:${userId}`,
      'X-User-ID': userId,
    },
  });
}
