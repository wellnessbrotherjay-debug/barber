import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import BarberNav from '@/components/BarberNav';
import {
  Calendar,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Flag,
  HelpCircle,
  ImageIcon,
  LogOut,
  MapPin,
  Phone,
  Star,
  Store,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  authFetch,
  deleteBarberPhoto,
  fetchBarberBookingsForUser,
  fetchBarberPhotos,
  uploadAvatar,
  uploadGalleryPhotos,
  type BarberPhoto,
} from '@/lib/api';
import { DeleteAccountRow } from '@/components/DeleteAccountDialog';

// Board page 61 — barber "Edit Profile".
// Layout, section order and copy replicate the Figma frame exactly; all data
// still loads from and saves to the real barber profile APIs.

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

function PillInput({
  icon,
  ...props
}: { icon: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-center gap-3 w-full rounded-full border-[0.75px] border-[#d2dbe9] bg-white px-5 py-[15px]">
      <span className="shrink-0 text-[#a09cab]">{icon}</span>
      <input
        {...props}
        className="flex-1 bg-transparent outline-none text-[14px] font-medium text-[#1c1b1f] placeholder:text-[#a09cab]"
      />
    </div>
  );
}

export default function BarberProfileEdit() {
  const { user, logout, setUser } = useAuthStore();
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

  // Avatar: really uploaded to /api/barber/upload/avatar, which persists the
  // file server-side and writes users.avatar_url. avatarUrl holds the saved
  // URL returned by that call.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Portfolio: the barber's real work photos from /api/barber/photos.
  const [photos, setPhotos] = useState<BarberPhoto[]>([]);
  const [photosUploading, setPhotosUploading] = useState(false);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const portfolioInputRef = React.useRef<HTMLInputElement | null>(null);

  const [serviceMode, setServiceMode] = useState<'in_shop' | 'come_to_customer'>('in_shop');
  const [bookingMode, setBookingMode] = useState<'instant' | 'request_only'>('request_only');
  const [bufferMinutes, setBufferMinutes] = useState('15');

  const [isOnline, setIsOnline] = useState(true);
  const [scheduleSummary, setScheduleSummary] = useState('Not set yet');

  const [services, setServices] = useState<Service[]>([]);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
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
          // barber_profiles.service_mode is in_shop|mobile|both; this screen's
          // Figma labels are "In Shop" / "Come to Customer".
          if (p.service_mode === 'mobile') setServiceMode('come_to_customer');
          else if (p.service_mode === 'in_shop') setServiceMode('in_shop');
          if (p.booking_mode === 'instant' || p.booking_mode === 'request_only') setBookingMode(p.booking_mode);
          if (p.buffer_minutes != null) setBufferMinutes(String(Number(p.buffer_minutes)));
          setIsOnline(!!p.is_online);

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
              setScheduleSummary(`${days}  • ${sample.start_time?.slice(0, 5)} – ${sample.end_time?.slice(0, 5)}`);
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

  // Real portfolio contents for this barber.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetchBarberPhotos()
      .then((mine) => {
        if (!cancelled) setPhotos(mine);
      })
      .catch(() => {
        /* portfolio just renders empty; upload errors surface inline */
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const url = await uploadAvatar(file);
      setAvatarUrl(url);
      if (user) setUser({ ...user, avatar_url: url });
      toast.success('Photo updated');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAvatarError(message);
      toast.error(message);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handlePortfolioAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    e.target.value = '';
    if (selected.length === 0) return;
    if (selected.length > 6) {
      setPhotosError('You can upload at most 6 photos at a time.');
      return;
    }
    setPhotosError(null);
    setPhotosUploading(true);
    try {
      setPhotos(await uploadGalleryPhotos(selected));
      toast.success(`${selected.length} photo${selected.length === 1 ? '' : 's'} uploaded`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPhotosError(message);
      toast.error(message);
    } finally {
      setPhotosUploading(false);
    }
  }

  async function handlePortfolioDelete(id: string) {
    setPhotosError(null);
    setDeletingPhotoId(id);
    try {
      setPhotos(await deleteBarberPhoto(id));
      toast.success('Photo removed');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPhotosError(message);
      toast.error(message);
    } finally {
      setDeletingPhotoId(null);
    }
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
          phone: form.phone || undefined,
          service_mode: serviceMode === 'in_shop' ? 'in_shop' : 'mobile',
          booking_mode: bookingMode,
          buffer_minutes: Number(bufferMinutes),
          is_online: isOnline,
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
      {/* Header */}
      <div className="flex items-center gap-1.5 px-5 py-4 pt-14">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-6 h-6 flex items-center justify-center shrink-0"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5 text-[#1c1b1f]" />
        </button>
        <p className="flex-1 text-center text-[16px] font-bold leading-6 text-[#1c1b1f]">
          Edit Profile
        </p>
        <span className="w-6 h-6 shrink-0" />
      </div>

      {/* Avatar block */}
      <div className="flex flex-col items-center px-5 pt-2">
        <div className="relative">
          <div className="w-[100px] h-[100px] rounded-[16px] bg-[#f2f1fa] flex items-center justify-center overflow-hidden">
            {avatarUrl || user?.avatar_url ? (
              <img src={avatarUrl || user?.avatar_url} className="w-full h-full object-cover" alt="" />
            ) : (
              <ImageIcon className="w-8 h-8 text-[#c9c6d4]" />
            )}
          </div>
          <label
            className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#1c1b1f] flex items-center justify-center ${
              avatarUploading ? 'opacity-60 cursor-default' : 'cursor-pointer'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-white" />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="hidden"
              disabled={avatarUploading}
              onChange={handlePhotoChange}
            />
          </label>
        </div>
        <h1 className="text-[22px] font-bold text-[#1c1b1f] mt-4">
          {form.display_name || user?.full_name || 'Your Name'}
        </h1>
        <p className="text-[14px] font-semibold text-[#1c1b1f] mt-0.5">
          {avatarUploading ? 'Uploading…' : 'Change Photo'}
        </p>
        {avatarError && (
          <p className="text-[12px] font-medium text-red-600 mt-1 text-center">{avatarError}</p>
        )}
        <p className="text-[12px] font-medium text-[#a09cab] mt-1">
          This information is visible to customers
        </p>
      </div>

      <form onSubmit={handleSave} className="px-5 mt-8 flex flex-col gap-8">
        {/* Basic Information */}
        <section>
          <h2 className="text-[18px] font-bold text-[#1c1b1f] mb-4">Basic Information</h2>
          <div className="flex flex-col gap-3">
            <PillInput
              icon={<User className="w-5 h-5" strokeWidth={1.5} />}
              placeholder="Full Name (required)"
              value={form.display_name}
              onChange={(e) => update('display_name', e.target.value)}
            />
            <PillInput
              icon={<MapPin className="w-5 h-5" strokeWidth={1.5} />}
              placeholder="City / Area (required)"
              value={form.address_text}
              onChange={(e) => update('address_text', e.target.value)}
            />
            <div className="flex items-start gap-3 w-full rounded-[24px] border-[0.75px] border-[#d2dbe9] bg-white px-5 py-[15px] min-h-[120px]">
              <FileText className="w-5 h-5 shrink-0 text-[#a09cab] mt-0.5" strokeWidth={1.5} />
              <textarea
                placeholder="Bio (required)"
                value={form.bio}
                onChange={(e) => update('bio', e.target.value)}
                rows={3}
                className="flex-1 bg-transparent outline-none resize-none text-[14px] font-medium text-[#1c1b1f] placeholder:text-[#a09cab]"
              />
            </div>
          </div>
        </section>

        {/* Contact & Location */}
        <section>
          <h2 className="text-[18px] font-bold text-[#1c1b1f] mb-4">Contact &amp; Location</h2>
          <div className="flex flex-col gap-3">
            <PillInput
              icon={<Phone className="w-5 h-5" strokeWidth={1.5} />}
              placeholder="Enter Phone Number"
              type="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
            />
            <PillInput
              icon={<MapPin className="w-5 h-5" strokeWidth={1.5} />}
              placeholder="Shop Address"
              value={form.address_text}
              onChange={(e) => update('address_text', e.target.value)}
            />
            <PillInput
              icon={<Store className="w-5 h-5" strokeWidth={1.5} />}
              placeholder="Shop Name"
              value={form.shop_name}
              onChange={(e) => update('shop_name', e.target.value)}
            />
            <button
              type="button"
              onClick={() => toast.info('Map picker isn\'t built yet — use the address field above for now.')}
              className="w-full bg-[#1c1b1f] text-white rounded-full py-[16px] text-[14px] font-semibold active:scale-[0.99] transition-transform"
            >
              Set Location on Map
            </button>
          </div>
        </section>

        {/* Service Mode */}
        <section>
          <h2 className="text-[18px] font-bold text-[#1c1b1f] mb-4">Service Mode</h2>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setServiceMode('in_shop')}
              className={`flex-1 py-[15px] rounded-full text-[14px] font-semibold transition-colors ${
                serviceMode === 'in_shop'
                  ? 'bg-[#1c1b1f] text-white'
                  : 'bg-white text-[#6c6a75] border-[0.75px] border-[#d2dbe9]'
              }`}
            >
              In Shop
            </button>
            <button
              type="button"
              onClick={() => setServiceMode('come_to_customer')}
              className={`flex-1 py-[15px] rounded-full text-[14px] font-semibold transition-colors ${
                serviceMode === 'come_to_customer'
                  ? 'bg-[#1c1b1f] text-white'
                  : 'bg-white text-[#6c6a75] border-[0.75px] border-[#d2dbe9]'
              }`}
            >
              Come to Customer
            </button>
          </div>
          <p className="text-[13px] font-medium text-[#6c6a75] mt-4 leading-5">
            Choose how you provide services. You can update this anytime.
          </p>
        </section>

        {/* Availability */}
        <section>
          <h2 className="text-[18px] font-bold text-[#1c1b1f] mb-4">Availability</h2>
          <div className="rounded-[16px] border-[0.75px] border-[#d2dbe9] bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-semibold text-[#1c1b1f]">Online / Offline</p>
              <button
                type="button"
                onClick={async () => {
                  const next = !isOnline;
                  setIsOnline(next);
                  try {
                    const response = await authFetch('/api/barber/online', {
                      method: 'PATCH',
                      body: JSON.stringify({ is_online: next }),
                    });
                    const body = await response.json();
                    if (!response.ok) throw new Error(body.error || `Failed: ${response.status}`);
                    setIsOnline(!!body.is_online);
                  } catch (err) {
                    setIsOnline(!next);
                    toast.error(`${err instanceof Error ? err.message : err}`);
                  }
                }}
                aria-label={isOnline ? 'Go offline' : 'Go online'}
                className={`w-11 h-6 rounded-full transition-colors relative ${isOnline ? 'bg-[#1c1b1f]' : 'bg-[#d8d6e0]'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isOnline ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="border-t border-dashed border-[#d2dbe9] my-3" />
            <p className="text-[13px] font-medium text-[#a09cab]">Working Hours</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Clock className="w-4 h-4 text-[#1c1b1f]" strokeWidth={1.75} />
              <p className="text-[13px] font-semibold text-[#1c1b1f]">
                {loading ? 'Loading…' : scheduleSummary}
              </p>
            </div>
          </div>
        </section>

        {/* Booking Preferences */}
        <section>
          <h2 className="text-[18px] font-bold text-[#1c1b1f] mb-4">Booking Preferences</h2>
          <p className="text-[14px] font-semibold text-[#1c1b1f] mb-3">Booking Type</p>
          <div className="flex flex-col gap-3">
            {([
              { value: 'instant', title: 'Instant', sub: 'Auto approve Jobs' },
              { value: 'request_only', title: 'Request Only', sub: 'You manually approve' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setBookingMode(opt.value)}
                className="w-full rounded-[16px] border-[0.75px] border-[#d2dbe9] bg-white px-4 py-[14px] flex items-center gap-3 text-left"
              >
                <span
                  className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    bookingMode === opt.value ? 'border-[#1c1b1f]' : 'border-[#c9c6d4]'
                  }`}
                >
                  {bookingMode === opt.value && <span className="w-2.5 h-2.5 rounded-full bg-[#1c1b1f]" />}
                </span>
                <span>
                  <span className="block text-[14px] font-semibold text-[#1c1b1f]">{opt.title}</span>
                  <span className="block text-[12px] font-medium text-[#a09cab]">{opt.sub}</span>
                </span>
              </button>
            ))}
          </div>

          <p className="text-[14px] font-semibold text-[#1c1b1f] mt-5 mb-3">
            Buffer Time Between Bookings
          </p>
          <div className="relative">
            <select
              value={bufferMinutes}
              onChange={(e) => setBufferMinutes(e.target.value)}
              className="w-full appearance-none rounded-[12px] border-[0.75px] border-[#d2dbe9] bg-white px-4 py-[14px] text-[14px] font-semibold text-[#1c1b1f]"
            >
              <option value="0">No buffer</option>
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="60">60 min</option>
            </select>
            <ChevronDown className="w-4 h-4 text-[#1c1b1f] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </section>

        {/* Services */}
        <div className="rounded-[16px] border-[0.75px] border-[#d2dbe9] bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-bold text-[#1c1b1f]">Services</p>
            <button
              type="button"
              onClick={() => navigate('/barber/services')}
              className="text-[12px] font-semibold text-[#1c1b1f]"
            >
              • Edit Service
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {services.length === 0 ? (
              <span className="text-[12px] font-medium text-[#a09cab]">No services added yet</span>
            ) : (
              services.map((s) => (
                <span key={s.id} className="px-3 py-1.5 rounded-full bg-[#f8f8f8] text-[12px] font-semibold text-[#1c1b1f]">
                  {s.name}
                </span>
              ))
            )}
          </div>
          <p className="text-[12px] font-medium text-[#a09cab] mt-3">
            {services.length} service{services.length === 1 ? '' : 's'} added
          </p>
        </div>

        {/* Portfolio */}
        <div className="rounded-[16px] border-[0.75px] border-[#d2dbe9] bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-bold text-[#1c1b1f]">Portfolio</p>
            <input
              ref={portfolioInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="hidden"
              onChange={handlePortfolioAdd}
            />
            <button
              type="button"
              disabled={photosUploading}
              onClick={() => portfolioInputRef.current?.click()}
              className="text-[12px] font-semibold text-[#1c1b1f] disabled:opacity-60"
            >
              {photosUploading ? '• Uploading…' : '• Add Photo'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {photos.map((photo) => (
              <div key={photo.id} className="relative w-[56px] h-[56px]">
                <img
                  src={photo.url}
                  alt={photo.caption || ''}
                  className="w-full h-full rounded-[10px] object-cover bg-[#f2f1fa]"
                />
                <button
                  type="button"
                  aria-label="Delete photo"
                  disabled={deletingPhotoId === photo.id}
                  onClick={() => handlePortfolioDelete(photo.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#1c1b1f] text-white text-[11px] font-bold leading-none flex items-center justify-center disabled:opacity-60"
                >
                  ×
                </button>
              </div>
            ))}
            {Array.from({ length: Math.max(3 - photos.length, 0) }).map((_, i) => (
              <div key={`empty-${i}`} className="w-[56px] h-[56px] rounded-[10px] bg-[#f2f1fa] flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-[#c9c6d4]" />
              </div>
            ))}
          </div>
          {photosError && (
            <p className="text-[12px] font-medium text-red-600 mt-2">{photosError}</p>
          )}
          <p className="text-[12px] font-medium text-[#a09cab] mt-3">
            {photos.length} photo{photos.length === 1 ? '' : 's'} uploaded
          </p>
        </div>

        {/* Verification */}
        <section>
          <h2 className="text-[18px] font-bold text-[#1c1b1f] mb-4">Verification</h2>
          <div className="rounded-[16px] bg-[#f8f8f8] p-4 flex items-center justify-between">
            <div>
              <p className="text-[14px] font-bold text-[#1c1b1f]">{isVerified ? 'Approved' : 'Pending'}</p>
              <p className="text-[12px] font-medium text-[#a09cab] mt-0.5">
                {isVerified ? 'Verified badge visible on profile' : 'Verification under review'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/barber/profile')}
              className="text-[13px] font-bold text-[#1c1b1f]"
            >
              View Profile
            </button>
          </div>
          <p className="text-[12px] font-medium text-[#6c6a75] mt-3">
            Admin manually reviews uploaded documents.
          </p>
        </section>

        {/* Performance */}
        <section>
          <h2 className="text-[18px] font-bold text-[#1c1b1f] mb-4">Performance</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-[16px] border-[0.75px] border-[#d2dbe9] bg-white py-4 flex flex-col items-center gap-1">
              <Star className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.75} />
              <p className="text-[13px] font-bold text-[#1c1b1f] mt-1">
                {ratingAvg != null ? ratingAvg.toFixed(1) : '—'}
              </p>
              <p className="text-[13px] font-semibold text-[#1c1b1f]">Rating</p>
            </div>
            <div className="rounded-[16px] border-[0.75px] border-[#d2dbe9] bg-white py-4 flex flex-col items-center gap-1">
              <Calendar className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.75} />
              <p className="text-[13px] font-bold text-[#1c1b1f] mt-1">{jobsCompleted}</p>
              <p className="text-[13px] font-semibold text-[#1c1b1f]">Jobs</p>
            </div>
            <div className="rounded-[16px] border-[0.75px] border-[#d2dbe9] bg-white py-4 flex flex-col items-center gap-1">
              <Clock className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.75} />
              <p className="text-[13px] font-bold text-[#1c1b1f] mt-1">{ratingCount}</p>
              <p className="text-[13px] font-semibold text-[#1c1b1f]">Reviews</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/barber/performance')}
            className="w-full bg-[#1c1b1f] text-white rounded-full py-[16px] text-[14px] font-semibold active:scale-[0.99] transition-transform"
          >
            View Dashboard
          </button>
        </section>

        {/* Safety & Support */}
        <section>
          <h2 className="text-[18px] font-bold text-[#1c1b1f] mb-4">Safety &amp; Support</h2>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => navigate('/barber/report-issue')}
              className="w-full rounded-[16px] border-[0.75px] border-[#d2dbe9] bg-white px-4 py-[16px] flex items-center gap-3 text-left"
            >
              <Flag className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.75} />
              <span className="flex-1 text-[14px] font-semibold text-[#1c1b1f]">Report an issue</span>
              <ChevronRight className="w-5 h-5 text-[#a09cab]" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/barber/help')}
              className="w-full rounded-[16px] border-[0.75px] border-[#d2dbe9] bg-white px-4 py-[16px] flex items-center gap-3 text-left"
            >
              <HelpCircle className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.75} />
              <span className="flex-1 text-[14px] font-semibold text-[#1c1b1f]">Help/Support</span>
              <ChevronRight className="w-5 h-5 text-[#a09cab]" />
            </button>
            <DeleteAccountRow />
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-col gap-1">
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#1c1b1f] text-white rounded-full py-[18px] text-[15px] font-semibold disabled:opacity-40 active:scale-[0.99] transition-transform"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full py-4 text-[15px] font-semibold text-[#a09cab]"
          >
            Cancel
          </button>
        </div>
      </form>

      <div className="px-5 mt-2">
        <button type="button" onClick={() => { logout(); navigate('/'); }}
          className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl text-red-600 font-medium text-sm">
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>
      <BarberNav active="profile" />
    </div>
  );
}
