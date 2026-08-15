import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Scissors, Send, Store, Truck, User, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

// Figma page 22 — "Book Your Service": service cards (selected = black),
// In-shop vs Mobile location preference, contact details, Pay Booking Fee CTA.
export default function BookingRequest() {
  const { id } = useParams(); // barber id
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [services, setServices] = useState<Service[]>([]);
  const [service, setService] = useState('');
  const [note, setNote] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [locationPref, setLocationPref] = useState<'in_shop' | 'mobile'>('in_shop');
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
    <div className="min-h-screen bg-white pb-8">
      {/* Header */}
      <div className="flex items-center px-6 pt-16 pb-4">
        <button type="button" aria-label="Back" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-6 h-6 text-ink" strokeWidth={2.25} />
        </button>
        <p className="flex-1 text-center text-[18px] font-bold text-ink pr-6">Book Your Service</p>
      </div>

      <div className="px-6">
        <h1 className="text-[22px] font-bold text-ink mt-2">Book Your Service</h1>
        <p className="text-[14px] text-muted mt-1">Complete the details below to secure your spot.</p>

        {/* Service */}
        <div className="flex items-center gap-2 mt-8">
          <Scissors className="w-5 h-5 text-ink" strokeWidth={1.8} />
          <h2 className="text-[20px] font-bold text-ink">Service</h2>
        </div>
        {loading && <p className="text-sm text-muted mt-4">Loading services…</p>}
        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
        {!loading && !error && services.length === 0 && (
          <p className="text-sm text-muted mt-4">No services available for this barber.</p>
        )}
        <div className="space-y-4 mt-4">
          {services.map((s) => {
            const selected = service === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setService(s.id)}
                className={cn(
                  'w-full flex items-center justify-between rounded-[16px] p-5 text-left transition-colors',
                  selected
                    ? 'bg-ink text-white'
                    : 'bg-white border-[0.75px] border-[#d2dbe9]'
                )}
              >
                <span>
                  <span className={cn('block text-[16px] font-bold', selected ? 'text-white' : 'text-ink')}>
                    {s.name}
                  </span>
                  <span className={cn('block text-[13px] mt-1.5', selected ? 'text-white/70' : 'text-muted')}>
                    {s.duration_minutes}m duration
                  </span>
                </span>
                <span className={cn('text-[19px] font-bold', selected ? 'text-white' : 'text-ink')}>
                  ${s.price}
                </span>
              </button>
            );
          })}
        </div>

        {/* Location Preference */}
        <div className="flex items-center gap-2 mt-9">
          <Send className="w-5 h-5 text-ink" strokeWidth={1.8} />
          <h2 className="text-[20px] font-bold text-ink">Location Preference</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <button
            type="button"
            onClick={() => setLocationPref('in_shop')}
            className={cn(
              'rounded-[16px] p-3 flex items-center gap-3 text-left transition-colors',
              locationPref === 'in_shop' ? 'bg-ink' : 'bg-[#f6f7fb]'
            )}
          >
            <span
              className={cn(
                'w-11 h-11 rounded-[10px] flex items-center justify-center shrink-0',
                locationPref === 'in_shop' ? 'bg-white' : 'bg-white'
              )}
            >
              <Store className="w-5 h-5 text-ink" strokeWidth={1.8} />
            </span>
            <span>
              <span className={cn('block text-[11px]', locationPref === 'in_shop' ? 'text-white/60' : 'text-muted')}>
                In-shop
              </span>
              <span className={cn('block text-[15px] font-bold mt-0.5', locationPref === 'in_shop' ? 'text-white' : 'text-ink')}>
                Available
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setLocationPref('mobile')}
            className={cn(
              'rounded-[16px] p-3 flex items-center gap-3 text-left transition-colors',
              locationPref === 'mobile' ? 'bg-ink' : 'bg-[#f6f7fb]'
            )}
          >
            <span className="w-11 h-11 rounded-[10px] bg-white flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5 text-ink" strokeWidth={1.8} />
            </span>
            <span>
              <span className={cn('block text-[11px]', locationPref === 'mobile' ? 'text-white/60' : 'text-muted')}>
                Mobile
              </span>
              <span className={cn('block text-[15px] font-bold mt-0.5', locationPref === 'mobile' ? 'text-white' : 'text-ink')}>
                Will Travel
              </span>
            </span>
          </button>
        </div>

        {/* Contact Details */}
        <div className="flex items-center gap-2 mt-9">
          <User className="w-5 h-5 text-ink" strokeWidth={1.8} />
          <h2 className="text-[20px] font-bold text-ink">Contact Details</h2>
        </div>
        <div className="space-y-4 mt-4">
          <label className="flex items-center gap-3 border-[0.75px] border-[#d2dbe9] rounded-full px-5 py-4">
            <User className="w-5 h-5 text-muted shrink-0" strokeWidth={1.8} />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter Name"
              className="flex-1 text-[15px] text-ink placeholder:text-muted bg-transparent focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-3 border-[0.75px] border-[#d2dbe9] rounded-full px-5 py-4">
            <Phone className="w-5 h-5 text-muted shrink-0" strokeWidth={1.8} />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter Phone Number"
              className="flex-1 text-[15px] text-ink placeholder:text-muted bg-transparent focus:outline-none"
            />
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            placeholder="Additional Notes (Optional)"
            className="w-full border-[0.75px] border-[#d2dbe9] rounded-[20px] px-5 py-4 text-[15px] text-ink placeholder:text-muted resize-none focus:outline-none focus:border-ink/40 transition-colors"
          />
        </div>

        <p className="text-[13px] text-muted text-center leading-5 mt-6">
          A small non-refundable deposit is required to secure your appointment time.
        </p>

        <button
          type="button"
          disabled={!service || submitting || loading}
          onClick={handleSubmit}
          className="w-full bg-ink text-white text-[16px] font-semibold py-[20px] rounded-full mt-3 disabled:opacity-50"
        >
          {submitting ? 'Sending…' : 'Pay Booking Fee'}
        </button>
      </div>
    </div>
  );
}
