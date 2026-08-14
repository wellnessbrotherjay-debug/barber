import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, MapPin } from 'lucide-react';

// Fix Leaflet's default marker icons, which break under bundlers because
// the image URLs are resolved relative to leaflet's own package path.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface Props {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number, address: string) => void;
}

const DEFAULT_CENTER: [number, number] = [40.7128, -74.006]; // NYC fallback if no geolocation/pin yet

// Reverse-geocodes via OpenStreetMap's free Nominatim API — no key required,
// no billing account, nothing to "not be set up".
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const data = await res.json();
    return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

export default function ShopLocationMap({ latitude, longitude, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const start: [number, number] =
      latitude != null && longitude != null ? [latitude, longitude] : DEFAULT_CENTER;

    const map = L.map(containerRef.current, {
      center: start,
      zoom: latitude != null ? 15 : 11,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker(start, { draggable: true }).addTo(map);
    markerRef.current = marker;

    async function commit(lat: number, lng: number) {
      const address = await reverseGeocode(lat, lng);
      onChange(lat, lng, address);
    }

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      commit(pos.lat, pos.lng);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      commit(e.latlng.lat, e.latlng.lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        markerRef.current?.setLatLng([lat, lng]);
        mapRef.current?.setView([lat, lng], 16);
        reverseGeocode(lat, lng).then((address) => onChange(lat, lng, address));
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-border">
      <div ref={containerRef} className="w-full h-56" />
      <button
        type="button"
        onClick={useMyLocation}
        disabled={locating}
        className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-ink bg-surface"
      >
        {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
        {locating ? 'Finding you…' : 'Use my current location'}
      </button>
    </div>
  );
}
