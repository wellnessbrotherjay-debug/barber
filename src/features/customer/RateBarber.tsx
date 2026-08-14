import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Star, ImageIcon, ShieldCheck, Clock, Scissors, User as UserIcon, Sparkles } from 'lucide-react';
import { formatTime } from '@/lib/datetime';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

interface Booking {
  id: string;
  barber_id: string;
  start_time?: string;
  barber_profiles: { id: string; display_name: string };
}

// Board frame 42 tag chips.
const TAGS = [
  { label: 'Professional', icon: ShieldCheck },
  { label: 'On Time', icon: Clock },
  { label: 'Great Cut', icon: Scissors },
  { label: 'Friendly', icon: UserIcon },
  { label: 'Clean Tools', icon: Sparkles },
] as const;

export default function RateBarber() {
  const navigate = useNavigate();
  const { id } = useParams(); // booking id
  const user = useAuthStore((s) => s.user);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id || !id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchBooking() {
      try {
        setLoading(true);
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/bookings`, {
          headers: {
            'X-Session-Token': `1:${user!.id}`,
            Authorization: `Bearer ${localStorage.getItem('barberSyncToken') || ''}`,
            'X-User-ID': user!.id,
          },
        });
        if (!response.ok) throw new Error(`Failed to fetch booking: ${response.status}`);
        const data = (await response.json()) as Booking[];
        const found = data.find((b) => b.id === id) || null;
        if (!cancelled) setBooking(found);
      } catch (err) {
        if (!cancelled) setError(`${err}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchBooking();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  const handleSubmit = async () => {
    if (!booking || !user?.id || !id) return;
    try {
      setSubmitting(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': `1:${user.id}`,
          Authorization: `Bearer ${localStorage.getItem('barberSyncToken') || ''}`,
          'X-User-ID': user.id,
        },
        body: JSON.stringify({
          booking_id: id,
          customer_id: user.id,
          barber_id: booking.barber_id || booking.barber_profiles?.id,
          rating,
          comment: [tags.join(', '), review].filter(Boolean).join(' — '),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Failed to submit review: ${response.status}`);
      }
      toast.success('Thanks for your review!');
      navigate('/customer/bookings');
    } catch (err) {
      toast.error(`${err}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-8">
      {/* Figma 1:139 header: 100px image placeholder, title 18px, subtitle 12px */}
      <div className="flex flex-col items-center px-4 pt-[110px]">
        <div className="w-[100px] h-[100px] rounded-[8px] bg-surface flex items-center justify-center">
          <ImageIcon className="w-[41px] h-[38px] text-muted" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 px-5 pt-4">
        <h1 className="text-[18px] leading-[24px] font-bold text-ink">Rate your barber</h1>
        <p className="text-[12px] leading-[16px] font-medium text-muted text-center">
          How was your appointment{booking?.start_time ? ` today at ${formatTime(booking.start_time)}` : ' today'}?
        </p>
      </div>

      {/* Star Rating — 24px stars, 4px gap (Figma 1:167) */}
      <div className="flex justify-center gap-1 pt-3 pb-4">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} className="transition-transform hover:scale-110">
            <Star
              className={cn(
                'w-6 h-6 transition-colors',
                n <= rating ? 'fill-ink text-ink' : 'fill-border text-border',
              )}
            />
          </button>
        ))}
      </div>

      <div className="px-5 space-y-6">
        {loading && <p className="text-sm text-muted text-center">Loading…</p>}
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

        {/* Figma 1:179 card: bg #fafafa, radius 12, p-4, 24px section gap */}
        <div className="bg-[#fafafa] rounded-[12px] p-4 flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <p className="text-[14px] leading-[20px] font-semibold text-ink">What stood out?</p>
            <div className="flex flex-wrap gap-[9px]">
              {TAGS.map(({ label, icon: Icon }) => {
                const on = tags.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      setTags((prev) =>
                        prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label],
                      )
                    }
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2.5 rounded-[8px] text-[12px] leading-[16px] font-semibold transition-colors',
                      on
                        ? 'bg-ink text-white'
                        : 'border-[0.75px] border-[#d2dbe9] text-[#514e59] bg-transparent',
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <p className="text-[14px] leading-[20px] font-semibold text-ink">Write a quick review (optional)</p>
            <textarea
              value={review}
              onChange={(e) => setReview((e.target as unknown as { value: string }).value)}
              rows={3}
              className="w-full h-[81px] bg-[#f4f5f8] border-[0.75px] border-[#d2dbe9] rounded-[8px] p-3 text-[12px] leading-[16px] font-medium resize-none text-ink placeholder:text-ink/70 focus:outline-none focus:ring-2 focus:ring-ink/20"
              placeholder="What went well?"
            />
          </div>
        </div>
      </div>

      {/* Bottom actions — pill submit + Skip (Figma 1:212) */}
      <div className="px-5 mt-8 flex flex-col gap-1">
        <button
          type="button"
          disabled={!rating || !booking || submitting}
          onClick={handleSubmit}
          className="w-full bg-ink text-white rounded-[999px] px-9 py-[18px] text-[14px] leading-[20px] font-semibold disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit Rating'}
        </button>
        <button
          type="button"
          onClick={() => navigate('/customer/bookings')}
          className="w-full px-9 py-[18px] text-[14px] leading-[20px] font-semibold text-muted"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
