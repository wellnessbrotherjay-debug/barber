// Shared fetch helper for authenticated requests against the real backend.
// Attaches the JWT issued by POST /api/auth/signup|login (stored under
// 'barberSyncToken') as an Authorization: Bearer header.

// Web builds served by the API itself use same-origin relative URLs.
// Native (Capacitor) builds load from capacitor://localhost, where a relative
// URL can never reach the backend — there the URL MUST be baked in at build
// time (VITE_API_URL), and a missing value fails loudly instead of silently
// producing dead requests.
const isNativeShell = !window.location.protocol.startsWith('http');
if (isNativeShell && !import.meta.env.VITE_API_URL) {
  throw new Error('VITE_API_URL must be set at build time for native app builds');
}
const API_BASE = import.meta.env.VITE_API_URL ?? '';

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
  // Multipart uploads must NOT carry a manual Content-Type — the browser has
  // to set it itself so the multipart boundary is included.
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (!headers.has('Content-Type') && init.body && !isFormData) {
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

// GET /api/barber/bookings derives the barber from the JWT (requireBarberAuth
// on the server) — no ids are sent. The userId parameter is retained only so
// existing call sites (Wallet/Performance/ProfileEdit/BarberJobs) don't churn.
export async function fetchBarberBookingsForUser(_userId?: string): Promise<Response> {
  return authFetch('/api/barber/bookings');
}

// ---------------------------------------------------------------------------
// Image uploads (avatar + work-photo gallery). These POST multipart/form-data
// to the real upload endpoints in src/server/routes/uploads.ts; files are
// stored on the server's local disk and served back from /uploads/...
// The server derives the owning barber from the JWT, so no ids are sent.
// ---------------------------------------------------------------------------

export interface BarberPhoto {
  id: string;
  url: string;
  storage_key: string;
  sort_order: number;
  caption: string | null;
  bytes: number | null;
  mime_type: string | null;
  created_at: string;
}

async function errorFrom(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return body?.error || `${fallback} (${response.status})`;
  } catch (err) {
        console.error(`[api] reading the response body failed:`, err);
    return `${fallback} (${response.status})`;
  }
}

export async function uploadAvatar(file: File): Promise<string> {
  const data = new FormData();
  data.append('file', file);
  const response = await authFetch('/api/barber/upload/avatar', { method: 'POST', body: data });
  if (!response.ok) throw new Error(await errorFrom(response, 'Avatar upload failed'));
  const body = await response.json();
  return body.url as string;
}

export async function uploadMyAvatar(file: File): Promise<string> {
  const data = new FormData();
  data.append('file', file);
  const response = await authFetch('/api/account/avatar', { method: 'POST', body: data });
  if (!response.ok) throw new Error(await errorFrom(response, 'Photo upload failed'));
  const body = await response.json();
  return body.url as string;
}

export async function uploadGalleryPhotos(files: File[]): Promise<BarberPhoto[]> {
  const data = new FormData();
  files.forEach((file) => data.append('files', file));
  const response = await authFetch('/api/barber/upload/gallery', { method: 'POST', body: data });
  if (!response.ok) throw new Error(await errorFrom(response, 'Photo upload failed'));
  const body = await response.json();
  return (body.photos || []) as BarberPhoto[];
}

export async function fetchBarberPhotos(): Promise<BarberPhoto[]> {
  const response = await authFetch('/api/barber/photos');
  if (!response.ok) throw new Error(await errorFrom(response, 'Could not load photos'));
  return (await response.json()) as BarberPhoto[];
}

export async function deleteBarberPhoto(id: string): Promise<BarberPhoto[]> {
  const response = await authFetch(`/api/barber/photos/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await errorFrom(response, 'Could not delete photo'));
  const body = await response.json();
  return (body.photos || []) as BarberPhoto[];
}

/**
 * Tidy a typed phone number without changing the Figma field (board page 20 has
 * a single "Enter Phone Number" input and no country-code selector).
 * Keeps a leading "+" and digits only, so "+62 812-3456 7890" and
 * "(02) 9999 8888" both store cleanly and an international number entered in
 * full survives round-tripping. Deliberately does NOT invent a country code —
 * guessing one would be worse than storing what the barber typed.
 */
export function normalisePhone(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  return (hasPlus ? '+' : '') + digits;
}

/**
 * What went wrong, as a sentence a person can read.
 *
 * Four places worked this out for themselves before showing it. A caught value
 * in JavaScript can be anything at all, so the check is not optional - and one
 * place to change it means the wording stays the same everywhere.
 */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** A barber's standing: the average they are rated, and how many said so. */
export interface BarberRating {
  avg: number | null;
  count: number;
}

/**
 * The rating out of a barber profile the API returned.
 *
 * Two screens each turned the same two fields into numbers themselves, with the
 * same null checks. They are always read together and always change together,
 * so they travel as one thing now rather than two pieces of state that could
 * disagree.
 */
export function ratingFrom(profile: { rating_avg?: unknown; rating_count?: unknown }): BarberRating {
  return {
    avg: profile.rating_avg != null ? Number(profile.rating_avg) : null,
    count: profile.rating_count != null ? Number(profile.rating_count) : 0,
  };
}
