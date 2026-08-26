import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Calendar, CircleCheck, TrendingUp } from 'lucide-react';
import BarberNav from '@/components/BarberNav';
import { fetchBarberBookingsForUser } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

interface Booking {
  id: string;
  booking_date: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  payment_status: 'unpaid' | 'pending' | 'paid' | 'refunded';
  total_amount: string | number;
  users?: { full_name?: string };
  services?: { name?: string };
}

type Filter = 'all' | 'completed' | 'cancelled' | 'no_show';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'no_show', label: 'No-Show' },
];

/* Grey status pill — Figma page 56 history rows */
function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center bg-[#f8f8f8] rounded-full px-3 py-1.5 text-[10px] leading-3 font-medium text-[#514e59]">
      {label}
    </span>
  );
}

function statusLabel(status: string): string {
  if (status === 'completed') return 'Completed';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'no_show') return 'No-show';
  if (status === 'confirmed') return 'Confirmed';
  return 'Pending';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function BarberWallet() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchBarberBookingsForUser(user.id);
        if (!res.ok) throw new Error(`Failed to load bookings: ${res.status}`);
        const data = await res.json();
        if (!cancelled) setBookings(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(`[BarberWallet] loading wallet takings failed:`, err);
        if (!cancelled) setBookings([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const stats = useMemo(() => {
    const totalBookings = bookings.length;
    const completedJobs = bookings.filter((b) => b.status === 'completed').length;
    const feesCollected = bookings
      .filter((b) => b.payment_status === 'paid')
      .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
    return { totalBookings, completedJobs, feesCollected };
  }, [bookings]);

  // No-show data derived from real bookings where available; penalties have no
  // schema backing yet, so we show the real (zero) amount rather than a fake one.
  const noShowStats = useMemo(() => {
    const now = new Date();
    const noShows = bookings.filter((b) => {
      if (b.status !== 'no_show') return false;
      const d = new Date(b.booking_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    return { count: noShows.length, penalty: 0 };
  }, [bookings]);

  const filtered = bookings.filter((b) => (filter === 'all' ? true : b.status === filter));

  function feeAmount(b: Booking): string {
    if (b.status === 'cancelled') return '-----';
    return `$${Number(b.total_amount || 0).toFixed(2)}`;
  }

  function feeLabel(b: Booking): string {
    if (b.status === 'cancelled') return 'No Fee';
    if (b.status === 'no_show') return 'Penalty Fee';
    return 'Booking Fee';
  }

  const STAT_CARDS = [
    { icon: Calendar, label: ['Total', 'Bookings'], value: loading ? '—' : String(stats.totalBookings) },
    { icon: CircleCheck, label: ['Completed', 'Jobs'], value: loading ? '—' : String(stats.completedJobs) },
    { icon: TrendingUp, label: ['Fees', 'Collected'], value: loading ? '—' : `$${stats.feesCollected.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
  ];

  return (
    <div className="min-h-screen bg-white pb-[88px]">
      {/* Top Navigation Bar — Figma page 56 */}
      <div className="flex items-center justify-center gap-1.5 px-5 py-4 pt-14 bg-white">
        <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="w-6 h-6 flex items-center justify-center shrink-0">
          <ChevronLeft className="w-6 h-6 text-[#1c1b1f]" strokeWidth={2} />
        </button>
        <p className="flex-1 text-center text-[16px] leading-6 font-bold text-[#1c1b1f]">Wallet</p>
        <span className="w-6 h-6 shrink-0" />
      </div>

      {/* Stat cards row */}
      <div className="px-5 py-4 grid grid-cols-3 gap-3">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label.join(' ')} className="bg-white border-[0.75px] border-[#d2dbe9] rounded-[12px] p-3 flex flex-col gap-3">
              <div className="w-[42px] h-[42px] bg-[#f2f1fa] rounded-[8px] flex items-center justify-center">
                <Icon className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.8} />
              </div>
              <p className="text-[12px] leading-4 font-medium text-[#a09cab]">
                {card.label[0]}
                <br />
                {card.label[1]}
              </p>
              <p className="text-[18px] leading-6 font-bold text-[#1c1b1f]">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* No-show & Penalties — Figma page 56 */}
      <div className="px-5 py-4">
        <h2 className="text-[18px] leading-6 font-bold text-[#1c1b1f]">No-show &amp; Penalties</h2>
      </div>
      <div className="px-5">
        <div className="bg-white border-[0.75px] border-[#d2dbe9] rounded-[12px] p-3 flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-[12px] leading-4 font-medium text-[#a09cab]">No-show reports (this month)</p>
            <p className="text-[16px] leading-6 font-bold text-[#1c1b1f]">{loading ? '—' : noShowStats.count}</p>
          </div>
          <div className="flex flex-col gap-1 items-end text-right">
            <p className="text-[12px] leading-4 font-medium text-[#a09cab]">Penalty applied</p>
            <p className="text-[16px] leading-6 font-bold text-[#1c1b1f]">${noShowStats.penalty.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* History — Figma page 56 */}
      <div className="px-5 py-4 mt-2">
        <h2 className="text-[18px] leading-6 font-bold text-[#1c1b1f]">History</h2>
      </div>

      <div className="px-5 flex gap-[9px] flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`px-4 py-3 rounded-[10px] text-[12px] leading-4 font-semibold transition-colors ${
              filter === f.key ? 'bg-[#1c1b1f] text-white' : 'border-[0.75px] border-[#d2dbe9] text-[#514e59]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="px-5 py-4 space-y-4">
        {loading ? (
          <p className="text-center text-sm text-[#a09cab] py-8">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-[#a09cab] py-8">No transactions yet</p>
        ) : (
          filtered.map((b) => (
            <div key={b.id} className="bg-white border-[0.75px] border-[#d2dbe9] rounded-[12px] p-3 flex items-start justify-between">
              <div className="flex flex-col gap-2">
                <p className="text-[14px] leading-5 font-semibold text-[#1c1b1f]">{b.users?.full_name || 'Customer'}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] leading-4 font-medium text-[#a09cab]">{formatDate(b.booking_date)}</span>
                  <StatusPill label={statusLabel(b.status)} />
                </div>
              </div>
              <div className="flex flex-col gap-1 items-end text-right">
                <p className="text-[16px] leading-6 font-bold text-[#1c1b1f]">{feeAmount(b)}</p>
                <p className="text-[12px] leading-4 font-medium text-[#a09cab]">{feeLabel(b)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <BarberNav active="wallet" />
    </div>
  );
}
