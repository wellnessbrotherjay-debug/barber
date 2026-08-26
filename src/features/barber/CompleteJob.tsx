import React, { useState } from 'react';
import ScreenHeader from '../../components/ScreenHeader';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';
import { authFetch } from '@/lib/api';

const CHECKLIST = ['Service Delivery Confirmed', 'Customer Payment Handled Offline'];

/* Complete job — Figma p55 */
export default function CompleteJob() {
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useAuthStore((s) => s.user);
  const [checked, setChecked] = useState<boolean[]>([false, false]);
  const [submitting, setSubmitting] = useState(false);

  function toggle(i: number) {
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  async function handleComplete() {
    if (!id || !user?.id || submitting) return;
    setSubmitting(true);
    try {
      const response = await authFetch(`/api/bookings/${id}/complete`, {
        method: 'POST',
        headers: {
        },
      });
      if (!response.ok) throw new Error(`Failed to complete booking: ${response.status}`);
      toast.success('Job marked complete');
      navigate('/barber/jobs/past');
    } catch (err) {
      toast.error(`${err}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col pb-8">
      {/* Top Navigation Bar */}
      <ScreenHeader title="Complete job" />

      <div className="px-5 pt-4">
        <h1 className="text-[24px] leading-8 font-bold text-[#1c1b1f]">Confirm this job is finished</h1>
        <p className="mt-1 text-[14px] leading-5 font-medium text-[#a09cab]">
          Please review the checklist before closing this ticket.
        </p>
      </div>

      <div className="px-5 pt-8">
        <h2 className="text-[20px] leading-6 font-bold text-[#1c1b1f]">Checklist (Optional)</h2>
      </div>

      <div className="px-5 pt-5 space-y-3">
        {CHECKLIST.map((label, i) => (
          <button
            key={label}
            type="button"
            aria-pressed={checked[i]}
            onClick={() => toggle(i)}
            className="w-full flex items-center gap-3 text-left px-4 py-[18px] rounded-[12px] border-[0.75px] border-[#d2dbe9] bg-white"
          >
            <span
              className={`w-[18px] h-[18px] rounded-[4px] border-[1.5px] flex items-center justify-center shrink-0 ${
                checked[i] ? 'bg-[#1c1b1f] border-[#1c1b1f]' : 'border-[#1c1b1f]'
              }`}
            >
              {checked[i] && (
                <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none">
                  <path d="M2 6.5L4.5 9L10 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className="text-[14px] leading-5 font-semibold text-[#1c1b1f]">{label}</span>
          </button>
        ))}
      </div>

      <div className="px-5 mt-auto pt-8">
        <button
          type="button"
          onClick={handleComplete}
          disabled={submitting}
          className="w-full bg-[#1c1b1f] rounded-full px-9 py-[18px] text-[16px] leading-5 font-semibold text-white text-center disabled:opacity-60"
        >
          {submitting ? 'Completing…' : 'Mark as Complete'}
        </button>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-full mt-4 text-center text-[16px] leading-5 font-semibold text-[#a09cab] py-2"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
