import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Clock,
  MapPin,
  Calendar,
  Image as ImageIcon,
  User,
  Phone,
  Store,
  ShieldCheck,
  FileText,
  Car,
  Zap,
  PhoneCall,
  Crosshair,
} from 'lucide-react';
import { toast } from 'sonner';
import { authFetch, fetchBarberPhotos, normalisePhone, uploadAvatar, uploadGalleryPhotos, type BarberPhoto } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import BarberServices from './BarberServices';
import BarberPendingVerification from './BarberPendingVerification';
import ShopLocationMap from '@/components/ShopLocationMap';

const TOTAL_STEPS = 7;

// ---------------------------------------------------------------------------
// Shared Figma-styled pieces
// ---------------------------------------------------------------------------

/** Pinned bottom action pair: solid pill button + ghost text button (Figma 1:2935 etc.) */
function BottomActions({
  primaryLabel,
  onPrimary,
  primaryDisabled,
  secondaryLabel,
  onSecondary,
  footnote,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  footnote?: React.ReactNode;
}) {
  return (
    <div className="px-5 pb-5 pt-2 w-full flex flex-col gap-4 items-center">
      <div className="w-full flex flex-col gap-1">
        <button
          type="button"
          disabled={primaryDisabled}
          onClick={onPrimary}
          className="w-full bg-ink text-white rounded-pill px-9 py-[18px] text-sm font-semibold leading-5 text-center disabled:opacity-50"
        >
          {primaryLabel}
        </button>
        {secondaryLabel && (
          <button
            type="button"
            onClick={onSecondary}
            className="w-full rounded-pill px-9 py-[18px] text-sm font-semibold leading-5 text-center text-muted"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
      {footnote && (
        <p className="text-[10px] leading-[14px] font-normal text-muted text-center">{footnote}</p>
      )}
    </div>
  );
}

/** Step header used on steps 2..7 (Figma 1:2955): back arrow + "Step N of 7" over bold title */
function StepHeader({
  step,
  title,
  onBack,
}: {
  step: number;
  title: string;
  onBack?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-5 py-4">
      {onBack && (
        <button type="button" onClick={onBack} className="shrink-0 -ml-1 p-1">
          <ArrowLeft className="w-5 h-5 text-ink" />
        </button>
      )}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <p className="text-xs font-medium leading-4 text-muted">
          Step {step} of {TOTAL_STEPS}
        </p>
        <h1 className="text-lg font-bold leading-6 text-ink">{title}</h1>
      </div>
    </div>
  );
}

/** Rounded-pill bordered input with a leading icon (Figma 1:2969 "input") */
function PillInput({
  icon: Icon,
  placeholder,
  value,
  onChange,
  type = 'text',
}: {
  icon: React.ComponentType<{ className?: string }>;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="relative w-full">
      <Icon className="w-[18px] h-[18px] text-[#848992] absolute left-[18px] top-1/2 -translate-y-1/2" />
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-[#e5e7eb] rounded-pill pl-11 pr-[18px] py-[18px] text-sm font-medium leading-[18px] text-ink placeholder:text-[#848992]"
      />
    </div>
  );
}

type DocKey = 'drivers_license' | 'passport' | 'birth_certificate' | 'business_registration';

interface DocDef {
  key: DocKey;
  label: React.ReactNode;
  description: string;
}

const DOCS: DocDef[] = [
  {
    key: 'drivers_license',
    label: (
      <>
        Driver&apos;s License<span className="text-[red]">*</span>
      </>
    ),
    description: "Driver's License or National ID card.",
  },
  {
    key: 'passport',
    label: (
      <>
        Upload Passport<span className="text-[red]">*</span>
      </>
    ),
    description: 'Official Government Passport document.',
  },
  {
    key: 'birth_certificate',
    label: <>Upload Birth Certificate (optional)</>,
    description: 'Professional qualification or barbering license.',
  },
  {
    key: 'business_registration',
    label: (
      <>
        Business Registration <span className="font-medium text-muted">(Optional)</span>
      </>
    ),
    description: 'Proof of business ownership if applicable.',
  },
];

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // Mon..Sun display labels

export default function BarberOnboarding() {
  const { user, setUser } = useAuthStore();
  const [step, setStep] = useState(0); // 0 = intro
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Step 1 — profile
  const [profile, setProfile] = useState({
    display_name: user?.full_name || '',
    phone: '',
    shop_name: '',
    bio: '',
    address_text: '', // used as "service area" here
  });

  // Step 2 — verification documents (filename only, real file input)
  const [docFiles, setDocFiles] = useState<Partial<Record<DocKey, string>>>({});

  // Step 3 — work photos. Real uploads: files are POSTed to
  // /api/barber/upload/gallery, stored server-side, and the returned rows are
  // this barber's actual gallery.
  const [photos, setPhotos] = useState<BarberPhoto[]>([]);
  // Step 2 avatar. Seeded from the signed-in user so a barber returning to
  // onboarding sees the photo they already uploaded.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const url = await uploadAvatar(file);
      setAvatarUrl(url);
      if (user) setUser({ ...user, avatar_url: url });
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : String(err));
    } finally {
      setAvatarUploading(false);
    }
  }
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoCount = photos.length;

  // Step 5 — where do you work
  const [serviceMode, setServiceMode] = useState<'in_shop' | 'mobile' | 'both'>('in_shop');
  const [shopAddress, setShopAddress] = useState('');
  const [shopLat, setShopLat] = useState<number | null>(null);
  const [shopLng, setShopLng] = useState<number | null>(null);
  const [addressSearchNonce, setAddressSearchNonce] = useState(0);

  // The two service cards are independent toggles over one mode value.
  // At least one must stay selected — a barber with no mode is unbookable.
  const hasShop = serviceMode !== 'mobile';
  const hasMobile = serviceMode !== 'in_shop';
  function toggleShopMode() {
    setServiceMode(hasShop ? (hasMobile ? 'mobile' : 'in_shop') : hasMobile ? 'both' : 'in_shop');
  }
  function toggleMobileMode() {
    setServiceMode(hasMobile ? (hasShop ? 'in_shop' : 'mobile') : hasShop ? 'both' : 'mobile');
  }

  // Step 6 — availability
  const [online, setOnline] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [activeDays, setActiveDays] = useState<boolean[]>([true, true, true, true, true, false, false]); // Mon..Sun
  const [bookingMode, setBookingMode] = useState<'instant' | 'request_only'>('request_only');
  const [radiusKm, setRadiusKm] = useState(15);
  const [bufferMin, setBufferMin] = useState(15);

  // Geocoded address components for the shop pin (persisted alongside lat/lng).
  const [geoCity, setGeoCity] = useState<string | null>(null);
  const [geoRegion, setGeoRegion] = useState<string | null>(null);
  const [geoCountry, setGeoCountry] = useState<string | null>(null);

  const [missing, setMissing] = useState<string[]>([]);
  const [servicesCount, setServicesCount] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // ---------------------------------------------------------------------
  // Rehydrate from the database on mount. A barber who logs out mid-flow
  // comes back to their saved values AND their saved onboarding_step, so
  // nothing typed earlier is lost.
  // ---------------------------------------------------------------------
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [profileRes, scheduleRes] = await Promise.all([
          authFetch('/api/barber/profile'),
          authFetch('/api/barber/schedule'),
        ]);
        if (cancelled) return;

        if (profileRes.ok) {
          const p = await profileRes.json();
          if (cancelled) return;
          setProfile({
            display_name: p.display_name || user?.full_name || '',
            phone: p.phone || '',
            shop_name: p.shop_name || '',
            bio: p.bio || '',
            address_text: p.address_text || '',
          });
          if (p.service_mode === 'mobile' || p.service_mode === 'in_shop' || p.service_mode === 'both') setServiceMode(p.service_mode);
          if (p.address_text) setShopAddress(p.address_text);
          if (p.latitude != null) setShopLat(Number(p.latitude));
          if (p.longitude != null) setShopLng(Number(p.longitude));
          if (p.city) setGeoCity(p.city);
          if (p.region) setGeoRegion(p.region);
          if (p.country) setGeoCountry(p.country);
          if (p.booking_mode === 'instant' || p.booking_mode === 'request_only') setBookingMode(p.booking_mode);
          if (p.service_radius_km != null) setRadiusKm(Number(p.service_radius_km));
          if (p.buffer_minutes != null) setBufferMin(Number(p.buffer_minutes));
          setOnline(!!p.is_online);
          // work photos are loaded from /api/barber/photos (real rows), not
          // from the denormalised count.
          // onboarding_step is 1-7 (Figma numbering); local `step` is 0-6.
          const savedStep = Number(p.onboarding_step);
          if (Number.isFinite(savedStep) && savedStep >= 1 && savedStep <= 7) {
            // Only jump if the user hasn't already navigated while we loaded.
            setStep((current) => (current === 0 ? savedStep - 1 : current));
          }
        }

        if (scheduleRes.ok) {
          const rows = await scheduleRes.json();
          if (!cancelled && Array.isArray(rows) && rows.length > 0) {
            // barber_schedule uses 0=Sunday; the UI grid is Mon..Sun.
            const days = [false, false, false, false, false, false, false];
            for (const r of rows) {
              const uiIndex = (Number(r.day_of_week) + 6) % 7; // Sun(0)->6, Mon(1)->0
              if (uiIndex >= 0 && uiIndex < 7) days[uiIndex] = !!r.is_available;
            }
            setActiveDays(days);
            const sample = rows.find((r: any) => r.is_available) || rows[0];
            if (sample?.start_time) setStartTime(String(sample.start_time).slice(0, 5));
            if (sample?.end_time) setEndTime(String(sample.end_time).slice(0, 5));
          }
        }
      } catch (err) {
        console.error(`[BarberOnboarding] restoring saved onboarding progress failed:`, err);
        // Keep defaults — the user can still fill the flow in from scratch.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Persist how far the barber has got. `step` is the local 0-based index;
   * onboarding_step in the database is the Figma-visible 1-7 number.
   * Fire-and-forget: a failed progress ping must never block navigation.
   */
  function markStep(localStep: number) {
    if (!hydrated) return;
    const value = Math.min(Math.max(localStep + 1, 1), 7);
    authFetch('/api/barber/profile', {
      method: 'PUT',
      body: JSON.stringify({ onboarding_step: value }),
    }).catch(() => {});
  }

  function goToStep(next: number) {
    setStep(next);
    markStep(next);
  }

  // Live count of this barber's own services, refetched whenever step 6
  // (Finish Setup) is reached, so "at least 1 service" can be enforced
  // client-side before the user even taps Finish, not just after a failed
  // server-side validation.
  React.useEffect(() => {
    if (step !== 6) return;
    let cancelled = false;
    authFetch('/api/barber/services')
      .then((r) => (r.ok ? r.json() : []))
      .then((mine: unknown[]) => {
        if (!cancelled) setServicesCount(Array.isArray(mine) ? mine.length : 0);
      })
      .catch(() => {
        if (!cancelled) setServicesCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [step]);

  // The gallery is real server state, so entering the work-photos step pulls
  // whatever this barber has already uploaded (e.g. a resumed onboarding).
  React.useEffect(() => {
    if (step !== 3) return;
    let cancelled = false;
    fetchBarberPhotos()
      .then((mine) => {
        if (!cancelled) setPhotos(mine);
      })
      .catch(() => {
        /* leave the gallery empty; upload errors surface inline */
      });
    return () => {
      cancelled = true;
    };
  }, [step]);

  // Live, client-side mirror of the server's onboarding/complete validation
  // (display_name/bio/shop_name filled in + >=1 service) — computed from
  // current form state so the Finish Setup button can be disabled and the
  // exact gaps highlighted BEFORE the user attempts to submit, not after.
  const liveMissing = React.useMemo(() => {
    const gaps: { key: string; label: string; step: number }[] = [];
    if (!profile.bio?.trim()) gaps.push({ key: 'bio', label: 'Bio', step: 1 });
    if (!profile.shop_name?.trim()) gaps.push({ key: 'shop_name', label: 'Shop name', step: 1 });
    if (servicesCount === 0) gaps.push({ key: 'services', label: 'At least 1 service', step: 4 });
    return gaps;
  }, [profile.bio, profile.shop_name, servicesCount]);

  const docInputRef = useRef<Record<DocKey, HTMLInputElement | null>>({} as any);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  function updateProfile<K extends keyof typeof profile>(key: K, value: string) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSaveProfile() {
    setSaving(true);
    try {
      const response = await authFetch('/api/barber/profile', {
        method: 'PUT',
        body: JSON.stringify({
          display_name: profile.display_name || undefined,
          phone: normalisePhone(profile.phone) || undefined,
          shop_name: profile.shop_name || undefined,
          bio: profile.bio || undefined,
          address_text: profile.address_text || undefined,
          onboarding_step: 3,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `Failed to save profile: ${response.status}`);
      setStep(2);
    } catch (err) {
      toast.error(`${err instanceof Error ? err.message : err}`);
    } finally {
      setSaving(false);
    }
  }

  function handleDocSelect(key: DocKey, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setDocFiles((prev) => ({ ...prev, [key]: file.name }));
  }

  async function handleSubmitVerification(skip: boolean) {
    if (skip) {
      goToStep(3);
      return;
    }
    const submittedTypes = DOCS.filter((d) => docFiles[d.key]).map((d) => d.key);
    if (submittedTypes.length === 0) {
      goToStep(3);
      return;
    }
    setSaving(true);
    try {
      const response = await authFetch('/api/barber/verification/submit', {
        method: 'POST',
        body: JSON.stringify({ documentTypes: submittedTypes }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `Failed to submit documents: ${response.status}`);
      toast.success('Documents submitted for review');
      goToStep(3);
    } catch (err) {
      toast.error(`${err instanceof Error ? err.message : err}`);
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    e.target.value = ''; // let the same file be re-picked after an error
    if (selected.length === 0) return;
    if (selected.length > 6) {
      setPhotoError('You can upload at most 6 photos at a time.');
      return;
    }
    setPhotoError(null);
    setUploadingPhotos(true);
    try {
      const updated = await uploadGalleryPhotos(selected);
      setPhotos(updated);
      toast.success(`${selected.length} photo${selected.length === 1 ? '' : 's'} uploaded`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPhotoError(message);
      toast.error(message);
    } finally {
      setUploadingPhotos(false);
    }
  }

  // Each photo is already persisted server-side the moment it is uploaded, so
  // Continue/Skip simply advances the wizard — there is nothing left to save.
  function handleSavePhotos(_skip: boolean) {
    goToStep(4);
  }

  async function handleSaveWorkLocation() {
    setSaving(true);
    try {
      const response = await authFetch('/api/barber/profile', {
        method: 'PUT',
        body: JSON.stringify({
          service_mode: serviceMode,
          // Coordinates persist for EVERY mode — a mobile barber with no base
          // location can never appear in nearby search (travel radius needs
          // a point to measure from).
          address_text: shopAddress || profile.address_text || undefined,
          latitude: shopLat ?? undefined,
          longitude: shopLng ?? undefined,
          // Only sent when the reverse geocoder actually resolved them.
          city: geoCity || undefined,
          region: geoRegion || undefined,
          country: geoCountry || undefined,
          onboarding_step: 7,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `Failed to save location: ${response.status}`);
      setStep(6);
    } catch (err) {
      toast.error(`${err instanceof Error ? err.message : err}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleFinishSetup() {
    setSaving(true);
    setMissing([]);
    try {
      // Persist availability + booking mode first.
      const schedule = activeDays.map((isOn, i) => ({
        day_of_week: (i + 1) % 7, // Mon(0)->1 ... Sun(6)->0, matches barber_schedule's 0=Sunday convention
        start_time: startTime,
        end_time: endTime,
        is_available: isOn,
      }));
      const scheduleResp = await authFetch('/api/barber/schedule', {
        method: 'PUT',
        body: JSON.stringify({ schedule }),
      });
      const scheduleBody = await scheduleResp.json();
      if (!scheduleResp.ok) throw new Error(scheduleBody.error || `Failed to save availability: ${scheduleResp.status}`);

      const profileResp = await authFetch('/api/barber/profile', {
        method: 'PUT',
        body: JSON.stringify({
          booking_mode: bookingMode,
          service_radius_km: radiusKm,
          buffer_minutes: bufferMin,
          is_online: online,
          onboarding_step: 7,
        }),
      });
      if (!profileResp.ok) {
        const b = await profileResp.json().catch(() => ({}));
        throw new Error(b.error || `Failed to save booking mode: ${profileResp.status}`);
      }

      const response = await authFetch('/api/barber/onboarding/complete', { method: 'POST' });
      const body = await response.json();
      if (!response.ok) {
        if (body.missing) {
          setMissing(body.missing);
          toast.error(`Missing: ${body.missing.join(', ')}`);
          return;
        }
        throw new Error(body.error || `Failed to submit: ${response.status}`);
      }
      setUser(user ? { ...user, onboarding_completed: true, is_verified: false } : user);
      setSubmitted(true);
    } catch (err) {
      toast.error(`${err instanceof Error ? err.message : err}`);
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return <BarberPendingVerification />;
  }

  // ------------------------------------------------------------------
  // Step 0 — Setup / intro (Figma 1:2884)
  // ------------------------------------------------------------------
  if (step === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* "Professional Setup" bar + progress (Figma 1:2904) */}
        <div className="px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium leading-4 text-ink">Professional Setup</p>
              <span className="bg-[#f8f8f8] rounded-pill px-3 py-1.5 text-[10px] leading-3 font-medium text-[#514e59]">
                Step 1 of {TOTAL_STEPS}
              </span>
            </div>
            <div className="relative h-2 w-full">
              <div className="absolute inset-0 bg-[#f5f1f1] rounded-pill" />
              <div
                className="absolute inset-y-0 left-0 bg-ink rounded-pill"
                style={{ width: `${(1 / TOTAL_STEPS) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Welcome block (Figma 1:2897) */}
        <div className="px-5 pt-9 flex flex-col gap-4 items-start">
          <div className="size-[100px] bg-surface rounded-[8px] flex items-center justify-center">
            <ImageIcon className="w-10 h-10 text-[#c9c6da]" />
          </div>
          <div className="flex flex-col gap-1 items-start">
            <h2 className="text-2xl font-bold text-ink">Welcome, Barber</h2>
            <p className="text-sm font-medium text-muted leading-normal">
              Join our community of stylists. Set up your chair
              <br />
              &amp; start receiving bookings.
            </p>
          </div>
        </div>

        {/* Checklist rows (Figma 1:2916) */}
        <div className="px-5 py-4 mt-8 flex flex-col gap-4 items-start">
          {[
            { icon: MapPin, label: 'Set your shop location', to: 5 },
            { icon: Clock, label: 'Define working hours', to: 6 },
            { icon: Calendar, label: 'Sync your schedule', to: 6 },
          ].map(({ icon: Icon, label, to }) => (
            <button key={label} type="button" onClick={() => goToStep(to)} className="flex gap-3 items-center">
              <div className="size-[38px] bg-surface-2 rounded-[8px] flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-ink" />
              </div>
              <p className="text-xs font-semibold leading-4 text-ink">{label}</p>
            </button>
          ))}
        </div>

        <div className="flex-1" />
        <BottomActions
          primaryLabel="Start Setup"
          onPrimary={() => goToStep(1)}
          secondaryLabel="Skip for now"
          onSecondary={() => goToStep(1)}
          footnote={
            <>
              Minimum setup is required to access the barber dashboard
              <br />
              &amp; start appearing in searches.
            </>
          }
        />
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Step 1 — Your profile (Figma 1:2942)
  // ------------------------------------------------------------------
  if (step === 1) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <StepHeader step={2} title="Your profile" onBack={() => setStep(0)} />
        {/* Board page 20 draws this as a bare placeholder with no label, so the
            tile itself is the affordance — tapping it opens the picker and it
            then shows the uploaded avatar. No extra chrome is added to the
            locked design. */}
        <div className="px-4 pt-4 flex flex-col items-center gap-2">
          <label className="size-[100px] bg-surface rounded-[8px] flex items-center justify-center overflow-hidden cursor-pointer active:opacity-80">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="hidden"
              disabled={avatarUploading}
              onChange={onPickAvatar}
            />
            {avatarUrl ? (
              <img src={avatarUrl} alt="Your profile" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-10 h-10 text-[#c9c6da]" />
            )}
          </label>
          {avatarUploading && <p className="text-[11px] text-muted">Uploading…</p>}
          {avatarError && <p className="text-[11px] text-red-600 text-center px-6">{avatarError}</p>}
        </div>
        <div className="px-5 py-4">
          <div className="bg-white rounded-[12px] p-4 flex flex-col gap-4 drop-shadow-[0px_4px_16px_rgba(231,236,243,0.08)]">
            <PillInput
              icon={User}
              placeholder="Enter Name"
              value={profile.display_name}
              onChange={(v) => updateProfile('display_name', v)}
            />
            <PillInput
              icon={Phone}
              placeholder="Enter Phone Number"
              value={profile.phone}
              onChange={(v) => updateProfile('phone', v)}
            />
            <PillInput
              icon={Store}
              placeholder="Shop Name"
              value={profile.shop_name}
              onChange={(v) => updateProfile('shop_name', v)}
            />
            <div className="relative w-full">
              <FileText className="w-[18px] h-[18px] text-[#848992] absolute left-[18px] top-[18px]" />
              <textarea
                placeholder="Short bio"
                value={profile.bio}
                onChange={(e) => updateProfile('bio', e.target.value)}
                className="w-full h-[141px] bg-white border border-[#e5e7eb] rounded-[12px] pl-11 pr-[18px] py-[18px] text-sm font-medium leading-[18px] text-ink placeholder:text-[#848992] resize-none"
              />
            </div>
            <PillInput
              icon={MapPin}
              placeholder="Service area (City/Zone)"
              value={profile.address_text}
              onChange={(v) => updateProfile('address_text', v)}
            />
          </div>
        </div>
        <div className="flex-1" />
        <BottomActions
          primaryLabel={saving ? 'Saving…' : 'Continue'}
          primaryDisabled={saving}
          onPrimary={handleSaveProfile}
          secondaryLabel="Back"
          onSecondary={() => setStep(0)}
        />
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Step 2 — Verification (Figma 1:585)
  // ------------------------------------------------------------------
  if (step === 2) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <StepHeader step={3} title="Verification" onBack={() => setStep(1)} />
        {/* Identity Verification intro (Figma 1:605) */}
        <div className="px-5 py-4 flex gap-2 items-start">
          <div className="size-[38px] bg-surface-2 rounded-[8px] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6 text-ink" />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <h2 className="text-lg font-bold leading-6 text-ink">Identity Verification</h2>
            <p className="text-xs font-medium leading-4 text-muted">
              To ensure trust in our marketplace, we require all barbers to verify their identity and
              professional qualifications before accepting bookings.
            </p>
          </div>
        </div>

        {/* Big upload tiles (Figma 1:613..1:640) */}
        <div className="flex flex-col">
          {DOCS.map((doc) => (
            <div key={doc.key} className="px-5 py-4 flex justify-center">
              <div className="relative bg-surface rounded-[8px] w-full max-w-[353px] aspect-square">
                <div className="absolute left-1/2 -translate-x-1/2 top-[72px]">
                  <ImageIcon className="w-[58px] h-[52px] text-[#c9c6da]" />
                </div>
                <div className="absolute left-0 right-0 top-[161px] flex flex-col gap-1 items-center justify-center text-center">
                  <p className="text-sm font-semibold leading-5 text-black">{doc.label}</p>
                  <p className="text-xs font-semibold leading-[14px] text-muted">{doc.description}</p>
                </div>
                <input
                  ref={(el) => {
                    docInputRef.current[doc.key] = el;
                  }}
                  type="file"
                  className="hidden"
                  onChange={(e) => handleDocSelect(doc.key, e)}
                />
                <button
                  type="button"
                  onClick={() => docInputRef.current[doc.key]?.click()}
                  className={`absolute left-1/2 -translate-x-1/2 top-[232px] rounded-pill px-8 py-4 text-sm font-semibold leading-5 text-center ${
                    docFiles[doc.key] ? 'bg-green-100 text-green-800' : 'bg-ink text-white'
                  }`}
                >
                  {docFiles[doc.key] ? (
                    <span className="flex items-center gap-1">
                      <Check className="w-4 h-4" /> Uploaded
                    </span>
                  ) : (
                    'Select file'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Processing time info card (Figma 1:649) */}
        <div className="px-5 py-4">
          <div className="bg-[#f4f5f8] rounded-[12px] p-4 flex gap-3 items-start">
            <div className="size-10 bg-white border border-[#e5e7eb] rounded-pill flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-ink" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold leading-5 text-ink">Processing Time</p>
              <p className="text-xs font-medium leading-4 text-muted max-w-[264px]">
                Verification usually takes 24-48 hours once submitted.
              </p>
            </div>
          </div>
        </div>

        <BottomActions
          primaryLabel={saving ? 'Submitting…' : 'Submit for Review'}
          primaryDisabled={saving}
          onPrimary={() => handleSubmitVerification(false)}
          secondaryLabel="Skip for now"
          onSecondary={() => handleSubmitVerification(true)}
        />
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Step 3 — Your work photos (Figma 1:2999)
  // ------------------------------------------------------------------
  if (step === 3) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <StepHeader step={4} title="Your work photos" onBack={() => setStep(2)} />
        <div className="px-5 py-4 flex justify-center">
          <div className="relative bg-surface rounded-[8px] w-full max-w-[353px] aspect-square">
            {photoCount === 0 ? (
              <div className="absolute left-1/2 -translate-x-1/2 top-[72px]">
                <ImageIcon className="w-[58px] h-[52px] text-[#c9c6da]" />
              </div>
            ) : (
              <div className="absolute left-0 right-0 top-[24px] px-5 grid grid-cols-3 gap-2">
                {photos.slice(0, 6).map((photo) => (
                  <img
                    key={photo.id}
                    src={photo.url}
                    alt=""
                    className="w-full aspect-square object-cover rounded-[8px]"
                  />
                ))}
              </div>
            )}
            <div className="absolute left-0 right-0 top-[161px] flex flex-col gap-1 items-center justify-center text-center">
              {photoCount === 0 ? (
                <>
                  <p className="text-sm font-semibold leading-5 text-black">No photos added yet</p>
                  <p className="text-[10px] font-semibold leading-[14px] text-muted">
                    Showcase your best projects to stand out
                  </p>
                </>
              ) : (
                <p className="text-sm font-semibold leading-5 text-black">
                  {photoCount} photo{photoCount === 1 ? '' : 's'} uploaded
                </p>
              )}
              {photoError && (
                <p className="text-[10px] font-semibold leading-[14px] text-red-600 px-6">{photoError}</p>
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="hidden"
              onChange={handlePhotoSelect}
            />
            <button
              type="button"
              disabled={uploadingPhotos}
              onClick={() => photoInputRef.current?.click()}
              className="absolute left-1/2 -translate-x-1/2 top-[232px] bg-ink text-white rounded-pill px-8 py-4 text-sm font-semibold leading-5 whitespace-nowrap disabled:opacity-60"
            >
              {uploadingPhotos ? 'Uploading…' : 'Add to Gallery'}
            </button>
          </div>
        </div>
        <div className="flex-1" />
        <BottomActions
          primaryLabel={saving ? 'Saving…' : 'Continue'}
          primaryDisabled={saving || uploadingPhotos}
          onPrimary={() => handleSavePhotos(false)}
          secondaryLabel="Skip for now"
          onSecondary={() => handleSavePhotos(true)}
        />
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Step 4 — Services (Figma 1:3033; reuses BarberServices logic/UI)
  // ------------------------------------------------------------------
  if (step === 4) {
    return (
      <div className="min-h-screen bg-white pb-40 relative">
        <StepHeader step={5} title="Services" onBack={() => setStep(3)} />
        <BarberServices embedded />
        <div className="fixed bottom-0 left-0 right-0 bg-white px-5 pb-5 pt-2 max-w-md mx-auto flex flex-col gap-1">
          <button
            type="button"
            onClick={() => goToStep(5)}
            className="w-full bg-ink text-white rounded-pill px-9 py-[18px] text-sm font-semibold leading-5 text-center"
          >
            Go Online
          </button>
          <button
            type="button"
            onClick={async () => {
              // Services are saved to the `services` table as they're added
              // (BarberServices posts each one). This just confirms what the
              // server actually holds rather than claiming a phantom save.
              try {
                const r = await authFetch('/api/barber/services');
                const mine = r.ok ? await r.json() : [];
                const n = Array.isArray(mine) ? mine.length : 0;
                setServicesCount(n);
                toast.success(`${n} service${n === 1 ? '' : 's'} saved`);
              } catch (err) {
        console.error(`[BarberOnboarding] restoring saved onboarding progress failed:`, err);
                toast.error('Could not confirm saved services');
              }
            }}
            className="w-full rounded-pill px-9 py-[18px] text-sm font-semibold leading-5 text-center text-muted"
          >
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Step 5 — Where do you work? (Figma 1:3097)
  // ------------------------------------------------------------------
  if (step === 5) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <StepHeader step={6} title="Where do you work?" onBack={() => setStep(4)} />
        <div className="px-5 py-4 flex flex-col gap-3">
          {/* In-shop card */}
          <div
            className="bg-white border-[0.75px] border-[#d2dbe9] rounded-[12px] p-3 flex flex-col gap-3 cursor-pointer"
            onClick={toggleShopMode}
          >
            <div className="flex items-start justify-between w-full">
              <div className="flex gap-3 items-center">
                <div className="size-[38px] bg-surface-2 rounded-[8px] flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4 text-ink" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold leading-4 text-ink">In-shop</p>
                  <p className="text-[10px] font-semibold leading-[14px] text-muted">
                    Customers come to your location
                  </p>
                </div>
              </div>
              <span
                className={`size-3 rounded-[2px] border border-ink shrink-0 flex items-center justify-center ${
                  hasShop ? 'bg-ink' : 'bg-white'
                }`}
              >
                {hasShop && <Check className="w-2.5 h-2.5 text-white" />}
              </span>
            </div>
            {hasShop && (
              <div className="bg-[#fafafa] rounded-[12px] p-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col gap-2">
                  <div className="relative w-full">
                    <input
                      placeholder="Shop Address"
                      value={shopAddress}
                      onChange={(e) => setShopAddress(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setAddressSearchNonce((n) => n + 1); }}
                      className="w-full bg-white border border-[#e5e7eb] rounded-pill pl-4 pr-11 py-4 text-sm font-medium leading-[18px] text-ink placeholder:text-[#848992]"
                    />
                    <button type="button" aria-label="Find address on map" onClick={() => setAddressSearchNonce((n) => n + 1)} className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Crosshair className="w-[18px] h-[18px] text-[#848992]" />
                    </button>
                  </div>
                  <p className="text-[10px] font-semibold leading-[14px] text-muted">
                    Set precise pin on map
                  </p>
                  <ShopLocationMap
                    latitude={shopLat}
                    longitude={shopLng}
                    searchQuery={shopAddress}
                    searchNonce={addressSearchNonce}
                    onChange={(lat, lng, address, parts) => {
                      setShopLat(lat);
                      setShopLng(lng);
                      setShopAddress(address);
                      if (parts?.city) setGeoCity(parts.city);
                      if (parts?.region) setGeoRegion(parts.region);
                      if (parts?.country) setGeoCountry(parts.country);
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Come to customer card */}
          <div
            className="bg-white border-[0.75px] border-[#d2dbe9] rounded-[12px] p-3 cursor-pointer"
            onClick={toggleMobileMode}
          >
            <div className="flex items-start justify-between w-full">
              <div className="flex gap-3 items-center">
                <div className="size-[38px] bg-surface-2 rounded-[8px] flex items-center justify-center shrink-0">
                  <Car className="w-4 h-4 text-ink" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold leading-4 text-ink">Come to customer</p>
                  <p className="text-[10px] font-semibold leading-[14px] text-muted">
                    You travel to the customer&apos;s site
                  </p>
                </div>
              </div>
              <span
                className={`size-3 rounded-[2px] border border-ink shrink-0 flex items-center justify-center ${
                  hasMobile ? 'bg-ink' : 'bg-white'
                }`}
              >
                {hasMobile && <Check className="w-2.5 h-2.5 text-white" />}
              </span>
            </div>
          </div>
        </div>
        <div className="flex-1" />
        <BottomActions
          primaryLabel={saving ? 'Saving…' : 'Continue'}
          primaryDisabled={saving}
          onPrimary={handleSaveWorkLocation}
          secondaryLabel="Go Back"
          onSecondary={() => setStep(4)}
        />
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Step 6 — Availability (step 7 of 7; no dedicated Figma frame — styled
  // to match the onboarding system: StepHeader + bordered cards + pill CTA)
  // ------------------------------------------------------------------
  const bufferPresets = [5, 15, 30, 45];

  return (
    <div className="min-h-screen bg-white pb-8">
      <StepHeader step={7} title="Availability" onBack={() => setStep(5)} />
      <div className="px-5 space-y-4">
        <div className="bg-white border-[0.75px] border-[#d2dbe9] rounded-[12px] p-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold leading-4 text-ink">Status: {online ? 'Online' : 'Offline'}</p>
            <p className="text-[10px] font-semibold leading-[14px] text-muted mt-1">
              {online ? 'You are visible to customers' : 'You are currently hidden'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOnline((v) => !v)}
            className={`w-12 h-7 rounded-pill transition-colors flex items-center px-1 ${online ? 'bg-ink' : 'bg-border'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${online ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        <div>
          <p className="text-xs font-bold leading-4 text-ink mb-2">Working Hours</p>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Clock className="w-4 h-4 text-[#848992] absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full pl-11 pr-3 py-3 bg-white border border-[#e5e7eb] rounded-[8px] text-xs font-medium"
              />
            </div>
            <div className="relative flex-1">
              <Clock className="w-4 h-4 text-[#848992] absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full pl-11 pr-3 py-3 bg-white border border-[#e5e7eb] rounded-[8px] text-xs font-medium"
              />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold leading-4 text-ink mb-2">Active Days</p>
          <div className="flex justify-between">
            {DAYS.map((d, i) => (
              <button
                key={i}
                type="button"
                onClick={() =>
                  setActiveDays((prev) => prev.map((v, idx) => (idx === i ? !v : v)))
                }
                className={`w-9 h-9 rounded-full text-xs font-bold flex items-center justify-center ${
                  activeDays[i] ? 'bg-ink text-white' : 'bg-surface text-muted'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold leading-4 text-ink mb-2">Booking Mode</p>
          <div className="grid grid-cols-2 gap-3">
            <div
              className={`bg-white rounded-[12px] p-3 cursor-pointer border ${
                bookingMode === 'instant' ? 'border-ink border-2' : 'border-[#d2dbe9] border-[0.75px]'
              }`}
              onClick={() => setBookingMode('instant')}
            >
              <Zap className="w-5 h-5 text-ink mb-1" />
              <p className="text-xs font-semibold text-ink">Instant</p>
              <p className="text-[10px] text-muted">Booking Confirmed</p>
            </div>
            <div
              className={`bg-white rounded-[12px] p-3 cursor-pointer border ${
                bookingMode === 'request_only' ? 'border-ink border-2' : 'border-[#d2dbe9] border-[0.75px]'
              }`}
              onClick={() => setBookingMode('request_only')}
            >
              <PhoneCall className="w-5 h-5 text-ink mb-1" />
              <p className="text-xs font-semibold text-ink">Request Only</p>
              <p className="text-[10px] text-muted">Approve all clients</p>
            </div>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-baseline mb-1">
            <p className="text-xs font-bold leading-4 text-ink">Service Radius</p>
            <span className="text-[10px] font-semibold text-muted">{radiusKm} km</span>
          </div>
          <input
            type="range"
            min={1}
            max={50}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="w-full accent-ink"
          />
        </div>

        <div>
          <div className="flex justify-between items-baseline mb-1">
            <p className="text-xs font-bold leading-4 text-ink">Buffer Time</p>
            <span className="text-[10px] font-semibold text-muted">{bufferMin} min</span>
          </div>
          <input
            type="range"
            min={0}
            max={60}
            value={bufferMin}
            onChange={(e) => setBufferMin(Number(e.target.value))}
            className="w-full mb-2 accent-ink"
          />
          <div className="flex gap-2">
            {bufferPresets.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setBufferMin(m)}
                className={`px-3 py-1 rounded-pill text-xs font-semibold ${
                  bufferMin === m ? 'bg-ink text-white' : 'bg-surface text-ink'
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
          <p className="text-[10px] font-medium leading-[14px] text-muted mt-2">
            Setting a 15-minute buffer helps you handle travel time or clean-up without running
            late for the next client.
          </p>
        </div>

        {liveMissing.length > 0 && (
          <div className="rounded-[12px] border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700 mb-1">Missing before you can finish:</p>
            <ul className="text-xs text-red-600 space-y-1">
              {liveMissing.map((m) => (
                <li key={m.key}>
                  <button
                    type="button"
                    onClick={() => setStep(m.step)}
                    className="underline underline-offset-2 decoration-red-300 hover:decoration-red-600"
                  >
                    {m.label} — tap to fix
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {missing.length > 0 && liveMissing.length === 0 && (
          <div className="rounded-[12px] border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700 mb-1">Server rejected the submission:</p>
            <ul className="text-xs text-red-600 list-disc pl-4 space-y-0.5">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          disabled={saving || servicesCount === null || liveMissing.length > 0}
          onClick={handleFinishSetup}
          className="w-full bg-ink text-white rounded-pill px-9 py-[18px] text-sm font-semibold leading-5 text-center disabled:opacity-50"
        >
          {saving
            ? 'Finishing…'
            : servicesCount === null
            ? 'Checking your setup…'
            : liveMissing.length > 0
            ? `Complete ${liveMissing.length} more step${liveMissing.length > 1 ? 's' : ''} to finish`
            : 'Finish Setup'}
        </button>
      </div>
    </div>
  );
}
