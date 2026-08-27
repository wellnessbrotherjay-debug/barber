import React, { useEffect, useState } from 'react';
import { Caption, NoteCard } from '../../components/ScreenPieces';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Globe, Zap, Smartphone, Clock, Info } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '@/lib/api';

// index = day_of_week per barber_schedule schema (0=Sunday .. 6=Saturday)
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const BUFFER_OPTIONS = ['5m', '15m', '30m', '45m'];

// What the screen has loaded from the server. Only the fields the API actually
// returned are present, so the defaults above survive a partial response.
interface SavedSettings {
  online?: boolean;
  bookingMode?: 'instant' | 'request';
  radius?: number;
  buffer?: string;
  days?: boolean[];
  startTime?: string;
  endTime?: string;
}

// The two network conversations are kept out of the component itself so that
// the component reads as a screen and not as an API client, and so neither the
// loading nor the saving conversation has to be read to understand the other.
async function fetchSavedSettings(): Promise<SavedSettings> {
  const settings: SavedSettings = {};
  const [profileRes, scheduleRes] = await Promise.all([
    authFetch('/api/barber/profile'),
    authFetch('/api/barber/schedule'),
  ]);
  if (profileRes.ok) {
    const p = await profileRes.json();
    settings.online = !!p.is_online;
    if (p.booking_mode === 'instant') settings.bookingMode = 'instant';
    else if (p.booking_mode === 'request_only') settings.bookingMode = 'request';
    if (p.service_radius_km != null) settings.radius = Number(p.service_radius_km);
    if (p.buffer_minutes != null) settings.buffer = `${Number(p.buffer_minutes)}m`;
  }
  if (scheduleRes.ok) {
    const rows = await scheduleRes.json();
    if (Array.isArray(rows) && rows.length > 0) {
      const days = [false, false, false, false, false, false, false];
      for (const r of rows) {
        const i = Number(r.day_of_week);
        if (i >= 0 && i < 7) days[i] = !!r.is_available;
      }
      settings.days = days;
      const sample = rows.find((r: any) => r.is_available) || rows[0];
      if (sample?.start_time) settings.startTime = String(sample.start_time).slice(0, 5);
      if (sample?.end_time) settings.endTime = String(sample.end_time).slice(0, 5);
    }
  }
  return settings;
}

async function saveSettings(args: {
  activeDays: boolean[];
  startTime: string;
  endTime: string;
  bookingMode: 'instant' | 'request';
  radius: number;
  buffer: string;
  online: boolean;
}) {
  const schedule = args.activeDays.map((available, i) => ({
    day_of_week: i,
    start_time: args.startTime,
    end_time: args.endTime,
    is_available: available,
  }));
  const response = await authFetch('/api/barber/schedule', {
    method: 'PUT',
    body: JSON.stringify({ schedule }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Failed to save availability: ${response.status}`);

  // Booking mode / radius / buffer / online live on barber_profiles.
  const profileResp = await authFetch('/api/barber/profile', {
    method: 'PUT',
    body: JSON.stringify({
      booking_mode: args.bookingMode === 'instant' ? 'instant' : 'request_only',
      service_radius_km: args.radius,
      buffer_minutes: Number(args.buffer.replace('m', '')),
      is_online: args.online,
    }),
  });
  if (!profileResp.ok) {
    const b = await profileResp.json().catch(() => ({}));
    throw new Error(b.error || `Failed to save booking settings: ${profileResp.status}`);
  }
}

// The screen is a stack of independent settings. Each one below is its own
// component because they have nothing to do with each other beyond sitting on
// the same page: a change to the hours picker should not require reading past
// the radius slider to find it.

function OnlineStatusCard({ online, onToggle }: { online: boolean; onToggle: () => void }) {
  return (
    <div className="px-5 py-4">
      <div className="bg-[#fafafa] rounded-[12px] p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-[8px] size-[38px] flex items-center justify-center">
            <Globe className="w-4 h-4 text-[#1c1b1f]" strokeWidth={1.8} />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[14px] leading-5 font-semibold text-[#1c1b1f]">
              Status: {online ? 'Online' : 'Offline'}
            </p>
            <p className="text-[12px] leading-4 font-semibold text-[#a09cab]">
              {online ? 'You are visible to clients' : 'You are currently hidden'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="relative h-5 w-8 shrink-0"
          aria-label="Toggle online status"
        >
          <div className={`absolute top-[2px] left-0 h-4 w-[30px] rounded-full ${online ? 'bg-[#1c1b1f]' : 'bg-[#c7c7c7]'}`} />
          <div
            className={`absolute top-0 size-5 rounded-full bg-white border-[0.9px] transition-transform ${
              online ? 'border-[#1c1b1f] translate-x-[10px]' : 'border-[#c7c7c7] translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
}

function WorkingHoursSection({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
}: {
  startTime: string;
  endTime: string;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
}) {
  return (
    <div className="px-5 py-4 flex flex-col gap-4">
      <h2 className="text-[18px] leading-6 font-semibold text-[#1c1b1f]">Working Hours</h2>
      <div className="bg-[#fafafa] rounded-[12px] p-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex flex-col gap-1">
            <p className="text-[12px] leading-4 font-bold text-[#1c1b1f]">Start Time</p>
            <label className="bg-white border border-[#e5e7eb] rounded-[8px] p-3 flex items-center justify-between">
              <input
                type="time"
                value={startTime}
                onChange={(e) => onStartTimeChange(e.target.value)}
                className="text-[12px] leading-4 font-medium text-[#848992] bg-transparent outline-none w-full"
              />
              <Clock className="w-4 h-4 text-[#848992] shrink-0" strokeWidth={1.8} />
            </label>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <p className="text-[12px] leading-4 font-bold text-[#1c1b1f]">End Time</p>
            <label className="bg-white border border-[#e5e7eb] rounded-[8px] p-3 flex items-center justify-between">
              <input
                type="time"
                value={endTime}
                onChange={(e) => onEndTimeChange(e.target.value)}
                className="text-[12px] leading-4 font-medium text-[#848992] bg-transparent outline-none w-full"
              />
              <Clock className="w-4 h-4 text-[#848992] shrink-0" strokeWidth={1.8} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActiveDaysSection({
  activeDays,
  onToggleDay,
}: {
  activeDays: boolean[];
  onToggleDay: (index: number) => void;
}) {
  return (
    <div className="px-5 py-4 flex flex-col gap-4">
      <h2 className="text-[18px] leading-6 font-semibold text-[#1c1b1f]">Active Days</h2>
      <div className="flex items-center justify-between">
        {DAY_LETTERS.map((letter, i) => {
          const isActive = activeDays[i];
          return (
            <button
              key={`${letter}-${i}`}
              type="button"
              onClick={() => onToggleDay(i)}
              className={`size-[42px] rounded-full flex items-center justify-center text-[12px] leading-4 font-semibold ${
                isActive ? 'bg-[#1c1b1f] text-white' : 'bg-white border border-[#e5e7eb] text-[#a4a9b2]'
              }`}
            >
              {letter}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BookingModeSection({
  bookingMode,
  onSelect,
}: {
  bookingMode: 'instant' | 'request';
  onSelect: (mode: 'instant' | 'request') => void;
}) {
  return (
    <div className="px-5 py-4 flex flex-col gap-4">
      <h2 className="text-[18px] leading-6 font-semibold text-[#1c1b1f]">Booking Mode</h2>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => onSelect('instant')}
          className={`flex-1 rounded-[12px] p-3 flex flex-col gap-3 items-start text-left ${
            bookingMode === 'instant' ? 'bg-[#1c1b1f]' : 'bg-[#fafafa]'
          }`}
        >
          <div className="bg-white rounded-[8px] size-[38px] flex items-center justify-center">
            <Zap className="w-4 h-4 text-[#1c1b1f]" strokeWidth={1.8} fill="currentColor" />
          </div>
          <div className="flex flex-col gap-1">
            <p className={`text-[14px] leading-5 font-semibold ${bookingMode === 'instant' ? 'text-white' : 'text-black'}`}>
              Instant
            </p>
            <p className={`text-[10px] leading-[14px] font-medium ${bookingMode === 'instant' ? 'text-white' : 'text-[#a09cab]'}`}>
              Booking Confirmed
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onSelect('request')}
          className={`flex-1 rounded-[12px] p-3 flex flex-col gap-3 items-start text-left ${
            bookingMode === 'request' ? 'bg-[#1c1b1f]' : 'bg-[#fafafa]'
          }`}
        >
          <div className="bg-white rounded-[8px] size-[38px] flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-[#1c1b1f]" strokeWidth={1.8} />
          </div>
          <div className="flex flex-col gap-1">
            <p className={`text-[14px] leading-5 font-semibold ${bookingMode === 'request' ? 'text-white' : 'text-black'}`}>
              Request Only
            </p>
            <p className={`text-[10px] leading-[14px] font-medium ${bookingMode === 'request' ? 'text-white' : 'text-[#a09cab]'}`}>
              Approve all clients.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

function ServiceRadiusSection({
  radius,
  onRadiusChange,
}: {
  radius: number;
  onRadiusChange: (value: number) => void;
}) {
  return (
    <div className="px-5 py-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-[14px] leading-5 font-semibold text-black">Service Radius</p>
          <Caption>How far are you willing to travel?</Caption>
        </div>
        <p className="text-[18px] leading-6 font-bold text-[#1c1b1f]">{radius} km</p>
      </div>
      <div className="flex flex-col gap-1">
        <input
          type="range"
          min={1}
          max={50}
          value={radius}
          onChange={(e) => onRadiusChange(Number(e.target.value))}
          className="w-full h-2 rounded-full bg-[#f6f6f6] appearance-none accent-[#1c1b1f]"
        />
        <div className="flex items-center justify-between text-[10px] leading-[14px] font-medium text-[#a09cab]">
          <span>1 KM</span>
          <span>50 KM</span>
        </div>
      </div>
    </div>
  );
}

function BufferTimeSection({
  buffer,
  onSelect,
}: {
  buffer: string;
  onSelect: (option: string) => void;
}) {
  return (
    <div className="px-5 py-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-[14px] leading-5 font-semibold text-black">Buffer Time</p>
          <Caption>Rest time between appointments.</Caption>
        </div>
        <p className="text-[18px] leading-6 font-bold text-[#1c1b1f]">{buffer.replace('m', ' mins')}</p>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex gap-[9px]">
          {BUFFER_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onSelect(opt)}
              className={`flex-1 rounded-[8px] px-3 py-2.5 text-[12px] leading-4 font-semibold ${
                buffer === opt ? 'bg-[#1c1b1f] text-white' : 'border-[0.75px] border-[#d2dbe9] text-[#514e59]'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AvailabilityHeader({ onBack }: { onBack: () => void }) {
  return (
    <div className="px-5 pt-14 pb-4 flex items-center gap-2">
      <button type="button" onClick={onBack} className="-ml-1 p-0.5">
        <ChevronLeft className="w-5 h-5 text-[#1c1b1f]" />
      </button>
      <div className="flex flex-col gap-1">
        <Caption>Step 7 of 7</Caption>
        <h1 className="text-[18px] leading-6 font-bold text-[#1c1b1f]">Availability</h1>
      </div>
    </div>
  );
}

function BufferAdviceCard() {
  return (
    <div className="px-5 py-4">
      <NoteCard>
        <Info className="w-6 h-6 text-[#a09cab] shrink-0" strokeWidth={1.6} />
        <Caption>
          Setting a 15-minute buffer helps you handle travel time or clean-up without running late for the next client.
        </Caption>
      </NoteCard>
    </div>
  );
}

function FinishSetupBar({ saving, onSave }: { saving: boolean; onSave: () => void }) {
  return (
    <div className="fixed bottom-[18px] left-1/2 -translate-x-1/2 w-full max-w-[393px] px-5 z-40">
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="w-full bg-[#1c1b1f] rounded-full py-[18px] text-[14px] leading-5 font-semibold text-white text-center disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Finish Setup'}
      </button>
    </div>
  );
}

export default function BarberAvailability() {
  const navigate = useNavigate();
  const [online, setOnline] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [activeDays, setActiveDays] = useState<boolean[]>([false, true, true, true, true, true, false]);
  const [bookingMode, setBookingMode] = useState<'instant' | 'request'>('instant');
  const [radius, setRadius] = useState(19);
  const [buffer, setBuffer] = useState('5m');
  const [saving, setSaving] = useState(false);

  // Load the persisted availability settings so these controls show what the
  // database actually holds instead of hard-coded defaults.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await fetchSavedSettings();
        if (cancelled) return;
        if (saved.online !== undefined) setOnline(saved.online);
        if (saved.bookingMode) setBookingMode(saved.bookingMode);
        if (saved.radius !== undefined) setRadius(saved.radius);
        if (saved.buffer) setBuffer(saved.buffer);
        if (saved.days) setActiveDays(saved.days);
        if (saved.startTime) setStartTime(saved.startTime);
        if (saved.endTime) setEndTime(saved.endTime);
      } catch (err) {
        console.error(`[BarberAvailability] loading saved availability failed:`, err);
        // keep defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Online/offline is persisted the moment it's toggled — it's a live
  // visibility switch, not a form field.
  const toggleOnline = async () => {
    const next = !online;
    setOnline(next);
    try {
      const response = await authFetch('/api/barber/online', {
        method: 'PATCH',
        body: JSON.stringify({ is_online: next }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `Failed: ${response.status}`);
      setOnline(!!body.is_online);
    } catch (err) {
      setOnline(!next);
      toast.error(`${err instanceof Error ? err.message : err}`);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings({ activeDays, startTime, endTime, bookingMode, radius, buffer, online });
      toast.success('Availability saved');
      navigate(-1);
    } catch (err) {
      toast.error(`${err instanceof Error ? err.message : err}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-28">
      {/* Header */}
      <AvailabilityHeader onBack={() => navigate(-1)} />

      {/* Status card */}
      <OnlineStatusCard online={online} onToggle={toggleOnline} />

      {/* Working Hours */}
      <WorkingHoursSection
        startTime={startTime}
        endTime={endTime}
        onStartTimeChange={setStartTime}
        onEndTimeChange={setEndTime}
      />

      {/* Active Days */}
      <ActiveDaysSection
        activeDays={activeDays}
        onToggleDay={(i) => setActiveDays((prev) => prev.map((v, idx) => (idx === i ? !v : v)))}
      />

      {/* Booking Mode */}
      <BookingModeSection bookingMode={bookingMode} onSelect={setBookingMode} />

      {/* Service Radius */}
      <ServiceRadiusSection radius={radius} onRadiusChange={setRadius} />

      {/* Buffer Time */}
      <BufferTimeSection buffer={buffer} onSelect={setBuffer} />

      {/* Info card */}
      <BufferAdviceCard />

      {/* Finish Setup */}
      <FinishSetupBar saving={saving} onSave={handleSave} />
    </div>
  );
}
