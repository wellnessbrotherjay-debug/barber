import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MessageCircle, Phone, ImageIcon, FileText, Scissors, Calendar, DollarSign } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/store/useAuthStore';
import { authFetch } from '@/lib/api';

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  status: string;
  payment_status: string;
  total_amount: number;
  barber_profiles: { id: string; display_name: string; shop_name?: string };
  services: { name: string; price: number };
  // Revealed by the API only once the barber has accepted (see server query).
  barber_phone?: string | null;
}

// Booking Confirmed screen (Figma flow step 7) — shown once the barber has
// accepted (status === 'confirmed'). Chat/Call v1 open the device's native SMS
// composer / dialler with the barber's number (revealed by the API only after
// acceptance) — see docs/SCOPE_RECONCILIATION.md §5.
// The API returns booking_date as an ISO timestamp and start_time as "HH:MM:SS";
// the board shows "Tuesday, Oct 24 • 10:00 AM".
function formatBookingDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatBookingTime(value: string): string {
  const [h, m] = (value || '').split(':');
  const hour = Number(h);
  if (!Number.isFinite(hour)) return value;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m ?? '00'} ${suffix}`;
}

// Chat & call v1 (SCOPE_RECONCILIATION §5): honour the Figma promise
// by opening the device's native SMS composer / dialler with the
// barber's number, which the API only reveals after acceptance. If
// the barber has no phone on file, the buttons stay disabled.
//
// These two buttons are their own component because each has an enabled and a
// disabled form, which is four blocks of markup the screen does not need to
// carry itself.
function ContactButtons({ phone }: { phone?: string | null }) {
  return (
    <div className="flex flex-col gap-3">
      {phone ? (
        <a
          href={`sms:${phone}`}
          className="w-full flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-full py-4 text-[15px] font-semibold text-ink"
        >
          <MessageCircle className="w-5 h-5" strokeWidth={1.8} /> Chat
        </a>
      ) : (
        <button
          type="button"
          disabled
          title="Chat unlocks when your barber's number is available"
          className="w-full flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-full py-4 text-[15px] font-semibold text-ink opacity-60"
        >
          <MessageCircle className="w-5 h-5" strokeWidth={1.8} /> Chat
        </button>
      )}
      {phone ? (
        <a
          href={`tel:${phone}`}
          className="w-full flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-full py-4 text-[15px] font-semibold text-ink"
        >
          <Phone className="w-5 h-5" strokeWidth={1.8} /> Call
        </a>
      ) : (
        <button
          type="button"
          disabled
          title="Call unlocks when your barber's number is available"
          className="w-full flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-full py-4 text-[15px] font-semibold text-ink opacity-60"
        >
          <Phone className="w-5 h-5" strokeWidth={1.8} /> Call
        </button>
      )}
    </div>
  );
}

export default function BookingConfirmed() {
  const { id: bookingId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !bookingId) return;
    let cancelled = false;
    authFetch(`/api/bookings`, {
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Booking[]) => {
        if (!cancelled) setBooking(data.find((b) => b.id === bookingId) || null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bookingId, user?.id]);

  const barberName = booking?.barber_profiles?.display_name || 'your barber';
  const feePaid = booking?.payment_status === 'paid';

  return (
    <div className="min-h-screen bg-white pb-8">
      <div className="flex flex-col items-center justify-center px-8 pt-16 pb-8 text-center">
        <div className="w-[100px] h-[100px] rounded-[16px] bg-surface flex items-center justify-center mb-6">
          <ImageIcon className="w-9 h-9 text-muted" />
        </div>
        <h1 className="text-2xl font-bold text-ink mb-2">Booking Confirmed</h1>
        <p className="text-sm text-muted">
          Thank you for booking your appointment with {barberName}.
        </p>
      </div>

      <div className="px-5 space-y-5">
        {loading && <p className="text-sm text-muted text-center">Loading…</p>}

        {booking && (
          <div>
            <p className="flex items-center gap-2 text-[17px] font-bold text-ink mb-3">
              <FileText className="w-5 h-5" />
              Appointment
            </p>
            <div className="bg-surface rounded-[14px] p-4">
              <div className="flex items-start gap-3">
                <Scissors className="w-4 h-4 text-ink mt-1" />
                <div>
                  <p className="text-[12px] text-muted">Service Selected</p>
                  <p className="text-[15px] font-semibold text-ink">{booking.services?.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 mt-4">
                <Calendar className="w-4 h-4 text-ink mt-1" />
                <div>
                  <p className="text-[12px] text-muted">Date &amp; Time</p>
                  <p className="text-[15px] font-semibold text-ink">
                    {formatBookingDate(booking.booking_date)} • {formatBookingTime(booking.start_time)}
                  </p>
                </div>
              </div>
              <p className="text-[14px] text-ink mt-4">with {barberName}</p>
            </div>
          </div>
        )}

        {/* Figma page 32 — offline payment note card */}
        <Card className="p-4 bg-surface border-0">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-[10px] bg-white flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5 text-ink" strokeWidth={1.8} />
            </span>
            <p className="text-[16px] font-bold text-ink">Important Note: Offline Payment</p>
          </div>
          <p className="text-[14px] text-ink leading-6 mt-4">
            {feePaid ? (
              <>Your booking fee of <span className="font-bold">${Number(booking?.total_amount ?? 5).toFixed(2)}</span> has been received. You can now chat with your barber.</>
            ) : (
              'Your booking fee will be collected to confirm this slot.'
            )}
          </p>
          <p className="text-[14px] font-bold text-ink leading-6 mt-4">
            The haircut payment will be handled directly with the barber at the time of the
            service.
          </p>
        </Card>

        <ContactButtons phone={booking?.barber_phone} />
      </div>
    </div>
  );
}
