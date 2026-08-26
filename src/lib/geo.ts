// Customer location + distance/ETA helpers.
//
// Board frames 14/15 show "1.2 km away" and "ETA : 25-35 min" on every barber
// card. Both are DERIVED from real coordinates (browser geolocation for the
// customer, barber_profiles.latitude/longitude for the barber) — never invented.
// When we have no fix, the caller renders nothing rather than a placeholder
// number.

export type LatLng = { lat: number; lng: number };

const STORAGE_KEY = 'shorter_customer_location';
/** Average urban travel speed (km/h) used to turn distance into an ETA band. */
const URBAN_SPEED_KMH = 24;
/** Minutes of prep/handover padding either side of the raw travel estimate. */
const ETA_SPREAD_MIN = 5;

export function getStoredLocation(): LatLng | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return typeof v?.lat === 'number' && typeof v?.lng === 'number' ? v : null;
  } catch (err) {
    // A stored location that will not parse is a corrupt entry, not an absence:
    // say so, then carry on as though there were none.
    console.error('[geo] the saved location could not be read:', err);
    return null;
  }
}

export function storeLocation(loc: LatLng) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
}

export function clearStoredLocation() {
  localStorage.removeItem(STORAGE_KEY);
}

/** True once the customer has answered the frame-13 prompt either way. */
export function locationPromptAnswered(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null ||
    localStorage.getItem(`${STORAGE_KEY}_declined`) === '1';
}

export function markLocationDeclined() {
  localStorage.setItem(`${STORAGE_KEY}_declined`, '1');
}

export function requestLocation(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Location is not available on this device'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        storeLocation(loc);
        resolve(loc);
      },
      (err) => reject(new Error(err.message || 'Could not get your location')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

/** Great-circle distance in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`;
}

/** Board renders "ETA : 25-35 min" — a band, not a false-precision single number. */
export function formatEta(km: number): string {
  const mins = (km / URBAN_SPEED_KMH) * 60;
  const low = Math.max(5, Math.round((mins - ETA_SPREAD_MIN) / 5) * 5);
  const high = Math.max(low + 5, Math.round((mins + ETA_SPREAD_MIN) / 5) * 5);
  return `ETA : ${low}-${high} min`;
}
