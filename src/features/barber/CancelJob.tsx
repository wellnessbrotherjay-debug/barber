import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';

/* Reason copy replicated verbatim from Figma p52 (including "Too For") */
const REASONS = ['Emergency', 'Not Available', 'Too For', 'Other'];

export default function CancelJob() {
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useAuthStore((s) => s.user);
  const [reason, setReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (!id || !user?.id || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/bookings/${id}/cancel`, {
        method: 'POST',
        headers: {
          'X-Session-Token': `1:${user.id}`,
          Authorization: `Bearer ${localStorage.getItem('barberSyncToken') || ''}`,
          'X-User-ID': user.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reason ? { reason } : {}),
      });
      if (!response.ok) throw new Error(`Failed to cancel booking: ${response.status}`);
      toast.message('Booking cancelled');
      navigate('/barber/jobs/past');
    } catch (err) {
      toast.error(`${err}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col pb-8">
      {/* Top Navigation Bar — Figma p52 */}
      <div className="flex items-center justify-center gap-1.5 px-5 py-4 pt-14 bg-white">
        <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="w-6 h-6 flex items-center justify-center shrink-0">
          <ChevronLeft className="w-6 h-6 text-[#1c1b1f]" strokeWidth={2} />
        </button>
        <p className="flex-1 text-center text-[16px] leading-6 font-bold text-[#1c1b1f]">Cancelling</p>
        <span className="w-6 h-6 shrink-0" />
      </div>

      <div className="px-5 pt-4">
        <h1 className="text-[24px] leading-8 font-bold text-[#1c1b1f]">Why are you cancelling?</h1>
        <p className="mt-1 text-[14px] leading-5 font-medium text-[#a09cab]">
          Please let us know why you can't make it to this appointment.
        </p>
      </div>

      <div className="px-5 pt-6 space-y-3">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={reason === r}
            onClick={() => setReason(reason === r ? null : r)}
            className="w-full flex items-center gap-3 text-left px-4 py-[18px] rounded-[12px] border-[0.75px] border-[#d2dbe9] bg-white"
          >
            <span
              className={`w-[18px] h-[18px] rounded-[4px] border-[1.5px] flex items-center justify-center shrink-0 ${
                reason === r ? 'bg-[#1c1b1f] border-[#1c1b1f]' : 'border-[#1c1b1f]'
              }`}
            >
              {reason === r && (
                <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none">
                  <path d="M2 6.5L4.5 9L10 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className="text-[14px] leading-5 font-semibold text-[#1c1b1f]">{r}</span>
          </button>
        ))}
      </div>

      <div className="px-5 pt-6">
        <div className="flex items-start gap-3 bg-[#f4f5f8] rounded-[12px] p-4">
          <ShieldAlert className="w-5 h-5 text-[#1c1b1f] shrink-0 mt-0.5" strokeWidth={1.8} />
          <p className="text-[13px] leading-5 font-medium text-[#a09cab]">
            Frequent cancellations may reduce your visibility to potential clients.
          </p>
        </div>
      </div>

      <div className="px-5 mt-auto pt-8">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="w-full bg-[#1c1b1f] rounded-full px-9 py-[18px] text-[16px] leading-5 font-semibold text-white text-center disabled:opacity-60"
        >
          {submitting ? 'Cancelling…' : 'Confirm Cancellation'}
        </button>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-full mt-4 text-center text-[16px] leading-5 font-semibold text-[#a09cab] py-2"
        >
          Keep Booking
        </button>
      </div>
    </div>
  );
}
