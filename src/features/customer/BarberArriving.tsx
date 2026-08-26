import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  CheckCircle2,
  MessageSquare,
  Phone,
  Calendar,
  Clock,
  MapPin,
  Star,
  ImageIcon,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { authFetch } from '@/lib/api';

interface Booking {
  id: string;
  status: string;
  payment_status: string;
  total_amount: number;
  booking_date: string;
  start_time: string;
  barber_profiles: {
    id?: string;
    display_name: string;
    shop_name?: string;
    address_text?: string;
    rating_avg?: number | string;
    service_mode?: 'in_shop' | 'mobile' | 'both';
  };
  services: { name: string; price: number; duration_minutes?: number };
}

function DashedDivider() {
  return <div className="w-full border-t-[1.5px] border-dashed border-[#e3e1ec]" />;
}

function formatTime(value: string): string {
  const [h, m] = (value || '').split(':');
  const hour = Number(h);
  if (!Number.isFinite(hour)) return value;
  return `${hour % 12 === 0 ? 12 : hour % 12}:${m ?? '00'} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

// The screen is a stack of self-contained cards. Each is its own piece below so
// that the fetch at the top of the screen can be read without scrolling through
// two hundred lines of markup. Nothing they draw has changed.

function ArrivingHero({ firstName }: { firstName: string }) {
  return (
    <>
      {/* Hero card — Fee captured */}
      <div className="bg-surface rounded-[24px] px-6 py-10 flex flex-col items-center text-center">
        <div className="w-[120px] h-[120px] rounded-[16px] bg-white flex items-center justify-center">
          <CheckCircle2 className="w-[46px] h-[46px] text-ink" strokeWidth={1} />
        </div>
        <h1 className="text-[28px] font-bold text-ink mt-8">Booking confirmed</h1>
        <p className="text-[15px] text-muted mt-1">Your slot is locked in with {firstName}.</p>
        <span className="bg-ink text-white text-[14px] font-semibold px-6 py-3 rounded-full mt-5">
          Fee captured
        </span>
      </div>

      {/* Chat / Call */}
      <div className="flex gap-4 mt-6">
        <button
          type="button"
          className="flex-1 flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-full py-4 text-[16px] font-semibold text-ink"
        >
          <MessageSquare className="w-5 h-5" strokeWidth={1.8} /> Chat
        </button>
        <button
          type="button"
          className="flex-1 flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-full py-4 text-[16px] font-semibold text-ink"
        >
          <Phone className="w-5 h-5" strokeWidth={1.8} /> Call
        </button>
      </div>
    </>
  );
}

function JobSummary({
  booking,
  barber,
  address,
}: {
  booking: Booking | null;
  barber: Booking['barber_profiles'] | undefined;
  address: string | undefined;
}) {
  return (
    <>
      {/* Job Summary */}
      <h2 className="text-[22px] font-bold text-ink mt-8">Job Summary</h2>

      <div className="flex items-center gap-4 mt-5">
        <span className="w-12 h-12 rounded-[12px] bg-surface flex items-center justify-center shrink-0">
          <Calendar className="w-5 h-5 text-ink" strokeWidth={1.8} />
        </span>
        <span>
          <span className="block text-[16px] font-semibold text-ink">
            {booking?.services?.name || '—'}
          </span>
          <span className="block text-[13px] text-muted mt-0.5">
            {booking?.services?.duration_minutes ?? 60} mins
          </span>
        </span>
      </div>

      <div className="mt-5"><DashedDivider /></div>

      <div className="flex items-center gap-2.5 py-4">
        <Clock className="w-4 h-4 text-ink" strokeWidth={1.8} />
        <span className="text-[16px] font-semibold text-ink">
          {booking ? formatTime(booking.start_time) : '—'}
        </span>
      </div>
      <DashedDivider />
      <div className="flex items-center gap-2.5 py-4">
        <Calendar className="w-4 h-4 text-ink" strokeWidth={1.8} />
        <span className="text-[16px] font-semibold text-ink">
          {booking ? formatDate(booking.booking_date) : '—'}
        </span>
      </div>
      <DashedDivider />
      <div className="py-4">
        <div className="flex items-start gap-2.5">
          <MapPin className="w-4 h-4 text-ink mt-1" strokeWidth={1.8} />
          <div>
            <p className="text-[16px] font-semibold text-ink">
              {address || barber?.shop_name || 'In-shop'}
            </p>
            {address && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noreferrer"
                className="block text-[11px] font-semibold tracking-wide text-muted mt-1.5"
              >
                OPEN IN MAPS
              </a>
            )}
          </div>
        </div>
      </div>
      <DashedDivider />
    </>
  );
}

function PriceBreakdown({
  serviceTotal,
  feeAmount,
  remaining,
}: {
  serviceTotal: number;
  feeAmount: number;
  remaining: number;
}) {
  return (
    /* Price breakdown — dashed bordered card */
    <div className="border-[1.5px] border-dashed border-[#e3e1ec] rounded-[16px] px-4 mt-5">
      <div className="flex items-center justify-between py-4">
        <span className="text-[14px] text-ink">Service Total</span>
        <span className="text-[15px] font-bold text-ink">${Number(serviceTotal).toFixed(2)}</span>
      </div>
      <DashedDivider />
      <div className="flex items-center justify-between py-4">
        <span className="text-[14px] text-ink">Booking Fee (Captured)</span>
        <span className="text-[15px] font-bold text-ink">-${Number(feeAmount).toFixed(2)}</span>
      </div>
      <DashedDivider />
      <div className="flex items-center justify-between py-4">
        <span className="text-[17px] font-bold text-ink">Remaining at Shop</span>
        <span className="text-[17px] font-bold text-ink">${Number(remaining).toFixed(2)}</span>
      </div>
    </div>
  );
}

function BarberCard({
  barber,
  navigate,
}: {
  barber: Booking['barber_profiles'] | undefined;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    /* Barber card */
    <div className="border-[0.75px] border-[#d2dbe9] rounded-[20px] p-4 mt-6">
      <div className="flex gap-4">
        <div className="w-[110px] h-[110px] rounded-[12px] bg-surface flex items-center justify-center shrink-0">
          <ImageIcon className="w-8 h-8 text-[#d4d2e3]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[18px] font-bold text-ink truncate">{barber?.display_name || '—'}</p>
          <p className="flex items-center gap-2 text-[13px] mt-1.5">
            <Star className="w-4 h-4 fill-ink text-ink" />
            <span className="font-bold text-ink">{barber?.rating_avg ?? '—'}</span>
            <span className="text-muted">• 2.1 km</span>
          </p>
          <p className="text-[13px] text-ink mt-1.5">
            {barber?.service_mode === 'mobile'
              ? 'Comes to you'
              : barber?.service_mode === 'both'
                ? 'In-shop • Comes to you'
                : 'In-shop'}
          </p>
          <p className="flex items-center gap-1.5 text-[13px] text-muted mt-1.5">
            <Clock className="w-3.5 h-3.5" /> Available now
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => barber?.id && navigate(`/customer/barber/${barber.id}`)}
        className="w-full bg-ink text-white text-[14px] font-semibold py-4 rounded-full mt-4"
      >
        View Profile
      </button>
    </div>
  );
}

// Figma page 63 — Booking Status (confirmed): fee captured hero, Chat/Call,
// Job Summary rows, price breakdown, barber card, cancel/reschedule actions.
export default function BarberArriving() {
  const { id: bookingId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    if (!user?.id || !bookingId) return;
    let cancelled = false;
    authFetch(`/api/bookings`, {
      headers: {
      },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Booking[]) => {
        if (!cancelled) setBooking(data.find((b) => b.id === bookingId) || null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [bookingId, user?.id]);

  const barber = booking?.barber_profiles;
  const firstName = (barber?.display_name || 'your barber').split(' ')[0];
  const feeAmount = booking?.total_amount ?? 5;
  const serviceTotal = booking?.services?.price ?? 0;
  const remaining = Math.max(serviceTotal - feeAmount, 0);
  const address = barber?.address_text;

  return (
    <div className="min-h-screen bg-white pb-10">
      {/* Header */}
      <div className="flex items-center px-6 pt-16 pb-4">
        <button type="button" aria-label="Back" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-6 h-6 text-ink" strokeWidth={2.25} />
        </button>
        <p className="flex-1 text-center text-[18px] font-bold text-ink pr-6">Booking Status</p>
      </div>

      <div className="px-6">
        <ArrivingHero firstName={firstName} />

        <JobSummary booking={booking} barber={barber} address={address} />

        <PriceBreakdown serviceTotal={serviceTotal} feeAmount={feeAmount} remaining={remaining} />

        <BarberCard barber={barber} navigate={navigate} />

        {/* Actions */}
        <button
          type="button"
          onClick={() => navigate('/customer/bookings')}
          className="w-full bg-ink text-white text-[16px] font-semibold py-[20px] rounded-full mt-7"
        >
          Need to cancel or reschedule?
        </button>
        <button
          type="button"
          onClick={() => navigate('/customer/help')}
          className="w-full py-4 text-[15px] font-semibold text-muted text-center"
        >
          View Cancellation Policy
        </button>
      </div>
    </div>
  );
}
