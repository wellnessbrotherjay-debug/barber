import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import BarberNav from '@/components/BarberNav';
import { Camera, ChevronRight, LogOut, MapPin, Star, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { authFetch, fetchBarberBookingsForUser } from '@/lib/api';

interface ProfileForm {
  display_name: string;
  shop_name: string;
  bio: string;
  experience_years: string;
  address_text: string;
  phone: string;
}

interface Service {
  id: string;
  name: string;
  barber_profiles?: { id: string };
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function BarberProfileEdit() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [form, setForm] = useState<ProfileForm>({
    display_name: user?.full_name || '',
    shop_name: '',
    bio: '',
    experience_years: '',
    address_text: '',
    phone: '',
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Client-side-only photo preview — there is no storage backend for avatars
  // yet, so nothing is actually uploaded/persisted here.
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [serviceMode, setServiceMode] = useState<'in_shop' | 'come_to_customer'>('in_shop');
  const [bookingMode, setBookingMode] = useState<'instant' | 'request_only'>('request_only');
  const [bufferMinutes, setBufferMinutes] = useState('15');

  const [isOnline, setIsOnline] = useState(true);
  const [scheduleSummary, setScheduleSummary] = useState('Not set yet');

  const [services, setServices] = useState<Service[]>([]);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [workPhotosCount, setWorkPhotosCount] = useState(0);
  const [ratingAvg, setRatingAvg] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState(0);
  const [jobsCompleted, setJobsCompleted] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [profileRes, scheduleRes, bookingsRes] = await Promise.all([
          authFetch('/api/barber/profile'),
          authFetch('/api/barber/schedule'),
          fetchBarberBookingsForUser(user.id),
        ]);

        if (profileRes.ok) {
          const p = await profileRes.json();
          if (cancelled) return;
          setBarberId(p.id);
          setIsVerified(!!p.is_verified);
          setWorkPhotosCount(Number(p.work_photos_count || 0));
          setRatingAvg(p.rating_avg != null ? Number(p.rating_avg) : null);
          setRatingCount(Number(p.rating_count || 0));
          setForm({
            display_name: p.display_name || user?.full_name || '',
            shop_name: p.shop_name || '',
            bio: p.bio || '',
            experience_years: p.experience_years != null ? String(p.experience_years) : '',
            address_text: p.address_text || '',
            phone: p.phone || '',
          });
          if (p.service_mode === 'come_to_customer' || p.service_mode === 'in_shop') setServiceMode(p.service_mode);
          if (p.booking_mode === 'instant' || p.booking_mode === 'request_only') setBookingMode(p.booking_mode);

          if (p.id) {
            const servicesRes = await authFetch('/api/services');
            if (servicesRes.ok) {
              const all: Service[] = await servicesRes.json();
              if (!cancelled) setServices(all.filter((s) => s.barber_profiles?.id === p.id));
            }
          }
        }

        if (scheduleRes.ok) {
          const rows = await scheduleRes.json();
          if (!cancelled && Array.isArray(rows) && rows.length > 0) {
            const available = rows.filter((r: any) => r.is_available);
            if (available.length === 0) {
              setScheduleSummary('No working hours set');
            } else {
              const days = available.map((r: any) => DAY_NAMES[r.day_of_week]).join(', ');
              const sample = available[0];
              setScheduleSummary(`${days} · ${sample.start_time?.slice(0, 5)}–${sample.end_time?.slice(0, 5)}`);
            }
          } else if (!cancelled) {
            setScheduleSummary('Not set yet');
          }
        }

        if (bookingsRes.ok) {
          const rows = await bookingsRes.json();
          if (!cancelled && Array.isArray(rows)) {
            setJobsCompleted(rows.filter((b: any) => b.status === 'completed').length);
          }
        }
      } catch {
        // leave defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.full_name]);

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
    toast.info('Preview only — photo storage isn\'t wired up yet, so this won\'t be saved.');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.display_name.trim() || !form.address_text.trim() || !form.bio.trim()) {
      toast.error('Full name, city/area, and bio are required');
      return;
    }
    setSaving(true);
    try {
      const response = await authFetch('/api/barber/profile', {
        method: 'PUT',
        body: JSON.stringify({
          display_name: form.display_name || undefined,
          shop_name: form.shop_name || undefined,
          bio: form.bio || undefined,
          address_text: form.address_text || undefined,
          experience_years: form.experience_years ? Number(form.experience_years) : undefined,
          service_mode: serviceMode,
          booking_mode: bookingMode,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `Failed to save profile: ${response.status}`);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(`${err instanceof Error ? err.message : err}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-white pb-[88px]">
      <div className="px-5 pt-14 pb-6 flex flex-col items-center">
        <div className="relative mb-3">
          <div className="w-20 h-20 rounded-full bg-[#f2f1fa] flex items-center justify-center overflow-hidden">
            {avatarPreview || user?.avatar_url ? (
              <img src={avatarPreview || user?.avatar_url} className="w-full h-full object-cover" alt="" />
            ) : (
              <User className="w-8 h-8 text-[#a09cab]" />
            )}
          </div>
          <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#1c1b1f] flex items-center justify-center cursor-pointer">
            <Camera className="w-3.5 h-3.5 text-white" />
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </label>
        </div>
        <button type="button" className="text-xs font-semibold text-[#1c1b1f]" onClick={() => toast.info('Tap the camera icon on your avatar to choose a new photo')}>
          Change Photo
        </button>
        <h1 className="text-lg font-bold mt-2">{form.display_name || user?.full_name}</h1>
        <p className="text-sm text-[#a09cab]">This information is visible to customers</p>
      </div>

      <form onSubmit={handleSave} className="px-5 space-y-6">
        <section>
          <h2 className="text-sm font-bold mb-2">Basic Information</h2>
          <div className="space-y-3">
            <input
              placeholder="Full Name*"
              value={form.display_name}
              onChange={(e) => update('display_name', e.target.value)}
              className="w-full px-4 py-3 bg-[#fafaff] rounded-xl text-sm"
            />
            <input
              placeholder="City/Area*"
              value={form.address_text}
              onChange={(e) => update('address_text', e.target.value)}
              className="w-full px-4 py-3 bg-[#fafaff] rounded-xl text-sm"
            />
            <textarea
              placeholder="Bio*"
              value={form.bio}
              onChange={(e) => update('bio', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-[#fafaff] rounded-xl text-sm"
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-bold mb-2">Contact &amp; Location</h2>
          <div className="space-y-3">
            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              className="w-full px-4 py-3 bg-[#fafaff] rounded-xl text-sm"
            />
            <input
              placeholder="Shop name"
              value={form.shop_name}
              onChange={(e) => update('shop_name', e.target.value)}
              className="w-full px-4 py-3 bg-[#fafaff] rounded-xl text-sm"
            />
            <input
              placeholder="Shop address"
              value={form.address_text}
              onChange={(e) => update('address_text', e.target.value)}
              className="w-full px-4 py-3 bg-[#fafaff] rounded-xl text-sm"
            />
            <input
              placeholder="Years of experience"
              type="number"
              value={form.experience_years}
              onChange={(e) => update('experience_years', e.target.value)}
              className="w-full px-4 py-3 bg-[#fafaff] rounded-xl text-sm"
            />
            <button
              type="button"
              onClick={() => toast.info('Map picker isn\'t built yet — use the address field above for now.')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#e5e3ee] text-sm font-semibold text-[#1c1b1f]"
            >
              <MapPin className="w-4 h-4" /> Set Location on Map
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-bold mb-2">Service Mode</h2>
          <div className="flex bg-[#f2f1fa] rounded-full p-1">
            {(['in_shop', 'come_to_customer'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setServiceMode(mode)}
                className={`flex-1 py-2 rounded-full text-xs font-semibold ${serviceMode === mode ? 'bg-[#1c1b1f] text-white' : 'text-[#6c6a75]'}`}
              >
                {mode === 'in_shop' ? 'In Shop' : 'Come to Customer'}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-bold mb-2">Availability</h2>
          <div className="bg-[#fafaff] rounded-xl p-4 flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{isOnline ? 'Online' : 'Offline'}</span>
            <button
              type="button"
              onClick={() => setIsOnline((v) => !v)}
              className={`w-11 h-6 rounded-full transition-colors relative ${isOnline ? 'bg-[#1c1b1f]' : 'bg-[#d8d6e0]'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isOnline ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <p className="text-xs text-[#a09cab] px-1">Working hours: {loading ? 'Loading…' : scheduleSummary}</p>
        </section>

        <section>
          <h2 className="text-sm font-bold mb-2">Booking Preferences</h2>
          <div className="space-y-3">
            <div className="flex bg-[#f2f1fa] rounded-full p-1">
              {(['instant', 'request_only'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setBookingMode(mode)}
                  className={`flex-1 py-2 rounded-full text-xs font-semibold ${bookingMode === mode ? 'bg-[#1c1b1f] text-white' : 'text-[#6c6a75]'}`}
                >
                  {mode === 'instant' ? 'Instant' : 'Request Only'}
                </button>
              ))}
            </div>
            <select
              value={bufferMinutes}
              onChange={(e) => setBufferMinutes(e.target.value)}
              className="w-full px-4 py-3 bg-[#fafaff] rounded-xl text-sm"
            >
              <option value="0">No buffer</option>
              <option value="15">15 min buffer</option>
              <option value="30">30 min buffer</option>
              <option value="60">60 min buffer</option>
            </select>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold">Services ({services.length})</h2>
            <button type="button" onClick={() => navigate('/barber/services')} className="text-xs font-semibold text-[#1c1b1f] flex items-center gap-0.5">
              Edit Service <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {services.length === 0 ? (
            <p className="text-xs text-[#a09cab]">No services added yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {services.map((s) => (
                <span key={s.id} className="px-3 py-1.5 rounded-full bg-[#f2f1fa] text-xs font-medium">{s.name}</span>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold">Portfolio</h2>
            <button type="button" onClick={() => navigate('/barber/services')} className="text-xs font-semibold text-[#1c1b1f] flex items-center gap-0.5">
              Add Photo <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {workPhotosCount > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: workPhotosCount }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-[#f2f1fa]" />
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#a09cab]">No portfolio photos yet</p>
          )}
        </section>

        <section>
          <h2 className="text-sm font-bold mb-2">Verification</h2>
          <div className="flex items-center justify-between bg-[#fafaff] rounded-xl p-4">
            <Badge variant={isVerified ? 'success' : 'warning'}>{isVerified ? 'Approved' : 'Pending'}</Badge>
            <button type="button" onClick={() => navigate('/barber/profile')} className="text-xs font-semibold text-[#1c1b1f]">
              View Profile
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-bold mb-2">Performance</h2>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="bg-[#fafaff] rounded-xl p-3 text-center">
              <Star className="w-4 h-4 mx-auto mb-1 fill-ink text-ink" />
              <p className="text-sm font-bold">{ratingAvg != null ? ratingAvg.toFixed(1) : '—'}</p>
              <p className="text-[10px] text-[#a09cab]">Rating</p>
            </div>
            <div className="bg-[#fafaff] rounded-xl p-3 text-center">
              <p className="text-sm font-bold mt-1">{jobsCompleted}</p>
              <p className="text-[10px] text-[#a09cab]">Jobs</p>
            </div>
            <div className="bg-[#fafaff] rounded-xl p-3 text-center">
              <p className="text-sm font-bold mt-1">{ratingCount}</p>
              <p className="text-[10px] text-[#a09cab]">Reviews</p>
            </div>
          </div>
          <button type="button" onClick={() => navigate('/barber/performance')} className="w-full text-center text-xs font-semibold text-[#1c1b1f] py-2 rounded-full bg-[#f2f1fa]">
            View Dashboard
          </button>
        </section>

        <section>
          <h2 className="text-sm font-bold mb-2">Safety &amp; Support</h2>
          <div className="space-y-2">
            <button type="button" onClick={() => navigate('/barber/report-issue')} className="w-full text-left px-4 py-4 rounded-xl bg-[#fafaff] font-medium text-sm flex items-center justify-between">
              Report an issue <ChevronRight className="w-4 h-4 text-[#a09cab]" />
            </button>
            <button type="button" onClick={() => navigate('/barber/help')} className="w-full text-left px-4 py-4 rounded-xl bg-[#fafaff] font-medium text-sm flex items-center justify-between">
              Help / Support <ChevronRight className="w-4 h-4 text-[#a09cab]" />
            </button>
          </div>
        </section>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" size="lg" className="flex-1" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" size="lg" className="flex-1" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>

      <div className="px-5 mt-4">
        <button type="button" onClick={() => { logout(); navigate('/'); }}
          className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl text-red-600 font-medium text-sm">
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>
      <BarberNav active="profile" />
    </div>
  );
}
