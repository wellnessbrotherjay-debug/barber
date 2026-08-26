import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Star, ImageIcon, Clock } from 'lucide-react';
import CustomerNav from '@/components/CustomerNav';

import { Button } from '@/components/ui/Button';
import { getStoredLocation, distanceKm } from '@/lib/geo';
import { authFetch } from '@/lib/api';

interface Barber {
  id: string;
  display_name: string;
  rating_avg: number;
  address_text?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  is_active: boolean;
  service_mode?: 'in_shop' | 'mobile' | 'both';
}

// Board frame 15 — full-bleed map with a single barber card floating above the
// bottom nav. Tiles are OpenStreetMap rendered in greyscale so the screen stays
// inside the brand book's black/white palette.
const SEMINYAK: [number, number] = [-8.695, 115.168];

export default function BarbersMap() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selected, setSelected] = useState<Barber | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Prefer the geospatial endpoint so the map shows the barbers actually
        // reachable from the customer, nearest first, filtered and ordered in
        // Postgres. Falls back to the paginated list with no location fix.
        const here = getStoredLocation();
        const path = here
          ? `/api/barbers/nearby?lat=${here.lat}&lng=${here.lng}&radius_km=25&limit=50`
          : `/api/barbers?limit=50`;
        // Public discovery: authFetch attaches the JWT when logged in; the
        // guest X-Session-Token is the anonymous tenant-context fallback.
        const res = await authFetch(path, {
          headers: { 'X-Session-Token': '1:guest' },
        });
        const data = (await res.json()) as any;
        const list: Barber[] = Array.isArray(data) ? data : data.barbers || [];
        if (cancelled) return;
        setBarbers(list);
        setSelected(list.find((b) => Number.isFinite(Number((b as any).latitude))) || list[0] || null);
      } catch (err) {
        console.error(`[BarbersMap] loading barbers for the map failed:`, err);
        /* map still renders; card just stays empty */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const here = getStoredLocation();
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false })
      .setView(here ? [here.lat, here.lng] : SEMINYAK, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Drop a pin per barber that has real coordinates; selecting one swaps the card.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers: L.Marker[] = [];
    barbers.forEach((b) => {
      const lat = Number((b as any).latitude);
      const lng = Number((b as any).longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const m = L.marker([lat, lng]).addTo(map).on('click', () => setSelected(b));
      markers.push(m);
    });
    return () => { markers.forEach((m) => m.remove()); };
  }, [barbers]);

  const here = getStoredLocation();
  const km = (() => {
    if (!selected || !here) return null;
    const lat = Number((selected as any).latitude);
    const lng = Number((selected as any).longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return distanceKm(here, { lat, lng });
  })();

  return (
    <div className="relative w-full h-screen bg-white overflow-hidden">
      {/* greyscale keeps OSM tiles inside the palette */}
      <div ref={containerRef} className="absolute inset-0 grayscale" style={{ filter: 'grayscale(1) contrast(0.9)' }} />

      {selected && (
        <div className="absolute left-4 right-4" style={{ bottom: 96 }}>
          <div className="bg-white rounded-[20px] p-4 border-[0.75px] border-[#d2dbe9] shadow-[0px_8px_28px_rgba(0,0,0,0.08)]">
            <div className="flex gap-4">
              <div className="w-[110px] h-[110px] rounded-[12px] bg-surface flex items-center justify-center shrink-0">
                <ImageIcon className="w-8 h-8 text-[#d4d2e3]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[18px] font-bold text-ink truncate">{selected.display_name}</p>
                <div className="flex items-center gap-2 mt-1.5 text-[13px]">
                  <Star className="w-4 h-4 fill-ink text-ink" />
                  <span className="font-bold text-ink">{selected.rating_avg}</span>
                  {km !== null && <span className="text-muted">• {km.toFixed(1)} km</span>}
                </div>
                <p className="text-[13px] text-ink mt-1.5">
                  {selected.service_mode === 'mobile'
                    ? 'Comes to you'
                    : selected.service_mode === 'both'
                      ? 'In-shop • Comes to you'
                      : 'In-shop'}
                </p>
                {selected.is_active && (
                  <p className="flex items-center gap-1.5 text-[13px] text-muted mt-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Available now
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/customer/barber/${selected.id}`)}
              className="w-full bg-ink text-white text-[14px] font-semibold py-4 rounded-full mt-4"
            >
              View Profile
            </button>
          </div>
        </div>
      )}

      <CustomerNav active="home" />
    </div>
  );
}
