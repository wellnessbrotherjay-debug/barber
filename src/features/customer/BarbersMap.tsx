import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Star, ImageIcon, Clock } from 'lucide-react';
import CustomerNav from '@/components/CustomerNav';

import { Button } from '@/components/ui/Button';
import { getStoredLocation, distanceKm } from '@/lib/geo';

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
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/barbers`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('barberSyncToken') || ''}` },
        });
        const data = (await res.json()) as any;
        const list: Barber[] = Array.isArray(data) ? data : data.barbers || [];
        if (cancelled) return;
        setBarbers(list);
        setSelected(list.find((b) => Number.isFinite(Number((b as any).latitude))) || list[0] || null);
      } catch {
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
          <div className="bg-white rounded-[16px] p-4 shadow-[0px_8px_28px_rgba(0,0,0,0.16)]">
            <div className="flex gap-4">
              <div className="w-[86px] h-[86px] rounded-[12px] bg-surface flex items-center justify-center shrink-0">
                <ImageIcon className="w-7 h-7 text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[17px] font-semibold text-ink truncate">{selected.display_name}</p>
                <div className="flex items-center gap-2 mt-1 text-[13px]">
                  <Star className="w-4 h-4 fill-ink text-ink" />
                  <span className="font-semibold text-ink">{selected.rating_avg}</span>
                  {km !== null && (
                    <>
                      <span className="text-muted">•</span>
                      <span className="text-muted font-medium">{km.toFixed(1)} km</span>
                    </>
                  )}
                </div>
                <p className="text-[13px] text-ink mt-1">
                  {selected.service_mode === 'mobile'
                    ? 'Comes to you'
                    : selected.service_mode === 'both'
                      ? 'In-shop • Comes to you'
                      : 'In-shop'}
                </p>
                {selected.is_active && (
                  <p className="flex items-center gap-1.5 text-[13px] text-muted mt-1">
                    <Clock className="w-3.5 h-3.5" />
                    Available now
                  </p>
                )}
              </div>
            </div>

            <Button
              size="lg"
              className="w-full mt-4 text-sm"
              onClick={() => navigate(`/customer/barber/${selected.id}`)}
            >
              View Profile
            </Button>
          </div>
        </div>
      )}

      <CustomerNav active="home" />
    </div>
  );
}
