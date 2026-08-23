import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Share,
  Bookmark,
  MoreHorizontal,
  Star,
  ImageIcon,
  Store,
  Truck,
  CircleCheck,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { authFetch } from '@/lib/api';

interface BarberDetail {
  id: string;
  display_name: string;
  bio: string | null;
  rating_avg: string | number;
  rating_count: number;
  address_text: string | null;
  shop_name?: string | null;
  is_active?: boolean;
  work_photos?: string[] | null;
  users?: { full_name?: string | null; avatar_url?: string | null } | null;
  services?: { id: string | null; name: string | null; price: number | null; duration_minutes: number | null }[];
}

// Figma page 19 — Barber Detail: hero image, white sheet with Online pill,
// name + Top Rated Artist badge, stat cards, Work Gallery, About, Book Now.
export default function BarberProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [barber, setBarber] = useState<BarberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Index into work_photos of the photo open in the fullscreen viewer; null = closed.
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function fetchBarber() {
      try {
        setLoading(true);
        const response = await authFetch(`/api/barbers/${id}`, {
          headers: {
            'X-Session-Token': '1:guest',
          },
        });
        if (!response.ok) throw new Error(`Failed to fetch barber: ${response.status}`);
        const data = await response.json();
        if (!cancelled) setBarber(data);
      } catch (err) {
        if (!cancelled) setError(`${err}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchBarber();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-muted">Loading profile…</p>
      </div>
    );
  }

  if (error || !barber) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-5">
        <p className="text-sm text-red-600 text-center">{error || 'Barber not found'}</p>
      </div>
    );
  }

  const fee = 20; // flat booking fee shown on the board ($20)
  const photos = (barber.work_photos ?? []).filter(Boolean);
  const heroUrl = barber.users?.avatar_url || photos[0] || null;

  return (
    <div className="min-h-screen bg-surface">
      {/* Hero image area with floating top bar — Figma page 19 */}
      <div className="relative h-[370px] bg-surface overflow-hidden">
        {heroUrl ? (
          <img src={heroUrl} alt={barber.display_name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="w-24 h-24 text-[#d4d2e3]" strokeWidth={1.25} />
          </div>
        )}
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-6 pt-16">
          <button type="button" aria-label="Back" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-6 h-6 text-ink" strokeWidth={2.25} />
          </button>
          <div className="flex items-center gap-5">
            <Share className="w-[22px] h-[22px] text-ink" strokeWidth={1.8} />
            <Bookmark className="w-[22px] h-[22px] text-ink" strokeWidth={1.8} />
            <MoreHorizontal className="w-[22px] h-[22px] text-ink" strokeWidth={1.8} />
          </div>
        </div>
      </div>

      {/* White sheet */}
      <div className="relative -mt-8 bg-white rounded-t-[28px] px-6 pt-6 pb-8">
        {/* Online pill */}
        <span className="inline-flex items-center gap-2 bg-[#f6f6fb] rounded-full px-4 py-2.5 text-[13px] font-semibold text-ink">
          <span className="w-[5px] h-[5px] rounded-full bg-ink" />
          Online Now
        </span>

        {/* Name + badge */}
        <div className="flex items-center justify-between gap-3 mt-4">
          <h1 className="text-[24px] leading-8 font-bold text-ink">{barber.display_name}</h1>
          <span className="flex items-center gap-1.5 bg-[#f6f6fb] rounded-full px-3.5 py-2 shrink-0">
            <CircleCheck className="w-4 h-4 text-white fill-ink" />
            <span className="text-[12px] font-semibold text-ink whitespace-nowrap">Top Rated Artist</span>
          </span>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-2.5 mt-3">
          <span className="flex items-center gap-1.5 bg-[#f6f6fb] rounded-full px-3.5 py-2">
            <Star className="w-3.5 h-3.5 fill-ink text-ink" />
            <span className="text-[13px] font-bold text-ink">{barber.rating_avg}</span>
          </span>
          <span className="text-[13px] text-muted">({barber.rating_count} Reviews)</span>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="bg-[#f6f6fb] rounded-[16px] p-3 flex items-center gap-3">
            <span className="w-11 h-11 rounded-[10px] bg-white flex items-center justify-center shrink-0">
              <Store className="w-5 h-5 text-ink" strokeWidth={1.8} />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] text-muted truncate">
                {barber.shop_name || barber.address_text?.split(',')[0] || 'Studio'}
              </span>
              <span className="block text-[15px] font-bold text-ink mt-0.5">Available</span>
            </span>
          </div>
          <div className="bg-[#f6f6fb] rounded-[16px] p-3 flex items-center gap-3">
            <span className="w-11 h-11 rounded-[10px] bg-white flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5 text-ink" strokeWidth={1.8} />
            </span>
            <span>
              <span className="block text-[11px] text-muted">ETA</span>
              <span className="block text-[15px] font-bold text-ink mt-0.5">15–20 min</span>
            </span>
          </div>
        </div>

        {/* Work Gallery */}
        <div className="flex items-center justify-between mt-7">
          <h2 className="text-[20px] font-bold text-ink">Work Gallery</h2>
          <button type="button" className="text-[13px] font-medium text-muted">View All</button>
        </div>
        <div className="flex gap-3 mt-4 -mr-6 overflow-x-auto pb-1">
          {photos.length > 0
            ? photos.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  aria-label={`Open work photo ${i + 1}`}
                  onClick={() => setViewerIndex(i)}
                  className="w-[164px] h-[164px] rounded-[16px] bg-surface overflow-hidden shrink-0 active:opacity-80"
                >
                  <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))
            : [0, 1, 2].map((i) => (
                <div key={i} className="w-[164px] h-[164px] rounded-[16px] bg-surface flex items-center justify-center shrink-0">
                  <ImageIcon className="w-9 h-9 text-[#d4d2e3]" />
                </div>
              ))}
        </div>

        {/* About */}
        <h2 className="text-[20px] font-bold text-ink mt-7">About</h2>
        <p className="text-[14px] text-muted leading-6 mt-2">
          {barber.bio ||
            'Specializing in modern fades, beard sculpting, and classic straight-razor shaves. Over 10 years of experience in the grooming industry.'}
        </p>

        {/* Booking fee + Book Now */}
        <div className="flex items-center gap-5 mt-6">
          <div className="shrink-0">
            <p className="text-[12px] text-muted">Booking Fee</p>
            <p className="text-[20px] font-bold text-ink mt-0.5">${fee}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/customer/book/${id}`)}
            className="flex-1 bg-ink text-white text-[15px] font-semibold py-[18px] rounded-[16px] text-center"
          >
            Book Now
          </button>
        </div>

        {/* Footer note */}
        <div className="flex items-start gap-3 bg-[#f6f6fb] rounded-[14px] p-4 mt-6">
          <CircleCheck className="w-5 h-5 text-ink shrink-0 mt-0.5" strokeWidth={1.8} />
          <p className="text-[13px] text-ink leading-5">
            You'll pay a small booking fee to confirm. Haircut payment is handled directly with
            the barber.
          </p>
        </div>
      </div>

      {/* Fullscreen photo viewer */}
      {viewerIndex !== null && photos[viewerIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          role="dialog"
          aria-label="Work photo viewer"
          onClick={() => setViewerIndex(null)}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setViewerIndex(null)}
            className="absolute top-14 right-5 w-10 h-10 rounded-full bg-white/15 flex items-center justify-center"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <img
            src={photos[viewerIndex]}
            alt={`Work photo ${viewerIndex + 1} of ${photos.length}`}
            className="max-w-full max-h-[80vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={(e) => { e.stopPropagation(); setViewerIndex((viewerIndex + photos.length - 1) % photos.length); }}
                className="absolute left-4 w-10 h-10 rounded-full bg-white/15 flex items-center justify-center"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={(e) => { e.stopPropagation(); setViewerIndex((viewerIndex + 1) % photos.length); }}
                className="absolute right-4 w-10 h-10 rounded-full bg-white/15 flex items-center justify-center"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
              <p className="absolute bottom-10 text-white/70 text-[13px]">
                {viewerIndex + 1} / {photos.length}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
