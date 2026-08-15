import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MessageCircle, Phone, ImageIcon, FileText, Scissors, Calendar, DollarSign } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/store/useAuthStore';

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  status: string;
  payment_status: string;
  total_amount: number;
  barber_profiles: { id: string; display_name: string; shop_name?: string };
  services: { name: string; price: number };
}

// Booking Confirmed screen (Figma flow step 7) — shown once the barber has
// accepted (status === 'confirmed'). Chat/Call are honest UI-only placeholders:
// there is no real chat backend built yet, so both buttons are disabled with a
// "coming soon" label rather than pretending to open a working conversation.
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

export default function BookingConfirmed() {
  const { id: bookingId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !bookingId) return;
    let cancelled = false;
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/bookings`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('barberSyncToken') || ''}`, 'X-Session-Token': `1:${user.id}`, 'X-User-ID': user.id },
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

        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled
            title="Chat is coming soon — not built yet"
            className="w-full flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-full py-4 text-[15px] font-semibold text-ink"
          >
            <MessageCircle className="w-5 h-5" strokeWidth={1.8} /> Chat
          </button>
          <button
            type="button"
            disabled
            title="Call is coming soon — not built yet"
            className="w-full flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-full py-4 text-[15px] font-semibold text-ink"
          >
            <Phone className="w-5 h-5" strokeWidth={1.8} /> Call
          </button>
        </div>
      </div>
    </div>
  );
}
