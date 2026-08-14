import React, { useEffect, useMemo, useState } from 'react';
import BarberNav from '@/components/BarberNav';
import { fetchBarberBookingsForUser } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

interface Booking {
  id: string;
  booking_date: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  payment_status: 'unpaid' | 'pending' | 'paid' | 'refunded';
  total_amount: string | number;
  users?: { full_name?: string };
  services?: { name?: string };
}

type Filter = 'all' | 'completed' | 'cancelled';

export default function BarberWallet() {
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
      } catch {
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

  // NOTE: this schema has no no_show booking status and no penalty concept yet
  // (bookings.status is only pending/confirmed/cancelled/completed — see
  // docs/DATABASE_SCHEMA.sql). Showing an honest zero state instead of a
  // fabricated number. If a no_show status is added later, wire real counts here.
  const noShowCount = 0;
  const penaltyAmount = 0;

  const filtered = bookings.filter((b) => {
    if (filter === 'all') return true;
    return b.status === filter;
  });

  function amountLabel(b: Booking) {
    if (b.status === 'cancelled') return 'No Fee';
    if (b.payment_status === 'paid') return 'Booking Fee';
    return 'Unpaid';
  }

  function statusBadgeClass(status: string) {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      case 'confirmed':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-[#f2f1fa] text-[#6c6a75]';
    }
  }

  return (
    <div className="min-h-screen bg-white pb-[88px]">
      <div className="px-5 pt-14 pb-4">
        <h1 className="text-[16px] font-bold">Wallet</h1>
      </div>

      <div className="px-5 grid grid-cols-3 gap-3 mb-4">
        <div className="bg-[#1c1b1f] rounded-2xl p-4 text-white">
          <p className="text-[11px] text-white/60">Total Bookings</p>
          <p className="text-xl font-bold mt-1">{loading ? '—' : stats.totalBookings}</p>
        </div>
        <div className="bg-[#fafaff] rounded-2xl p-4">
          <p className="text-[11px] text-[#a09cab]">Completed Jobs</p>
          <p className="text-xl font-bold mt-1">{loading ? '—' : stats.completedJobs}</p>
        </div>
        <div className="bg-[#fafaff] rounded-2xl p-4">
          <p className="text-[11px] text-[#a09cab]">Fees Collected</p>
          <p className="text-xl font-bold mt-1">{loading ? '—' : `$${stats.feesCollected.toFixed(2)}`}</p>
        </div>
      </div>

      <div className="px-5 mb-6">
        <div className="bg-[#fff7f0] border border-[#f4e3d0] rounded-2xl p-4">
          <p className="text-sm font-semibold text-[#1c1b1f]">No-show &amp; Penalties</p>
          <div className="flex justify-between mt-2">
            <div>
              <p className="text-xs text-[#a09cab]">No-show reports (this month)</p>
              <p className="text-lg font-bold">{noShowCount}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#a09cab]">Penalty applied</p>
              <p className="text-lg font-bold">${penaltyAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5">
        <h2 className="font-semibold text-sm mb-3">History</h2>
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {(['all', 'completed', 'cancelled'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                filter === f ? 'bg-[#1c1b1f] text-white' : 'bg-[#f2f1fa] text-[#6c6a75]'
              }`}
            >
              {f === 'all' ? 'All' : f === 'completed' ? 'Completed' : 'Cancelled'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-sm text-[#a09cab] py-8">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-[#a09cab] py-8">No transactions yet</p>
        ) : (
          filtered.map((b) => (
            <div key={b.id} className="flex justify-between items-center py-3 border-b border-[#f0f0f0]">
              <div>
                <p className="text-sm font-medium">{b.users?.full_name || 'Customer'}</p>
                <p className="text-xs text-[#a09cab]">
                  {new Date(b.booking_date).toLocaleDateString()} ·{' '}
                  <span className={`inline-block px-1.5 py-0.5 rounded-full ${statusBadgeClass(b.status)}`}>
                    {b.status}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">${Number(b.total_amount || 0).toFixed(2)}</p>
                <p className="text-[10px] text-[#a09cab]">{amountLabel(b)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <BarberNav active="wallet" />
    </div>
  );
}
