import React, { useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import BarberNav from '@/components/BarberNav';
import { Card } from '@/components/ui/Card';
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
      } catch {
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
    <div className="min-h-screen bg-white pb-[88px]">
      <div className="px-5 pt-14 pb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-ink">Reviews</h1>
        <div className="flex items-center gap-1 bg-[#f2f1fa] px-3 py-1.5 rounded-full">
          <Star className="w-4 h-4 fill-ink text-ink" />
          <span className="text-sm font-bold text-ink">{avgDisplay}</span>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted py-8">Loading…</p>
      ) : (
        <>
          <div className="px-5 flex flex-col items-center mb-6">
            <p className="text-5xl font-bold text-ink">{avgDisplay}</p>
            <div className="flex gap-1 mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-5 h-5 ${i < Math.round(Number(avgDisplay)) ? 'fill-ink text-ink' : 'text-[#d8d6e0]'}`}
                />
              ))}
            </div>
            <p className="text-sm text-muted mt-1">Based on {countDisplay} review{countDisplay === 1 ? '' : 's'}</p>
          </div>

          <div className="px-5 space-y-2 mb-6">
            {distribution.map((d, i) => {
              const starLabel = 5 - i;
              return (
                <div key={starLabel} className="flex items-center gap-2">
                  <span className="text-xs text-muted w-6">{starLabel}★</span>
                  <div className="flex-1 h-2 rounded-full bg-[#f2f1fa] overflow-hidden">
                    <div className="h-full bg-ink" style={{ width: `${d.pct}%` }} />
                  </div>
                  <span className="text-xs text-muted w-9 text-right">{d.pct}%</span>
                </div>
              );
            })}
          </div>

          <div className="px-5">
            <h2 className="font-semibold text-sm mb-3">Recent Feedback</h2>
            <div className="space-y-3">
              {reviews.length === 0 && <p className="text-center text-sm text-muted py-8">No reviews yet</p>}
              {reviews.slice(0, visibleCount).map((r) => (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#f2f1fa] flex items-center justify-center text-xs font-semibold text-ink flex-shrink-0">
                      {(r.customer_name || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-sm text-ink">{r.customer_name || 'Customer'}</p>
                        <span className="text-xs text-muted whitespace-nowrap ml-2">{relativeTime(r.created_at)}</span>
                      </div>
                      <div className="flex gap-0.5 my-1">
                        {Array.from({ length: r.rating }).map((_, j) => (
                          <Star key={j} className="w-3 h-3 fill-ink text-ink" />
                        ))}
                      </div>
                      {r.comment && <p className="text-xs text-muted leading-relaxed">"{r.comment}"</p>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {visibleCount < reviews.length && (
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="w-full mt-4 text-center text-sm font-semibold text-ink py-3 rounded-full bg-[#f2f1fa]"
              >
                See All Reviews
              </button>
            )}
          </div>
        </>
      )}

      <BarberNav active="reviews" />
    </div>
  );
}
