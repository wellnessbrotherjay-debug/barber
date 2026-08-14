import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Navigation, Phone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchBarberJobs, type Job } from './BarberJobs';

export default function BarberJobArriving() {
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useAuthStore((s) => s.user);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

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
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  const address = job?.barber_profiles?.address_text || '';
  const mapsUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;

  return (
    <div className="min-h-screen bg-white pb-8">
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-surface rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-ink" />
        </button>
        <h1 className="text-lg font-bold text-ink">On the way</h1>
      </div>

      <div className="px-5 space-y-4">
        {loading && <p className="text-sm text-muted">Loading…</p>}

        {/* Placeholder map area */}
        <div className="w-full h-40 rounded-[12px] bg-surface flex items-center justify-center">
          <Navigation className="w-8 h-8 text-muted" />
        </div>

        <Card className="p-4">
          <p className="text-xs font-semibold text-muted mb-1">Estimated Arrival</p>
          <p className="text-sm text-ink">On the way</p>
        </Card>

        {address && (
          <Card className="p-4">
            <p className="text-xs font-semibold text-muted mb-1">Customer Address</p>
            <div className="flex items-center gap-1.5 text-sm text-ink">
              <MapPin className="w-4 h-4 text-muted" />
              <span>{address}</span>
            </div>
          </Card>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => toast.message('Note sent: running 10 mins late')}
            className="flex-1 h-9 rounded-pill border border-border text-xs font-medium text-ink"
          >
            Running 10 mins late
          </button>
          <button
            type="button"
            onClick={() => toast.message('Note sent: running 20+ mins late')}
            className="flex-1 h-9 rounded-pill border border-border text-xs font-medium text-ink"
          >
            Running 20+ mins late
          </button>
        </div>

        {mapsUrl && (
          <Button size="lg" variant="secondary" onClick={() => window.open(mapsUrl, '_blank', 'noopener,noreferrer')} className="w-full">
            Open in Google Maps
          </Button>
        )}

        <button
          type="button"
          disabled
          title="Coming soon"
          className="w-full h-11 rounded-pill border border-border text-sm font-medium text-muted opacity-50 cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Phone className="w-4 h-4" />
          Call {job?.users?.full_name || 'Customer'} (coming soon)
        </button>

        {job && (
          <div className="flex gap-3">
            <Button size="md" onClick={() => navigate(`/barber/complete/${job.id}`)} className="flex-1">
              Mark Complete
            </Button>
            <Button size="md" variant="destructive" onClick={() => navigate(`/barber/cancel/${job.id}`)} className="flex-1">
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
