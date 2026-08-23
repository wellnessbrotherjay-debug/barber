import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Scissors, Clock, Calendar, CircleCheck, Facebook, Twitter, Instagram } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { authFetch } from '@/lib/api';

interface BarberDetail {
  id: string;
  display_name: string;
  bio: string | null;
  rating_avg: string | number;
  rating_count: number;
  address_text: string | null;
  services?: { id: string | null; name: string | null; price: number | null; duration_minutes: number | null }[];
}

type Tab = 'services' | 'about' | 'reviews';

const TABS: { key: Tab; label: string }[] = [
  { key: 'services', label: 'Services' },
  { key: 'about', label: 'About' },
  { key: 'reviews', label: 'Reviews' },
];

// Figma pages 26–27 — "Barbar Profile" (sic, per design copy) with profile card,
// three stat cards, and Services / About / Reviews segmented tabs.
export default function BarberProfileTabs() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [barber, setBarber] = useState<BarberDetail | null>(null);
  const [tab, setTab] = useState<Tab>('services');
  const [selectedService, setSelectedService] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    authFetch(`/api/barbers/${id}`, {
      headers: {
        'X-Session-Token': '1:guest',
      },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data) setBarber(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id, user?.id]);

  const services = (barber?.services || []).filter((s) => s.id);

  return (
    <div className="min-h-screen bg-white pb-8">
      {/* Top bar — centered "Barbar Profile" (copy exactly as designed) */}
      <div className="flex items-center px-6 pt-16 pb-4">
        <button type="button" aria-label="Back" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-6 h-6 text-ink" strokeWidth={2.25} />
        </button>
        <p className="flex-1 text-center text-[18px] font-bold text-ink pr-6">Barbar Profile</p>
      </div>

      <div className="px-6">
        {/* Profile card */}
        <div className="border-[0.75px] border-[#d2dbe9] rounded-[20px] px-6 py-8 flex flex-col items-center">
          <div className="w-[136px] h-[136px] rounded-full bg-surface" />
          <h1 className="text-[28px] font-bold text-ink mt-6">{barber?.display_name || '—'}</h1>
          <p className="mt-2 text-[14px]">
            <span className="font-bold text-ink">★ {barber?.rating_avg ?? '—'}</span>{' '}
            <span className="text-muted">({barber?.rating_count ?? 0})</span>{' '}
            <span className="text-muted">• {barber?.address_text?.split(',')[0] || 'Near you'}</span>
          </p>
          <span className="flex items-center gap-1.5 bg-[#f6f6fb] rounded-full px-4 py-2 mt-4">
            <CircleCheck className="w-4 h-4 text-ink" strokeWidth={1.8} />
            <span className="text-[13px] font-medium text-ink">Verified</span>
          </span>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { icon: Scissors, caption: 'Expertise', value: 'Stylist' },
            { icon: Clock, caption: 'Exp.', value: '8 years' },
            { icon: Calendar, caption: 'Booked', value: '90% Full' },
          ].map(({ icon: Icon, caption, value }) => (
            <div key={caption} className="bg-white rounded-[18px] shadow-[0px_6px_20px_rgba(28,27,31,0.06)] py-6 flex flex-col items-center">
              <span className="w-12 h-12 rounded-[12px] bg-[#f6f6fb] flex items-center justify-center">
                <Icon className="w-5 h-5 text-ink" strokeWidth={1.8} />
              </span>
              <span className="text-[13px] text-muted mt-4">{caption}</span>
              <span className="text-[17px] font-bold text-ink mt-1">{value}</span>
            </div>
          ))}
        </div>

        {/* Segmented tabs */}
        <div className="flex items-center bg-[#eff1f5] rounded-full p-[3px] mt-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'flex-1 py-3.5 rounded-full text-[15px] text-center transition-colors',
                tab === t.key ? 'bg-white font-bold text-ink' : 'font-medium text-[#676372]'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'services' && (
          <div className="mt-6 space-y-4">
            {services.length === 0 && (
              <p className="text-sm text-muted text-center py-6">No services listed yet.</p>
            )}
            {services.map((s) => (
              <div key={s.id} className="border-[0.75px] border-[#d2dbe9] rounded-[18px] p-5 flex items-start justify-between">
                <div>
                  <p className="text-[16px] font-bold text-ink">{s.name}</p>
                  <p className="text-[13px] text-muted mt-2">{s.duration_minutes} mins</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="text-[17px] font-bold text-ink">
                    ${Number(s.price ?? 0).toFixed(2).padStart(5, '0')}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedService(s.id)}
                    className={cn(
                      'px-4 py-1.5 rounded-full text-[13px] font-medium',
                      selectedService === s.id ? 'bg-ink text-white' : 'bg-[#f6f6fb] text-ink'
                    )}
                  >
                    Select
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'about' && (
          <div className="mt-6 border-[0.75px] border-[#d2dbe9] rounded-[18px] p-5">
            <p className="text-[17px] font-bold text-ink">Biography</p>
            <p className="text-[14px] text-muted leading-6 mt-2">
              {barber?.bio ||
                'Specializing in classic fades, beard sculpting, and luxury hot towel shaves. Dedicated to providing a premium grooming experience'}
            </p>
            <div className="flex items-center gap-5 mt-5">
              <Facebook className="w-5 h-5 text-ink" strokeWidth={1.8} />
              <Twitter className="w-5 h-5 text-ink" strokeWidth={1.8} />
              <Instagram className="w-5 h-5 text-ink" strokeWidth={1.8} />
            </div>
          </div>
        )}

        {tab === 'reviews' && (
          <p className="text-sm text-muted text-center py-8 mt-2">No reviews yet.</p>
        )}

        {/* Actions */}
        <button
          type="button"
          onClick={() => navigate(`/customer/book/${id}`)}
          className="w-full bg-ink text-white text-[16px] font-semibold py-[20px] rounded-full mt-8"
        >
          Book Appointment
        </button>
        <button
          type="button"
          onClick={() => navigate('/customer')}
          className="w-full py-4 text-[15px] font-semibold text-muted"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
