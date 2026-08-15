import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, XCircle, ImageIcon, MessageSquare, Phone } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

interface Booking {
  id: string;
  barber_profiles: { display_name: string };
}

// Figma page 40 — "Appointment confirmed" (Payment Confirmed): chat & call
// unlocked card + View Details CTA.
export default function AppointmentConfirmed() {
  const { id: bookingId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    if (!user?.id || !bookingId) return;
    let cancelled = false;
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/bookings`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('barberSyncToken') || ''}`,
        'X-Session-Token': `1:${user.id}`,
        'X-User-ID': user.id,
      },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Booking[]) => {
        if (!cancelled) setBooking(data.find((b) => b.id === bookingId) || null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [bookingId, user?.id]);

  const firstName = (booking?.barber_profiles?.display_name || 'your barber').split(' ')[0];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex items-center px-6 pt-16 pb-2">
        <button type="button" aria-label="Back" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-6 h-6 text-ink" strokeWidth={2.25} />
        </button>
      </div>

      <div className="px-6 flex flex-col items-center text-center pt-6">
        <div className="w-[136px] h-[136px] rounded-[16px] bg-surface flex items-center justify-center">
          {/* Board renders the circled-x placeholder glyph on this frame */}
          <XCircle className="w-[52px] h-[52px] text-ink" strokeWidth={1} />
        </div>
        <h1 className="text-[26px] font-bold text-ink mt-6">Appointment confirmed</h1>
        <p className="text-[15px] text-muted mt-1">Payment Confirmed</p>
      </div>

      <div className="px-6 mt-8">
        <div className="border-[0.75px] border-[#d2dbe9] rounded-[20px] p-4">
          <div className="bg-[#f6f7fb] rounded-[16px] p-4 flex items-start gap-3">
            <span className="w-11 h-11 rounded-full bg-white flex items-center justify-center shrink-0">
              <ImageIcon className="w-5 h-5 text-muted" />
            </span>
            <span>
              <span className="block text-[16px] font-bold text-ink">
                Chat and call are now unlocked.
              </span>
              <span className="block text-[14px] text-muted leading-5 mt-1">
                You can coordinate directly with {firstName} for your arrival.
              </span>
            </span>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-full py-4 text-[15px] font-semibold text-ink"
            >
              <MessageSquare className="w-5 h-5" strokeWidth={1.8} /> Chat
            </button>
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-full py-4 text-[15px] font-semibold text-ink"
            >
              <Phone className="w-5 h-5" strokeWidth={1.8} /> Call
            </button>
          </div>
        </div>
      </div>

      <div className="mt-auto px-6 pb-8">
        <button
          type="button"
          onClick={() => navigate(bookingId ? `/customer/arriving/${bookingId}` : '/customer/bookings')}
          className="w-full bg-ink text-white text-[16px] font-semibold py-[20px] rounded-full"
        >
          View Details
        </button>
      </div>
    </div>
  );
}
