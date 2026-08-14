import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchBarberJobs, type Job } from './BarberJobs';

export default function AcceptBooking() {
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useAuthStore((s) => s.user);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!user?.id || !id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchBarberJobs(user.id);
        const found = data.find((j) => j.id === id) || null;
        if (!cancelled) setJob(found);
      } catch (err) {
        if (!cancelled) setError(`${err}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  async function handleAccept() {
    if (!id || !user?.id) return;
    try {
      setSubmitting(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/bookings/${id}/accept`, {
        method: 'POST',
        headers: {
          'X-Session-Token': `1:${user.id}`,
          Authorization: `Bearer ${localStorage.getItem('barberSyncToken') || ''}`,
          'X-User-ID': user.id,
        },
      });
      if (!response.ok) throw new Error(`Failed to accept booking: ${response.status}`);
      toast.success('Booking accepted');
      setAccepted(true);
    } catch (err) {
      toast.error(`${err}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (accepted && job) {
    return (
      <div className="min-h-screen bg-white pb-8">
        <div className="px-5 pt-14 pb-4">
          <h1 className="text-lg font-bold text-ink">Booking accepted</h1>
          <p className="text-sm text-muted mt-1">Chat and call are now unlocked.</p>
        </div>

        <div className="px-5 space-y-4">
          <Card className="p-4 flex items-center gap-3">
            <Avatar fallback={job.users?.full_name?.[0] || '?'} />
            <div>
              <p className="font-semibold text-sm text-ink">{job.users?.full_name}</p>
              <p className="text-xs text-muted">{job.services?.name}</p>
            </div>
          </Card>

          <Card className="p-4 space-y-2">
            <p className="text-xs font-semibold text-muted">Job Summary</p>
            <p className="text-sm text-ink">{job.booking_date} · {job.start_time}</p>
            {job.barber_profiles?.address_text && (
              <p className="text-sm text-muted">{job.barber_profiles.address_text}</p>
            )}
          </Card>

          <div className="bg-surface rounded-lg px-3 py-2">
            <p className="text-[11px] text-muted">
              Haircut payment is handled directly with the customer.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate(`/barber/cancel/${job.id}`)}
            className="w-full text-center text-sm font-semibold text-red-600"
          >
            Cancel Booking
          </button>

          <button
            type="button"
            disabled
            title="Coming soon"
            className="w-full h-11 rounded-pill border border-border text-sm font-medium text-muted opacity-50 cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Phone className="w-4 h-4" />
            Call (coming soon)
          </button>

          <Button size="lg" variant="secondary" onClick={() => navigate('/barber/jobs/upcoming')} className="w-full">
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-8">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-surface rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-ink" />
        </button>
        <h1 className="text-lg font-bold text-ink">Accept booking?</h1>
      </div>

      <div className="px-5 space-y-4">
        {loading && <p className="text-sm text-muted">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {job && (
          <Card className="p-4 space-y-2">
            <p className="font-semibold text-ink">{job.users?.full_name}</p>
            <p className="text-sm text-muted">{job.services?.name} · ${Number(job.total_amount).toFixed(2)}</p>
            <p className="text-xs text-muted">{job.booking_date} {job.start_time}</p>
            {job.notes && (
              <div className="bg-surface rounded-lg px-3 py-2 mt-2">
                <p className="text-[11px] font-semibold text-muted mb-0.5">Notes From Customer</p>
                <p className="text-xs text-ink">{job.notes}</p>
              </div>
            )}
          </Card>
        )}
        {!loading && !error && !job && (
          <p className="text-sm text-muted">Booking not found.</p>
        )}

        <Button size="lg" onClick={handleAccept} disabled={!job || submitting} className="w-full">
          {submitting ? 'Accepting…' : 'Accept'}
        </Button>

        <Button size="lg" variant="outline" onClick={() => navigate(-1)} className="w-full">
          Go back
        </Button>
      </div>
    </div>
  );
}
