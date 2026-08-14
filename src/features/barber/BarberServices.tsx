import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/api';

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  duration_minutes: number;
}

// When `embedded` is true, this renders as a step inside BarberOnboarding's
// wizard (no own header/back button — the wizard's ProgressHeader covers
// that) but keeps the exact same real API-calling logic.
export default function BarberServices({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('30');
  const [saving, setSaving] = useState(false);

  async function loadServices() {
    try {
      setLoading(true);
      const response = await authFetch('/api/services');
      if (!response.ok) throw new Error(`Failed to load services: ${response.status}`);
      const data = await response.json();
      setServices(data);
    } catch (err) {
      toast.error(`${err instanceof Error ? err.message : err}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadServices();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !price || !duration) return;
    setSaving(true);
    try {
      const response = await authFetch('/api/barber/services', {
        method: 'POST',
        body: JSON.stringify({
          name,
          price: Number(price),
          duration_minutes: Number(duration),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `Failed to add service: ${response.status}`);
      toast.success('Service added');
      setName('');
      setPrice('');
      setDuration('30');
      setShowForm(false);
      loadServices();
    } catch (err) {
      toast.error(`${err instanceof Error ? err.message : err}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const response = await authFetch(`/api/barber/services/${id}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 204) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Failed to delete service: ${response.status}`);
      }
      toast.success('Service removed');
      setServices((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      toast.error(`${err instanceof Error ? err.message : err}`);
    }
  }

  return (
    <div className={embedded ? '' : 'min-h-screen bg-white pb-8'}>
      {/* Header — only rendered standalone, not inside the onboarding wizard */}
      {!embedded && (
        <div className="px-5 pt-14 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 hover:bg-surface rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-ink" />
            </button>
            <h1 className="text-lg font-bold text-ink">Services</h1>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="p-2 hover:bg-surface rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5 text-ink" />
          </button>
        </div>
      )}

      <div className="px-5 space-y-3">
        {embedded && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border text-sm font-semibold text-ink"
          >
            <Plus className="w-4 h-4" /> Add a service
          </button>
        )}

        {showForm && (
          <form onSubmit={handleAdd} className="space-y-3">
            <input
              placeholder="Service Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-surface rounded-xl text-sm"
            />
            <div className="flex gap-3">
              <input
                placeholder="Price ($)"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-3 bg-surface rounded-xl text-sm"
              />
              <div className="relative w-full">
                <Clock className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  placeholder="Duration (min)"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full pl-11 pr-3 py-3 bg-surface rounded-xl text-sm"
                />
              </div>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={saving}>
              {saving ? 'Adding…' : 'Add Service'}
            </Button>
          </form>
        )}

        {/* Services List */}
        {loading && <p className="text-sm text-muted">Loading…</p>}
        {!loading && services.length === 0 && (
          <p className="text-sm text-muted">No services yet. Add your first one above.</p>
        )}
        {services.map((s) => (
          <Card key={s.id} className="p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold text-sm text-ink">{s.name}</p>
              <p className="text-xs text-muted mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {s.duration_minutes} min
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-bold text-sm text-ink">${s.price}</p>
              <button type="button" onClick={() => handleDelete(s.id)} className="text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
