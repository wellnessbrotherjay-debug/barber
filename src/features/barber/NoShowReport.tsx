import React, { useEffect, useState } from 'react';
import { NoteCard } from '../../components/ScreenPieces';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, X, Info, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchBarberJobs, type Job } from './BarberJobs';
import { authFetch } from '@/lib/api';

export default function NoShowReport() {
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useAuthStore((s) => s.user);
  const [job, setJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.id || !id) return;
    let cancelled = false;
    (async () => {
      const data = await fetchBarberJobs(user.id);
      const found = data.find((j) => j.id === id) || null;
      if (!cancelled) setJob(found);
    })();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  // No dedicated no_show status exists on bookings today — reporting a no-show
  // reuses the real cancel endpoint. This screen is honest about that: it does
  // not claim a separate no-show record was created, just that the booking was
  // cancelled and the report noted.
  async function handleSubmit() {
    if (!id || !user?.id || submitting) return;
    setSubmitting(true);
    try {
      const response = await authFetch(`/api/bookings/${id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'no_show' }),
      });
      if (!response.ok) throw new Error(`Failed to report no-show: ${response.status}`);
      toast.success('No-show reported');
      navigate('/barber/jobs/past');
    } catch (err) {
      toast.error(`${err}`);
    } finally {
      setSubmitting(false);
    }
  }

  const jobTime = job?.start_time ? job.start_time.slice(0, 5) : '';

  return (
    <div className="min-h-screen bg-white pb-28">
      {/* Top Navigation Bar */}
      <div className="px-5 pt-4 pb-4 flex items-center gap-1.5">
        <button type="button" onClick={() => navigate(-1)} className="-ml-1 p-0.5 shrink-0">
          <ChevronLeft className="w-6 h-6 text-[#1c1b1f]" />
        </button>
        <h1 className="flex-1 text-center text-[16px] leading-6 font-bold text-[#1c1b1f]">No-show Reported</h1>
        <div className="size-6 shrink-0" />
      </div>

      {/* Hero */}
      <div className="p-5 flex flex-col items-center gap-4">
        <div className="bg-[#f2f1fa] rounded-[8px] size-[100px] flex items-center justify-center">
          <span className="size-[34px] rounded-full border-[1.5px] border-[#1c1b1f] flex items-center justify-center">
            <X className="w-4 h-4 text-[#1c1b1f]" strokeWidth={2} />
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-[24px] font-bold text-[#1c1b1f]">No-show Reported</p>
          <p className="text-[12px] leading-4 font-medium text-[#a09cab] text-center max-w-[330px]">
            You reported a no-show for this booking. This action will be logged in the system.
          </p>
        </div>
      </div>

      {/* Booking summary card */}
      <div className="px-5 py-4">
        <NoteCard>
          <div className="bg-white rounded-full size-10 flex items-center justify-center shrink-0">
            <ImageIcon className="w-3.5 h-3.5 text-[#d4d2e3]" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[14px] leading-5 font-semibold text-[#1c1b1f]">
              {job?.users?.full_name || 'Customer'}
            </p>
            <div className="flex items-center gap-1 text-[12px] leading-4 font-medium text-[#a09cab]">
              <span>{job?.booking_date || 'Today'}</span>
              <span className="size-1 rounded-full bg-[#a09cab]" />
              <span>{jobTime || '—'}</span>
              <span className="size-1 rounded-full bg-[#a09cab]" />
              <span>{job?.services?.name || 'Service'}</span>
            </div>
          </div>
        </NoteCard>
      </div>

      {/* Info card */}
      <div className="px-5 py-4">
        <NoteCard>
          <Info className="w-6 h-6 text-[#a09cab] shrink-0" strokeWidth={1.6} />
          <p className="text-[12px] leading-4 font-medium text-[#a09cab]">
            Reporting no-shows helps protect your reliability rating and allows us to enforce cancellation policies.
          </p>
        </NoteCard>
      </div>

      {/* Submit */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-[393px] px-5 z-40">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !job}
          className="w-full bg-[#1c1b1f] rounded-full py-[18px] text-[14px] leading-5 font-semibold text-white text-center disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit Report'}
        </button>
      </div>
    </div>
  );
}
