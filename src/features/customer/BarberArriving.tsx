import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Navigation, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuthStore } from '@/store/useAuthStore';

interface Booking {
  id: string;
  status: string;
  payment_status: string;
  total_amount: number;
  booking_date: string;
  start_time: string;
  barber_profiles: { display_name: string; shop_name?: string };
  services: { name: string; price: number };
}

// Post-confirmation "job in progress" screen for the customer. Honesty note:
// the backend has no real live location/ETA feed for a barber en route, so
// this intentionally shows a generic "your barber is on the way" state and a
// static placeholder map area rather than a fabricated countdown or arrival time.
export default function BarberArriving() {
  const { id: bookingId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [booking, setBooking] = useState<Booking | null>(null);

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
      .catch(() => {});
    return () => { cancelled = true; };
  }, [bookingId, user?.id]);

  const feeAmount = booking?.total_amount ?? 5;
  const serviceTotal = booking?.services?.price ?? 0;
  const remaining = Math.max(serviceTotal - feeAmount, 0);

  return (
    <div className="min-h-screen bg-white pb-8">
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-surface rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-ink" />
        </button>
        <h1 className="text-lg font-bold text-ink">Booking confirmed</h1>
      </div>

      <div className="px-5 space-y-5">
        {/* Static placeholder map — no live tracking backend exists yet */}
        <div className="w-full h-40 rounded-[16px] bg-surface flex flex-col items-center justify-center gap-2">
          <Navigation className="w-8 h-8 text-muted" />
          <p className="text-xs text-muted">Your barber is on the way</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="success">Fee captured</Badge>
          <span className="text-sm font-semibold text-ink">
            Your slot is locked in with {booking?.barber_profiles?.display_name || 'your barber'}
          </span>
        </div>

        <Card className="p-4 space-y-2">
          <p className="text-sm font-semibold text-ink mb-1">Job Summary</p>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Service Total</span>
            <span className="font-semibold text-ink">${serviceTotal}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Booking Fee (Captured)</span>
            <span className="font-semibold text-ink">${feeAmount}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
            <span className="text-muted">Remaining at Shop</span>
            <span className="font-semibold text-ink">${remaining}</span>
          </div>
        </Card>

        <button
          type="button"
          onClick={() => navigate('/customer/bookings')}
          className="w-full text-sm font-semibold text-ink py-3 text-left"
        >
          Need to cancel or reschedule?
        </button>
        <button
          type="button"
          onClick={() => navigate('/customer/help')}
          className="w-full flex items-center gap-2 text-sm font-semibold text-muted py-1"
        >
          <ShieldCheck className="w-4 h-4" /> View Cancellation Policy
        </button>
      </div>
    </div>
  );
}
