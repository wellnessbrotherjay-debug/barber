import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, ImageIcon, SearchX, Clock } from 'lucide-react';
import CustomerNav from '@/components/CustomerNav';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/useAuthStore';
import { getStoredLocation, distanceKm, formatDistance, formatEta, type LatLng } from '@/lib/geo';

interface Barber {
  id: string;
  display_name: string;
  rating_avg: string | number;
  address_text: string | null;
  is_active?: boolean;
  services?: { id: string | null; name: string | null; price: number | null }[];
}

export default function BrowseBarbers() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [here] = useState<LatLng | null>(() => getStoredLocation());

  // Distance/ETA are only shown when BOTH the customer's device location and the
  // barber's stored coordinates exist. No fix -> no number, rather than a guess.
  const kmTo = (b: Barber): number | null => {
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
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/barbers`, {
          headers: {
            'X-Session-Token': `1:${user?.id || 'guest'}`,
            Authorization: `Bearer ${localStorage.getItem('barberSyncToken') || ''}`,
            'X-User-ID': user?.id || '',
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
  }, [user?.id]);

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
      <div className="px-5 pt-[70px] pb-4">
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
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-surface flex items-center justify-center mb-3">
              <SearchX className="w-7 h-7 text-muted" />
            </div>
            <p className="text-sm font-semibold text-ink">No barbers available right now</p>
            <p className="text-xs text-muted mt-1">Check back soon or try again later.</p>
          </div>
        )}
        {barbers.map((barber) => (
          <Card key={barber.id} className="p-3 flex flex-col gap-3 border-[0.75px] border-[#d2dbe9] shadow-none">
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
                  {distanceFor(barber) ? `${distanceFor(barber)} away` : (barber.address_text?.split(',')[0] || 'Near you')}
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
              {etaFor(barber) && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#514e59]" />
                  <span className="text-[10px] leading-[14px] font-semibold text-[#514e59]">ETA : {etaFor(barber)}</span>
                </div>
              )}
            </div>

            <hr className="border-t-[0.5px] border-border" />

            {/* Action — pill, 12px text (Figma 1:369) */}
            <button
              type="button"
              onClick={() => navigate(`/customer/barber/${barber.id}`)}
              className="w-full bg-ink text-white rounded-[999px] px-6 py-3 text-[12px] leading-[16px] font-semibold text-center"
            >
              Request Now
            </button>
          </Card>
        ))}
      </div>

      <CustomerNav active="home" />
    </div>
  );
}
