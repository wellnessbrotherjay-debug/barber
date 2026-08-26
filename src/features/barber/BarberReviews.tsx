import React, { useEffect, useMemo, useState } from 'react';
import ScreenHeader from '../../components/ScreenHeader';
import { useNavigate } from 'react-router-dom';
import { Star, UserRound } from 'lucide-react';
import BarberNav from '@/components/BarberNav';
import { authFetch } from '@/lib/api';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  customer_name?: string;
}

const PAGE_SIZE = 5;

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

export default function BarberReviews() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [ratingAvg, setRatingAvg] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profileRes = await authFetch('/api/barber/profile');
        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (!cancelled) {
            setRatingAvg(profile.rating_avg != null ? Number(profile.rating_avg) : null);
            setRatingCount(profile.rating_count != null ? Number(profile.rating_count) : null);
          }
          const reviewsRes = await authFetch(`/api/reviews-by-barber/${profile.id}`);
          if (reviewsRes.ok) {
            const data = await reviewsRes.json();
            if (!cancelled) setReviews(Array.isArray(data) ? data : []);
          }
        }
      } catch (err) {
        console.error(`[BarberReviews] loading reviews failed:`, err);
        if (!cancelled) setReviews([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const distribution = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0]; // index 0 = 1 star ... index 4 = 5 star
    reviews.forEach((r) => {
      const idx = Math.min(5, Math.max(1, Math.round(r.rating))) - 1;
      buckets[idx] += 1;
    });
    const total = reviews.length || 1;
    return buckets.map((count) => ({ count, pct: Math.round((count / total) * 100) })).reverse(); // 5star first
  }, [reviews]);

  const avgDisplay = ratingAvg != null ? ratingAvg.toFixed(1) : reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0.0';
  const countDisplay = ratingCount ?? reviews.length;

  return (
    <div className="min-h-screen bg-white pb-[180px]">
      {/* Top Navigation Bar — Figma page 57 */}
      <ScreenHeader title="Reviews" />

      {/* Reviews headline row */}
      <div className="px-5 py-4 flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-[18px] leading-6 font-bold text-[#1c1b1f]">Reviews</h2>
          <p className="text-[12px] leading-4 font-medium text-[#a09cab]">
            Based on {countDisplay} review{countDisplay === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-[#f8f8f8] rounded-full px-3 py-1.5">
          <Star className="w-3.5 h-3.5 fill-[#1c1b1f] text-[#1c1b1f]" />
          <span className="text-[12px] leading-4 font-bold text-[#1c1b1f]">{avgDisplay}</span>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-sm text-[#a09cab] py-8">Loading…</p>
      ) : (
        <>
          {/* Average rating block */}
          <div className="px-5 py-4 flex flex-col items-center gap-2">
            <p className="text-[28px] leading-9 font-bold text-[#1c1b1f]">{avgDisplay}</p>
            <p className="text-[12px] leading-4 font-medium text-[#a09cab]">Average Rating</p>
            <div className="flex gap-2 mt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-7 h-7 ${i < Math.round(Number(avgDisplay)) ? 'fill-[#a4a1af] text-[#a4a1af]' : 'fill-[#e5e3ee] text-[#e5e3ee]'}`}
                />
              ))}
            </div>
          </div>

          {/* Star distribution bars */}
          <div className="px-5 py-4 flex flex-col gap-6">
            {distribution.map((d, i) => {
              const starLabel = 5 - i;
              return (
                <div key={starLabel} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] leading-5 font-semibold text-[#1c1b1f]">{starLabel}★</span>
                    <span className="bg-[#f8f8f8] rounded-full px-3 py-1.5 text-[10px] leading-3 font-medium text-[#514e59]">{d.pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#f1efe9] overflow-hidden">
                    <div className="h-full rounded-full bg-[#1c1b1f]" style={{ width: `${d.pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent Feedback */}
          <div className="px-5 py-4">
            <h2 className="text-[18px] leading-6 font-bold text-[#1c1b1f]">Recent Feedback</h2>
          </div>
          <div className="px-5 space-y-3">
            {reviews.length === 0 && <p className="text-center text-sm text-[#a09cab] py-8">No reviews yet</p>}
            {reviews.slice(0, visibleCount).map((r) => (
              <div key={r.id} className="bg-white border-[0.75px] border-[#d2dbe9] rounded-[12px] p-3 flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#a4a1af] flex items-center justify-center shrink-0">
                      <UserRound className="w-5 h-5 text-white" fill="currentColor" />
                    </div>
                    <p className="text-[14px] leading-5 font-semibold text-[#1c1b1f]">{r.customer_name || 'Customer'}</p>
                  </div>
                  <span className="text-[12px] leading-4 font-medium text-[#a09cab] whitespace-nowrap">{relativeTime(r.created_at)}</span>
                </div>
                <div className="flex gap-1.5 pl-12">
                  {Array.from({ length: Math.max(0, Math.min(5, Math.round(r.rating))) }).map((_, j) => (
                    <Star key={j} className="w-5 h-5 fill-[#a4a1af] text-[#a4a1af]" />
                  ))}
                </div>
                {r.comment && (
                  <p className="text-[12px] leading-4 font-medium text-[#a09cab]">"{r.comment}"</p>
                )}
              </div>
            ))}
          </div>

          {/* See All Reviews — Figma page 57 bottom CTA */}
          {visibleCount < reviews.length && (
            <div className="px-5 pt-6">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="w-full bg-[#1c1b1f] rounded-full px-9 py-[18px] text-[14px] leading-5 font-semibold text-white text-center"
              >
                See All Reviews
              </button>
            </div>
          )}
        </>
      )}

      <BarberNav active="reviews" />
    </div>
  );
}
