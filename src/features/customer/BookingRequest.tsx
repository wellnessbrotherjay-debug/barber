import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

export default function BookingRequest() {
  const { id } = useParams(); // barber id
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [services, setServices] = useState<Service[]>([]);
  const [service, setService] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function fetchServices() {
      try {
        setLoading(true);
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/barbers/${id}`, {
          headers: {
            'X-Session-Token': `1:${user?.id || 'guest'}`,
            Authorization: `Bearer ${localStorage.getItem('barberSyncToken') || ''}`,
            'X-User-ID': user?.id || '',
          },
        });
        if (!response.ok) throw new Error(`Failed to fetch services: ${response.status}`);
        const data = await response.json();
        const validServices = (data.services || []).filter((s: Service) => s.id);
        if (!cancelled) {
          setServices(validServices);
          if (validServices.length > 0) setService(validServices[0].id);
        }
      } catch (err) {
        if (!cancelled) setError(`${err}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchServices();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  async function handleSubmit() {
    if (!id || !service || !user?.id) return;
    try {
      setSubmitting(true);
      const bookingDate = new Date().toISOString().slice(0, 10);
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': `1:${user.id}`,
          Authorization: `Bearer ${localStorage.getItem('barberSyncToken') || ''}`,
          'X-User-ID': user.id,
        },
        body: JSON.stringify({
          customer_id: user.id,
          barber_id: id,
          service_id: service,
          booking_date: bookingDate,
          notes: note,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Failed to create booking: ${response.status}`);
      }
      const created = await response.json();
      navigate(`/customer/waiting/${created.id}`);
    } catch (err) {
      toast.error(`${err}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-surface rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-ink" />
        </button>
        <h1 className="text-lg font-bold text-ink">Booking Request</h1>
      </div>

      <div className="px-5 space-y-5 pb-8">
        {/* Service Selection */}
        <div>
          <p className="text-sm font-semibold text-ink mb-3">Select service</p>
          {loading && <p className="text-sm text-muted">Loading services…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !error && services.length === 0 && (
            <p className="text-sm text-muted">No services available for this barber.</p>
          )}
          <div className="space-y-2">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setService(s.id)}
                className={cn(
                  'w-full flex justify-between items-center p-4 rounded-[12px] border transition-all',
                  service === s.id
                    ? 'border-ink bg-surface-2'
                    : 'border-border hover:border-ink/50'
                )}
              >
                <span className="font-semibold text-sm text-ink">{s.name}</span>
                <span className="font-bold text-sm text-ink">${s.price}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Notes Section */}
        <div>
          <label className="text-sm font-semibold text-ink mb-3 block">Notes for barber</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className={cn(
              'w-full border border-border rounded-[12px] p-3 text-sm resize-none',
              'bg-white text-ink placeholder:text-muted',
              'focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-transparent',
              'transition-all'
            )}
            placeholder="Any preferences?"
          />
        </div>

        {/* Info Banner */}
        <Card className="bg-surface border-0 p-4">
          <p className="text-xs font-medium text-muted">
            Booking fee $5 will be charged to confirm. Unlocks chat & call with your barber.
          </p>
        </Card>

        {/* Action Button */}
        <Button
          size="lg"
          disabled={!service || submitting || loading}
          onClick={handleSubmit}
          className="w-full"
        >
          {submitting ? 'Sending…' : 'Send Request'}
        </Button>
      </div>
    </div>
  );
}
