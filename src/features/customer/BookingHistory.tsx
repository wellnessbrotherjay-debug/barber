import React, { useEffect, useState } from 'react';
import { CentredTitle, DotSeparator, IconButton, SmallLabel } from '../../components/ScreenPieces';
import { useNavigate } from 'react-router-dom';
import CustomerNav from '@/components/CustomerNav';
import { cn } from '@/lib/utils';
import { ChevronLeft, MessageCircle, Phone, Clock, MapPin } from 'lucide-react';
import { formatShortDateTime } from '@/lib/datetime';
import { useAuthStore } from '@/store/useAuthStore';
import { authFetch } from '@/lib/api';

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

// The header, the tab strip and a single booking card are each their own piece
// below. They were pulled out of the screen because the screen had grown long
// enough that the data-loading at the top of it was hard to find among the
// markup; nothing about what they draw has changed.

function BookingHistoryHeader({ onBack }: { onBack: () => void }) {
  return (
    /* Top navigation bar — Figma 1:1184: back chevron, centered bold title */
    <div className="bg-white flex items-center gap-1.5 px-5 py-4 pt-14">
      <IconButton label="Back" onClick={onBack}>
        <ChevronLeft className="w-5 h-5 text-[#1c1b1f]" />
      </IconButton>
      <CentredTitle>
        Booking History
      </CentredTitle>
      <span className="w-6 h-6 shrink-0" />
    </div>
  );
}

function BookingTabs({
  tab,
  onSelect,
}: {
  tab: (typeof TABS)[number];
  onSelect: (t: (typeof TABS)[number]) => void;
}) {
  return (
    /* Segmented tabs — Figma 1:1190 */
    <div className="bg-white px-5 py-4">
      <div className="flex bg-[#eff1f5] rounded-[999px] p-[3px]">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onSelect(t)}
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
  );
}

/* Chat / Call — v1 opens the native SMS composer / dialler with
   the barber's number, which the API only reveals after the
   barber accepts (docs/SCOPE_RECONCILIATION.md §5). */
function BookingContactButtons({ phone }: { phone: string | null | undefined }) {
  return (
    <div className="flex gap-2 w-full">
      {phone ? (
        <a
          href={`sms:${phone}`}
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
      {phone ? (
        <a
          href={`tel:${phone}`}
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
  );
}

function BookingCard({
  b,
  tab,
  navigate,
}: {
  b: Booking;
  tab: (typeof TABS)[number];
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <div
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
          <DotSeparator />
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
              <SmallLabel>
                {b.barber_profiles.shop_name}
              </SmallLabel>
            </div>
          </div>
          <hr className="border-t-[0.5px] border-dashed border-[#d2dbe9] w-full" />
        </div>
      )}

      <BookingContactButtons phone={b.barber_phone} />

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
  );
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
        const response = await authFetch(`/api/bookings`, {
          headers: {
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
      <BookingHistoryHeader onBack={() => navigate(-1)} />

      <BookingTabs tab={tab} onSelect={setTab} />

      {/* Booking cards — Figma 1:1196 */}
      <div className="px-5 space-y-4">
        {loading && <p className="text-center text-sm text-muted py-8">Loading bookings…</p>}
        {error && <p className="text-center text-sm text-red-600 py-8">{error}</p>}
        {!loading && !error && grouped.length === 0 && (
          <p className="text-center text-sm text-muted py-8">No {tab.toLowerCase()} bookings</p>
        )}
        {!loading && !error && grouped.map((b) => (
          <BookingCard key={b.id} b={b} tab={tab} navigate={navigate} />
        ))}
      </div>

      <CustomerNav active="bookings" />
    </div>
  );
}
