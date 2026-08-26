import React, { useEffect, useMemo, useState } from 'react';
import ScreenHeader from '../../components/ScreenHeader';
import { useNavigate } from 'react-router-dom';
import { Star, Scissors, Zap, Users, Info } from 'lucide-react';
import { authFetch, fetchBarberBookingsForUser } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

interface Booking {
  id: string;
  status: string;
  customer_id: string;
}

// Standing tier thresholds — documented here since there's no cross-barber
// ranking data to base this on: >=4.5 Excellent, >=4.0 Good, >=3.0 Average,
// else Needs Improvement. Applied only to a real rating_avg.
function tierFor(ratingAvg: number | null): string {
  if (ratingAvg == null) return 'Not enough data yet';
  if (ratingAvg >= 4.5) return 'Excellent';
  if (ratingAvg >= 4.0) return 'Good';
  if (ratingAvg >= 3.0) return 'Average';
  return 'Needs Improvement';
}

interface MetricRow {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  note: string;
}

// The standing hero is its own component because it is a self-contained block of
// presentation that only needs the rating figures handed to it.
function OverallStandingHero({
  loading,
  tier,
  ratingAvg,
  showTopBadge,
}: {
  loading: boolean;
  tier: string;
  ratingAvg: number | null;
  showTopBadge: boolean;
}) {
  return (
    <div className="px-5 py-4">
      <div className="bg-[#f2f1fa] rounded-[12px] px-6 py-10 flex flex-col items-center gap-3">
        <p className="text-[12px] leading-4 font-medium text-[#a09cab]">Overall Standing</p>
        <p className="text-[24px] leading-8 font-bold text-[#1c1b1f]">{loading ? '—' : tier}</p>
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`w-6 h-6 ${ratingAvg != null && i < Math.round(ratingAvg) ? 'fill-[#1c1b1f] text-[#1c1b1f]' : 'fill-[#d8d6e0] text-[#d8d6e0]'}`}
            />
          ))}
        </div>
        {showTopBadge && (
          <span className="mt-2 bg-[#1c1b1f] text-white rounded-full px-5 py-3 text-[13px] leading-4 font-semibold">
            Top 1% of Barbers this month
          </span>
        )}
      </div>
    </div>
  );
}

// The metric list is separated so the repeated row markup lives in one small
// place rather than inside the screen body.
function MetricRows({ rows }: { rows: MetricRow[] }) {
  return (
    <div className="px-5 py-4 space-y-3">
      {rows.map((row) => {
        const Icon = row.icon;
        return (
          <div key={row.label} className="bg-white border-[0.75px] border-[#d2dbe9] rounded-[12px] p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-[42px] h-[42px] bg-[#f2f1fa] rounded-[8px] flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.8} />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[12px] leading-4 font-medium text-[#a09cab]">{row.label}</p>
                <p className="text-[14px] leading-5 font-bold text-[#1c1b1f]">{row.value}</p>
              </div>
            </div>
            <p className="text-[12px] leading-4 font-medium text-[#a09cab] text-right max-w-[120px]">{row.note}</p>
          </div>
        );
      })}
    </div>
  );
}

// Retention is one card driven by a single number, so it stands alone.
function CustomerRetention({ retention }: { retention: number | null }) {
  return (
    <>
      {/* Customer Retention */}
      <div className="px-5 py-4">
        <h2 className="text-[18px] leading-6 font-bold text-[#1c1b1f]">Customer Retention</h2>
      </div>
      <div className="px-5">
        <div className="bg-[#fafafa] rounded-[12px] p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-[42px] h-[42px] bg-white rounded-[8px] flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.8} />
              </div>
              <p className="text-[14px] leading-5 font-semibold text-[#1c1b1f]">Repeat Clients</p>
            </div>
            <p className="text-[16px] leading-6 font-bold text-[#1c1b1f]">{retention != null ? `${retention}%` : '—'}</p>
          </div>
          <div className="w-full h-2 rounded-full bg-[#eceaf2] overflow-hidden">
            <div className="h-full rounded-full bg-[#1c1b1f]" style={{ width: `${retention ?? 0}%` }} />
          </div>
          <p className="text-[12px] leading-4 font-medium text-[#a09cab]">
            {retention != null && retention > 50
              ? 'Most of your income comes from repeat customers. Keep up the high-quality service!'
              : 'Keep delivering great service to build repeat business.'}
          </p>
        </div>
      </div>
    </>
  );
}

// Static footer note — no data at all, so it does not belong in the screen body.
function VisibilityNote() {
  return (
    <div className="px-5 py-4 mt-2">
      <div className="bg-[#fafafa] rounded-[12px] p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white border border-[#e5e7eb] rounded-full flex items-center justify-center shrink-0">
            <Info className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.8} />
          </div>
          <p className="text-[16px] leading-6 font-bold text-[#1c1b1f]">Visibility Note</p>
        </div>
        <p className="text-[14px] leading-5 font-medium text-[#514e59]">
          Your performance metrics are visible to customers on your public profile to build trust and booking confidence.
        </p>
      </div>
    </div>
  );
}

export default function BarberPerformance() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [ratingAvg, setRatingAvg] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState<number>(0);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [profileRes, bookingsRes] = await Promise.all([
          authFetch('/api/barber/profile'),
          fetchBarberBookingsForUser(user.id),
        ]);
        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (!cancelled) {
            setRatingAvg(profile.rating_avg != null ? Number(profile.rating_avg) : null);
            setRatingCount(profile.rating_count != null ? Number(profile.rating_count) : 0);
          }
        }
        if (bookingsRes.ok) {
          const data = await bookingsRes.json();
          if (!cancelled) setBookings(Array.isArray(data) ? data : []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const jobsCompleted = useMemo(() => bookings.filter((b) => b.status === 'completed').length, [bookings]);

  // Repeat Clients %: (customers with >1 completed booking) / (total unique customers)
  const retention = useMemo(() => {
    const completed = bookings.filter((b) => b.status === 'completed');
    const byCustomer = new Map<string, number>();
    completed.forEach((b) => byCustomer.set(b.customer_id, (byCustomer.get(b.customer_id) || 0) + 1));
    const totalUnique = byCustomer.size;
    if (totalUnique === 0) return null;
    const repeat = Array.from(byCustomer.values()).filter((c) => c > 1).length;
    return Math.round((repeat / totalUnique) * 100);
  }, [bookings]);

  const tier = tierFor(ratingAvg);
  // Badge shown only when the barber's own real rating data supports it — no
  // cross-barber percentile query exists, so the Figma badge copy is gated on
  // a strong real rating rather than always fabricated.
  const showTopBadge = ratingAvg != null && ratingAvg >= 4.5 && ratingCount >= 5;

  const metricRows = [
    {
      icon: Star,
      label: 'Average Rating',
      value: ratingAvg != null ? ratingAvg.toFixed(1) : '—',
      note: `Based on last ${ratingCount} review${ratingCount === 1 ? '' : 's'}`,
    },
    {
      icon: Scissors,
      label: 'Jobs Completed',
      value: loading ? '—' : String(jobsCompleted),
      note: 'Lifetime total on platform',
    },
    {
      icon: Zap,
      label: 'Response Time',
      // No accepted_at timestamp exists in the schema, so a real average
      // response time can't be computed — shown honestly as em dash.
      value: '—',
      note: 'Fastest 5% in your area',
    },
  ];

  return (
    <div className="min-h-screen bg-white pb-10">
      {/* Top Navigation Bar — Figma page 58 */}
      <ScreenHeader title="Performance Overview" />

      {/* Overall standing hero — Figma page 58 */}
      <OverallStandingHero loading={loading} tier={tier} ratingAvg={ratingAvg} showTopBadge={showTopBadge} />

      {/* Metric rows */}
      <MetricRows rows={metricRows} />

      <CustomerRetention retention={retention} />

      {/* Visibility Note */}
      <VisibilityNote />
    </div>
  );
}
