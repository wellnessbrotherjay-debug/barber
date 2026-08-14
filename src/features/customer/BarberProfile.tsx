import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Star, MapPin, Clock, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/store/useAuthStore';

interface BarberDetail {
  id: string;
  display_name: string;
  bio: string | null;
  rating_avg: string | number;
  rating_count: number;
  address_text: string | null;
  services?: { id: string | null; name: string | null; price: number | null; duration_minutes: number | null }[];
}

export default function BarberProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [barber, setBarber] = useState<BarberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function fetchBarber() {
      try {
        setLoading(true);
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/barbers/${id}`, {
          headers: {
            'X-Session-Token': `1:${user?.id || 'guest'}`,
            Authorization: `Bearer ${localStorage.getItem('barberSyncToken') || ''}`,
            'X-User-ID': user?.id || '',
          },
        });
        if (!response.ok) throw new Error(`Failed to fetch barber: ${response.status}`);
        const data = await response.json();
        if (!cancelled) setBarber(data);
      } catch (err) {
        if (!cancelled) setError(`${err}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchBarber();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-muted">Loading profile…</p>
      </div>
    );
  }

  if (error || !barber) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-5">
        <p className="text-sm text-red-600 text-center">{error || 'Barber not found'}</p>
      </div>
    );
  }

  const validServices = (barber.services || []).filter((s) => s.id);

  return (
    <div className="min-h-screen bg-white pb-8">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-surface rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-ink" />
        </button>
        <h1 className="text-lg font-bold text-ink">Barber Profile</h1>
      </div>

      {/* Profile Section */}
      <div className="px-5 flex flex-col items-center gap-3 pb-6">
        <div className="w-24 h-24 rounded-[20px] bg-surface flex items-center justify-center">
          <ImageIcon className="w-10 h-10 text-muted" />
        </div>
        <h2 className="text-xl font-bold text-ink text-center">{barber.display_name}</h2>
        <div className="flex items-center gap-1">
          <Star className="w-4 h-4 fill-ink text-ink" />
          <span className="text-sm font-semibold text-ink">
            {barber.rating_avg} ({barber.rating_count} reviews)
          </span>
        </div>
        <div className="flex items-center gap-1 text-muted text-sm">
          <MapPin className="w-4 h-4" />
          {barber.address_text || 'Near you'}
        </div>
      </div>

      {/* About Section */}
      <div className="px-5 mb-6">
        <h3 className="font-semibold text-ink mb-2">About</h3>
        <p className="text-sm text-muted leading-relaxed">{barber.bio || 'No bio available.'}</p>
      </div>

      {/* Services Section */}
      <div className="px-5 mb-8">
        <h3 className="font-semibold text-ink mb-3">Services</h3>
        <div className="space-y-2">
          {validServices.length === 0 && (
            <p className="text-sm text-muted">No services listed yet.</p>
          )}
          {validServices.map((service) => (
            <Card key={service.id} className="p-4 flex justify-between items-start">
              <div className="flex-1">
                <p className="font-semibold text-sm text-ink">{service.name}</p>
                <p className="text-xs text-muted flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3" />
                  {service.duration_minutes} min
                </p>
              </div>
              <p className="font-bold text-sm text-ink">${service.price}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Action Button */}
      <div className="px-5">
        <Button
          size="lg"
          onClick={() => navigate(`/customer/book/${id}`)}
          className="w-full"
        >
          Request Booking
        </Button>
      </div>
    </div>
  );
}
