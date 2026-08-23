import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerNav from '@/components/CustomerNav';
import { cn } from '@/lib/utils';
import { ChevronLeft, MessageCircle, Phone, Clock, MapPin } from 'lucide-react';
import { formatShortDateTime } from '@/lib/datetime';
import { useAuthStore } from '@/store/useAuthStore';

// Figma node 1:1171 "Booking History" — segmented Upcoming/Past tabs over
// bordered booking cards.
const TABS = ['Upcoming', 'Past'] as const;

interface Booking {
  id: string;
  status: string;
  payment_status: string;
  booking_date: string;
  start_time: string;
  barber_profiles: { id: string; display_name: string; shop_name: string | null };
  services: { id: string; name: string; price: number; duration_minutes: number };
  // Revealed by the API only after the barber accepts (chat/call v1 — §5).
  barber_phone?: string | null;
}

function groupTab(status: string): (typeof TABS)[number] {
  // Cancelled and completed bookings are both history on the board's two tabs.
  if (status === 'cancelled' || status === 'completed') return 'Past';
  return 'Upcoming';
}

export default function BookingHistory() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Upcoming');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchBookings() {
      try {
        setLoading(true);
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/bookings`, {
          headers: {
            'X-Session-Token': `1:${user!.id}`,
            Authorization: `Bearer ${localStorage.getItem('barberSyncToken') || ''}`,
            'X-User-ID': user!.id,
          },
        });
        if (!response.ok) throw new Error(`Failed to fetch bookings: ${response.status}`);
        const data = await response.json();
        if (!cancelled) setBookings(data);
      } catch (err) {
        if (!cancelled) setError(`${err}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchBookings();
    return () => { cancelled = true; };
  }, [user?.id]);

  const grouped = bookings.filter((b) => groupTab(b.status) === tab);

  return (
    <div className="min-h-screen bg-white pb-[88px]">
      {/* Top navigation bar — Figma 1:1184: back chevron, centered bold title */}
      <div className="bg-white flex items-center gap-1.5 px-5 py-4 pt-14">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-6 h-6 flex items-center justify-center shrink-0"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5 text-[#1c1b1f]" />
        </button>
        <p className="flex-1 text-center text-[16px] font-bold leading-6 text-[#1c1b1f]">
          Booking History
        </p>
        <span className="w-6 h-6 shrink-0" />
      </div>

      {/* Segmented tabs — Figma 1:1190 */}
      <div className="bg-white px-5 py-4">
        <div className="flex bg-[#eff1f5] rounded-[999px] p-[3px]">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 p-3 rounded-[999px] text-[14px] leading-5 text-center transition-colors',
                tab === t ? 'bg-white font-semibold text-[#1c1b1f]' : 'font-medium text-[#676372]',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Booking cards — Figma 1:1196 */}
      <div className="px-5 space-y-4">
        {loading && <p className="text-center text-sm text-muted py-8">Loading bookings…</p>}
        {error && <p className="text-center text-sm text-red-600 py-8">{error}</p>}
        {!loading && !error && grouped.length === 0 && (
          <p className="text-center text-sm text-muted py-8">No {tab.toLowerCase()} bookings</p>
        )}
        {!loading && !error && grouped.map((b) => (
          <div
            key={b.id}
            className="bg-white border-[0.75px] border-[#d2dbe9] rounded-[12px] p-3 flex flex-col gap-3"
          >
            {/* Name / service + status pill */}
            <div className="flex items-start justify-between w-full">
              <div className="flex flex-col gap-1">
                <p className="text-[14px] font-semibold leading-5 text-[#1c1b1f]">
                  {b.barber_profiles?.display_name || 'Barber'}
                </p>
                <p className="text-[12px] font-medium leading-4 text-[#a09cab] truncate max-w-[235px]">
                  {b.services?.name}
                </p>
              </div>
              <span className="flex items-center gap-1 bg-[#f8f8f8] rounded-full px-3 py-1.5 shrink-0">
                <span className="w-[3px] h-[3px] rounded-full bg-[#514e59]" />
                <span className="text-[10px] font-medium leading-3 text-[#514e59]">
                  {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                </span>
              </span>
            </div>

            {/* Time row between dashed dividers */}
            <div className="flex flex-col gap-3 w-full">
              <hr className="border-t-[0.5px] border-dashed border-[#d2dbe9] w-full" />
              <p className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#1c1b1f]" />
                <span className="text-[10px] font-semibold leading-[14px] text-black">
                  {formatShortDateTime(b.booking_date, b.start_time)}
                </span>
              </p>
              <hr className="border-t-[0.5px] border-dashed border-[#d2dbe9] w-full" />
            </div>

            {/* Location */}
            {b.barber_profiles?.shop_name && (
              <div className="flex flex-col gap-3 w-full">
                <div className="flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#1c1b1f]" />
                  <div className="flex flex-col gap-1">
                    <p className="text-[12px] font-semibold leading-4 text-[#1c1b1f]">
                      {b.barber_profiles.shop_name}
                    </p>
                  </div>
                </div>
                <hr className="border-t-[0.5px] border-dashed border-[#d2dbe9] w-full" />
              </div>
            )}

            {/* Chat / Call — v1 opens the native SMS composer / dialler with
                the barber's number, which the API only reveals after the
                barber accepts (docs/SCOPE_RECONCILIATION.md §5). */}
            <div className="flex gap-2 w-full">
              {b.barber_phone ? (
                <a
                  href={`sms:${b.barber_phone}`}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-[999px] px-7 py-3.5 text-[14px] font-semibold leading-5 text-[#1c1b1f]"
                >
                  <MessageCircle className="w-5 h-5" /> Chat
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Chat unlocks after your barber accepts"
                  className="flex-1 flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-[999px] px-7 py-3.5 text-[14px] font-semibold leading-5 text-[#1c1b1f] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <MessageCircle className="w-5 h-5" /> Chat
                </button>
              )}
              {b.barber_phone ? (
                <a
                  href={`tel:${b.barber_phone}`}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-[999px] px-7 py-3.5 text-[14px] font-semibold leading-5 text-[#1c1b1f]"
                >
                  <Phone className="w-5 h-5" /> Call
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Call unlocks after your barber accepts"
                  className="flex-1 flex items-center justify-center gap-2 bg-[#f6f7fb] rounded-[999px] px-7 py-3.5 text-[14px] font-semibold leading-5 text-[#1c1b1f] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <Phone className="w-5 h-5" /> Call
                </button>
              )}
            </div>

            {/* Note */}
            <div className="bg-[#f4f5f8] rounded-[8px] px-3 pt-[11px] pb-3 w-full">
              <p className="text-[12px] font-medium leading-4 text-[#1c1b1f]">
                <span className="font-bold">Note:</span> Booking fee paid. Haircut payment is made
                directly to the barber after service.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1 w-full">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    b.status === 'completed'
                      ? `/customer/rate/${b.id}`
                      : `/customer/booking-confirmed/${b.id}`,
                  )
                }
                className="w-full bg-[#1c1b1f] text-white rounded-[999px] px-9 py-[18px] text-[14px] font-semibold leading-5 text-center active:scale-[0.99] transition-transform"
              >
                View Details
              </button>
              {tab === 'Upcoming' && (
                <button
                  type="button"
                  onClick={() => navigate(`/customer/booking-confirmed/${b.id}`)}
                  className="w-full px-9 py-[18px] text-[14px] font-semibold leading-5 text-[#a09cab] text-center"
                >
                  Cancel Booking
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <CustomerNav active="bookings" />
    </div>
  );
}
