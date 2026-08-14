import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/useAuthStore';

export default function CompleteJob() {
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useAuthStore((s) => s.user);
  const [serviceConfirmed, setServiceConfirmed] = useState(false);
  const [paymentHandled, setPaymentHandled] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleComplete() {
    if (!id || !user?.id || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/bookings/${id}/complete`, {
        method: 'POST',
        headers: {
          'X-Session-Token': `1:${user.id}`,
          Authorization: `Bearer ${localStorage.getItem('barberSyncToken') || ''}`,
          'X-User-ID': user.id,
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
    <div className="min-h-screen bg-white pb-8">
      <div className="px-5 pt-14 pb-4">
        <h1 className="text-lg font-bold text-ink">Confirm this job is finished</h1>
        <p className="text-sm text-muted mt-1">Please review the checklist before closing this ticket.</p>
      </div>

      <div className="px-5 space-y-3">
        <button
          type="button"
          onClick={() => setServiceConfirmed((v) => !v)}
          className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-[12px] border border-border"
        >
          <span className={`w-4 h-4 rounded border flex-shrink-0 ${serviceConfirmed ? 'bg-ink border-ink' : 'border-border'}`} />
          <span className="text-sm text-ink">Service Delivery Confirmed</span>
        </button>

        <button
          type="button"
          onClick={() => setPaymentHandled((v) => !v)}
          className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-[12px] border border-border"
        >
          <span className={`w-4 h-4 rounded border flex-shrink-0 ${paymentHandled ? 'bg-ink border-ink' : 'border-border'}`} />
          <span className="text-sm text-ink">Customer Payment Handled Offline</span>
        </button>

        <Button size="lg" onClick={handleComplete} disabled={submitting} className="w-full mt-2">
          {submitting ? 'Completing…' : 'Mark as Complete'}
        </Button>

        <Button size="lg" variant="outline" onClick={() => navigate(-1)} className="w-full">
          Go Back
        </Button>
      </div>
    </div>
  );
}
