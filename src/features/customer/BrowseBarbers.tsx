import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, ImageIcon, Clock } from 'lucide-react';
import CustomerNav from '@/components/CustomerNav';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/useAuthStore';
import { getStoredLocation, distanceKm, formatDistance, formatEta, type LatLng } from '@/lib/geo';
import { authFetch } from '@/lib/api';

interface Barber {
  id: string;
  display_name: string;
  rating_avg: string | number;
  address_text: string | null;
  is_active?: boolean;
  /** Present only on the geo endpoint — real great-circle km from the customer. */
  distance_km?: number;
  services?: { id: string | null; name: string | null; price: number | null }[];
}

/** Page size for barber discovery — pagination happens in SQL, not in the client. */
const PAGE_SIZE = 20;
/** How far out to look when the customer has a location fix. */
const SEARCH_RADIUS_KM = 25;

// One barber's card. It is its own component because the list body was almost
// entirely this one repeated block, and the card needs nothing but the barber
// plus the two already-computed strings.
function BarberCard({
  barber,
  distance,
  eta,
  onRequest,
}: {
  barber: Barber;
  distance: string | null;
  eta: string | null;
  onRequest: () => void;
}) {
  return (
    <Card className="p-3 flex flex-col gap-3 border-[0.75px] border-[#d2dbe9] shadow-none">
      {/* Header Row — Figma 1:339 */}
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          <div className="w-12 h-12 rounded-[8px] bg-surface flex items-center justify-center">
            <ImageIcon className="w-[23px] h-[20px] text-muted" />
          </div>
          <div className="flex flex-col gap-1 items-start">
            <p className="text-[14px] leading-[20px] font-semibold text-ink">{barber.display_name}</p>
            {/* "• Online" pill — is_active is the real accepting-requests flag */}
            {barber.is_active && (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#f8f8f8] text-[10px] leading-[12px] font-medium text-[#514e59]">
                <span className="w-[3px] h-[3px] rounded-full bg-[#514e59]" />
                Online
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1 items-center">
          <p className="text-[14px] leading-[20px] font-bold text-ink">
            ${Number(barber.services?.[0]?.price ?? 0).toFixed(2)}
          </p>
          <p className="text-[10px] leading-[14px] font-semibold text-muted">
            {/* formatDistance already reads "1.2 km away" — don't append "away" again. */}
            {distance || (barber.address_text?.split(',')[0] || 'Near you')}
          </p>
        </div>
      </div>

      <hr className="border-t-[0.5px] border-border" />

      {/* Stats row: rating left, "ETA : X min" right. ETA derived from real
          great-circle distance; omitted (not faked) without a location fix. */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Star className="w-3.5 h-3.5 fill-ink text-ink" />
          <span className="text-[10px] leading-[14px] font-semibold text-ink">{barber.rating_avg}</span>
        </div>
        {eta && (
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-[#514e59]" />
            {/* formatEta already reads "ETA : 25-35 min" — no extra prefix. */}
            <span className="text-[10px] leading-[14px] font-semibold text-[#514e59]">{eta}</span>
          </div>
        )}
      </div>

      <hr className="border-t-[0.5px] border-border" />

      {/* Action — pill, 12px text (Figma 1:369) */}
      <button
        type="button"
        onClick={onRequest}
        className="w-full bg-ink text-white rounded-[999px] px-6 py-3 text-[12px] leading-[16px] font-semibold text-center"
      >
        Request Now
      </button>
    </Card>
  );
}

export default function BrowseBarbers() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [here] = useState<LatLng | null>(() => getStoredLocation());

  // Distance/ETA are only shown when BOTH the customer's device location and the
  // barber's stored coordinates exist. No fix -> no number, rather than a guess.
  //
  // When we have a location fix the server already returns an authoritative
  // distance_km (computed in Postgres, see /api/barbers/nearby), so we use that
  // and only fall back to the local haversine for the no-location listing.
  const kmTo = (b: Barber): number | null => {
    if (typeof b.distance_km === 'number') return b.distance_km;
    const lat = Number((b as any).latitude);
    const lng = Number((b as any).longitude);
    if (!here || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return distanceKm(here, { lat, lng });
  };
  const distanceFor = (b: Barber) => { const k = kmTo(b); return k === null ? null : formatDistance(k); };
  const etaFor = (b: Barber) => { const k = kmTo(b); return k === null ? null : formatEta(k); };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function fetchBarbers() {
      try {
        setLoading(true);
        // With a location fix, discovery runs in Postgres: radius filtering,
        // distance ordering and LIMIT/OFFSET all happen server-side, so the
        // client never downloads the whole barber table. Without a fix we fall
        // back to the paginated rating-ordered list.
        const path = here
          ? `/api/barbers/nearby?lat=${here.lat}&lng=${here.lng}&radius_km=${SEARCH_RADIUS_KM}&limit=${PAGE_SIZE}`
          : `/api/barbers?limit=${PAGE_SIZE}`;
        const response = await authFetch(`${path}`, {
          headers: {
            'X-Session-Token': '1:guest',
          },
        });
        if (!response.ok) throw new Error(`Failed to fetch barbers: ${response.status}`);
        const data = (await response.json()) as Barber[];
        if (!cancelled) setBarbers(data);
      } catch (err) {
        if (!cancelled) setError(`${err}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchBarbers();
    return () => { cancelled = true; };
  }, [user?.id, here]);

  if (loading) {
    return (
      <div className="relative w-full min-h-screen bg-white flex items-center justify-center pb-[88px]">
        <p className="text-sm text-muted">Loading barbers…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative w-full min-h-screen bg-white flex items-center justify-center pb-[88px] px-5">
        <p className="text-sm text-red-600 text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-screen bg-white flex flex-col pb-[88px]">
      {/* Header — Figma 1:330 */}
      <div className="px-5 pt-4 pb-4">
        <h1 className="text-[16px] leading-[24px] font-bold text-ink">Available Now</h1>
      </div>

      {/* Info Banner — Figma 1:334: bg #f4f5f8, radius 8, p-3 */}
      <div className="px-5 pb-4">
        <div className="bg-[#f4f5f8] rounded-[8px] p-3">
          <p className="text-[12px] leading-[16px] font-medium text-ink">
            Pay a small booking fee to confirm and unlock chat + call.
          </p>
        </div>
      </div>

      {/* Barbers List */}
      <div className="flex-1 px-5 flex flex-col gap-3 overflow-y-auto">
        {barbers.length === 0 && (
          /* Empty state — Figma page 16: surface image placeholder + single bold line */
          <div className="flex flex-col items-center justify-center text-center" style={{ marginTop: 180 }}>
            <div className="w-[136px] h-[136px] rounded-[16px] bg-surface flex items-center justify-center">
              <ImageIcon className="w-11 h-11 text-muted" />
            </div>
            <p className="text-[20px] leading-7 font-bold text-ink mt-9">No barbers available right now</p>
          </div>
        )}
        {barbers.map((barber) => (
          <BarberCard
            key={barber.id}
            barber={barber}
            distance={distanceFor(barber)}
            eta={etaFor(barber)}
            onRequest={() => navigate(`/customer/barber/${barber.id}`)}
          />
        ))}
      </div>

      <CustomerNav active="home" />
    </div>
  );
}
