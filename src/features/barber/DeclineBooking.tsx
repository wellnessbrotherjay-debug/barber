import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/useAuthStore';

const REASONS = ['Not available', 'Too far', 'Wrong service', 'Other'];

export default function DeclineBooking() {
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
      if (!response.ok) throw new Error(`Failed to decline booking: ${response.status}`);
      toast.message('Booking declined');
      navigate('/barber/jobs/incoming');
    } catch (err) {
      toast.error(`${err}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white pb-8">
      <div className="px-5 pt-14 pb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-ink">Decline</h1>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-surface rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-ink" />
        </button>
      </div>

      <div className="px-5 space-y-4">
        <p className="text-sm font-semibold text-ink">Why are you declining?</p>

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

        <Button size="lg" variant="destructive" onClick={handleConfirm} disabled={submitting} className="w-full">
          {submitting ? 'Declining…' : 'Confirm decline'}
        </Button>

        <p className="text-[11px] text-muted text-center">
          Declining may affect your acceptance rate. Contact support if this is an error.
        </p>
      </div>
    </div>
  );
}
