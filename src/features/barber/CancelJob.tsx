import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/useAuthStore';

const REASONS = ['Emergency', 'Not Available', 'Too Far', 'Other'];

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
    <div className="min-h-screen bg-white pb-8">
      <div className="px-5 pt-14 pb-4">
        <h1 className="text-lg font-bold text-ink">Cancelling</h1>
      </div>

      <div className="px-5 space-y-4">
        <p className="text-sm font-semibold text-ink">Why are you cancelling?</p>

        <div className="space-y-2">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-[12px] border border-border"
            >
              <span
                className={`w-4 h-4 rounded border flex-shrink-0 ${reason === r ? 'bg-ink border-ink' : 'border-border'}`}
              />
              <span className="text-sm text-ink">{r}</span>
            </button>
          ))}
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
          <p className="text-[11px] text-yellow-800">
            Frequent cancellations may reduce your visibility to potential clients.
          </p>
        </div>

        <Button size="lg" variant="destructive" onClick={handleConfirm} disabled={submitting} className="w-full">
          {submitting ? 'Cancelling…' : 'Confirm Cancellation'}
        </Button>

        <Button size="lg" variant="outline" onClick={() => navigate(-1)} className="w-full">
          Keep Booking
        </Button>
      </div>
    </div>
  );
}
