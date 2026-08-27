import React, { useEffect, useState } from 'react';
import { useBooking } from '../../lib/useBooking';
import { useNavigate, useParams } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { formatLongDate, formatTime } from '@/lib/datetime';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/useAuthStore';
import { authFetch } from '@/lib/api';

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  barber_profiles: { display_name: string };
}

// Shown when the barber declines (status -> 'cancelled' via the existing
// POST /api/bookings/:id/cancel endpoint, which the barber-side agent's UI calls).
export default function BookingRejected() {
  const { id: bookingId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { booking } = useBooking<Booking>(bookingId);

  const barberName = booking?.barber_profiles?.display_name || 'This barber';
  const when = booking
    ? `${formatLongDate(booking.booking_date)} at ${formatTime(booking.start_time)}`
    : 'your requested time';

  // Figma page 17 — icon block sits in the upper third, actions pinned to the bottom.
  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 text-center">
      <div
        className="w-[136px] h-[136px] rounded-[16px] bg-surface flex items-center justify-center"
        style={{ marginTop: 180 }}
      >
        <XCircle className="w-[52px] h-[52px] text-ink" strokeWidth={1} />
      </div>
      <h1 className="text-[28px] leading-9 font-bold text-ink mt-6">Booking rejected</h1>
      <p className="text-[15px] text-muted mt-2 leading-6 max-w-[340px]">
        {barberName} couldn't accept your request for {when}. No charges were made to your
        card.
      </p>

      <div className="mt-auto w-full pb-6">
        <Button size="lg" onClick={() => navigate('/customer')} className="w-full rounded-full py-[18px]">
          Choose another barber
        </Button>
        <button
          type="button"
          onClick={() => navigate('/customer')}
          className="w-full text-[15px] text-muted font-semibold py-4 mt-2"
        >
          Browse all barbers
        </button>
      </div>
    </div>
  );
}
