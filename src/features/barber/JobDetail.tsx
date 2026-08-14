import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchBarberJobs, type Job } from './BarberJobs';

export default function JobDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useAuthStore((s) => s.user);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const isPending = job?.status === 'pending';
  const isConfirmed = job?.status === 'confirmed';
  const isPast = job?.status === 'completed' || job?.status === 'cancelled';
  const bookingDateInPast = job ? new Date(`${job.booking_date}T${job.start_time}`) < new Date() : false;

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
        <h1 className="text-lg font-bold text-ink">Customer Details</h1>
      </div>

      <div className="px-5 space-y-4">
        {loading && <p className="text-sm text-muted">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && !job && (
          <p className="text-sm text-muted">Booking not found.</p>
        )}

        {job && (
          <>
            {/* Customer Info */}
            <div className="flex items-center gap-3">
              <Avatar fallback={job.users?.full_name?.[0] || '?'} />
              <div>
                <p className="font-semibold text-base text-ink">{job.users?.full_name}</p>
                <Badge variant={isPending ? 'primary' : isConfirmed ? 'success' : 'default'}>
                  {isPending ? 'Incoming' : isConfirmed ? 'Accepted' : job.status === 'completed' ? 'Completed' : 'Cancelled'}
                </Badge>
              </div>
            </div>

            {/* Notes from customer — only if real notes exist */}
            {job.notes && (
              <Card className="p-4">
                <p className="text-xs font-semibold text-muted mb-1">Notes From Customer</p>
                <p className="text-sm text-ink">{job.notes}</p>
              </Card>
            )}

            {/* Location */}
            {job.barber_profiles?.address_text && (
              <Card className="p-4">
                <p className="text-xs font-semibold text-muted mb-1">Location</p>
                <div className="flex items-center gap-1.5 text-sm text-ink">
                  <MapPin className="w-4 h-4 text-muted" />
                  <span>{job.barber_profiles.address_text}</span>
                </div>
              </Card>
            )}

            {/* Booking Info */}
            <Card className="p-4 space-y-2">
              <p className="text-xs font-semibold text-muted">Booking Info</p>
              <p className="text-sm text-ink">{job.services?.name}</p>
              <div className="flex items-center gap-1.5 text-sm text-muted">
                <Clock className="w-4 h-4" />
                <span>{job.booking_date} · {job.start_time}</span>
              </div>
              <p className="text-sm font-semibold text-ink">${Number(job.total_amount).toFixed(2)}</p>
            </Card>

            {/* Payment explainer */}
            <div className="bg-surface rounded-lg px-3 py-2">
              <p className="text-[11px] text-muted">
                Haircut payment is handled directly with the customer.
              </p>
            </div>

            {/* Pending: Accept / Decline */}
            {isPending && (
              <div className="space-y-3">
                <Button size="lg" onClick={() => navigate(`/barber/accept/${job.id}`)} className="w-full">
                  Accept Booking
                </Button>
                <button
                  type="button"
                  onClick={() => navigate(`/barber/decline/${job.id}`)}
                  className="w-full text-center text-sm font-semibold text-red-600"
                >
                  Decline
                </button>
              </div>
            )}

            {/* Confirmed: manage job */}
            {isConfirmed && (
              <div className="space-y-3">
                <Button size="lg" onClick={() => navigate(`/barber/arriving/${job.id}`)} className="w-full">
                  Go to Job
                </Button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/barber/cancel/${job.id}`)}
                    className="flex-1 text-center text-sm font-semibold text-red-600"
                  >
                    Cancel Booking
                  </button>
                  {bookingDateInPast && (
                    <button
                      type="button"
                      onClick={() => navigate(`/barber/no-show/${job.id}`)}
                      className="flex-1 text-center text-sm font-semibold text-muted"
                    >
                      Report No-Show
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Past: read-only summary */}
            {isPast && (
              <Card className="p-4">
                <p className="text-xs font-semibold text-muted mb-1">Fee Earned</p>
                <p className="text-sm font-semibold text-ink">
                  {job.status === 'completed' && job.payment_status === 'paid'
                    ? `$${Number(job.total_amount).toFixed(2)}`
                    : 'No fee earned'}
                </p>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
