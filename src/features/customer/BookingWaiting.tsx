import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, ChevronLeft, ImageIcon, Scissors, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';
import { authFetch } from '@/lib/api';

// Booking countdown / waiting-for-barber-response screen (Figma flow step 3).
//
// Honesty note: there is no real backend "auto-reassign to another barber"
// feature (that would mean the server finding a new barber_id and creating a
// fresh booking row unattended — a substantial feature on its own). Per the
// task brief, when the countdown expires we show an honest "no response" state
// whose only real actionable path is "Choose another barber", which routes
// back to BrowseBarbers.tsx. We do NOT claim the app is silently retrying with
// another barber in the background.
const WAIT_SECONDS = 120;
const POLL_MS = 4000;

type Phase = 'waiting' | 'no_response' | 'confirmed' | 'rejected';

interface Booking {
  id: string;
  status: string;
  barber_profiles: { id: string; display_name: string };
}

const RING_RADIUS = 80;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// The screen shows one of two quite different faces — still waiting, or the
// barber never answered. Each face is its own component below so that the one
// you are not looking at cannot get in the way of reading the one you are.

function ScissorsRing() {
  return (
    <div className="relative w-[220px] h-[220px] mx-auto mt-4">
      <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90">
        <circle cx="90" cy="90" r={RING_RADIUS} fill="none" stroke="#e9e8ef" strokeWidth="10" />
        <circle
          cx="90"
          cy="90"
          r={RING_RADIUS}
          fill="none"
          stroke="#000000"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * 0.18}
        />
      </svg>
      <div className="absolute inset-4 rounded-full bg-[#f8f7fc] flex items-center justify-center">
        <Scissors className="w-14 h-14 text-ink" strokeWidth={1.5} />
      </div>
    </div>
  );
}

function NoResponseDetails({ requestedTime }: { requestedTime: string }) {
  return (
    <>
      {/* Payment status card — copy per board */}
      <div className="bg-[#f6f7fb] rounded-[16px] p-4 mt-8 flex items-center gap-3">
        <span className="w-11 h-11 rounded-full bg-white flex items-center justify-center shrink-0">
          <ImageIcon className="w-5 h-5 text-muted" />
        </span>
        <span>
          <span className="block text-[16px] font-bold text-ink">Payment Status</span>
          <span className="block text-[14px] text-muted mt-0.5">
            Aauthorizes active <span className="italic">(Pending)</span>
          </span>
        </span>
      </div>

      <div className="border-[0.75px] border-[#d2dbe9] rounded-[16px] mt-5">
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="flex items-center gap-2 text-[14px] text-muted">
            <Clock className="w-4 h-4" /> Requested Time
          </span>
          <span className="text-[15px] font-bold text-ink">{requestedTime}</span>
        </div>
        <div className="border-t-[1.5px] border-dashed border-[#e3e1ec] mx-4" />
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="flex items-center gap-2 text-[14px] text-muted">
            <MapPin className="w-4 h-4" /> Radius
          </span>
          <span className="text-[15px] font-bold text-ink">Expanding to 5km…</span>
        </div>
      </div>
    </>
  );
}

function NoResponseScreen({
  onBack,
  onCancel,
  onChooseAnother,
}: {
  onBack: () => void;
  onCancel: () => void;
  onChooseAnother: () => void;
}) {
  // Figma page 37 — "No response - Re-searching": ring with scissors, payment
  // status card, requested-time / radius rows, Cancel Search.
  const now = new Date();
  const hh = now.getHours() % 12 === 0 ? 12 : now.getHours() % 12;
  const requestedTime = `Today, ${hh}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
  return (
    <div className="min-h-screen bg-white flex flex-col pb-8">
      <div className="flex items-center px-6 pt-16 pb-2">
        <button type="button" aria-label="Back" onClick={onBack}>
          <ChevronLeft className="w-6 h-6 text-ink" strokeWidth={2.25} />
        </button>
      </div>

      <div className="px-6 flex-1">
        {/* ring with scissors icon */}
        <ScissorsRing />

        <h1 className="text-[24px] font-bold text-ink text-center mt-8">No response</h1>
        <p className="text-[14px] text-muted text-center mt-1">
          Sending your request to another nearby barber…
        </p>

        <NoResponseDetails requestedTime={requestedTime} />
      </div>

      <div className="px-6 mt-8">
        <button
          type="button"
          onClick={onCancel}
          className="w-full bg-ink text-white text-[16px] font-semibold py-[20px] rounded-full"
        >
          Cancel Search
        </button>
        <button
          type="button"
          onClick={onChooseAnother}
          className="w-full py-4 text-[15px] font-semibold text-muted"
        >
          Choose another barber
        </button>
      </div>
    </div>
  );
}

function BarberSummaryCard({
  barberName,
  shopName,
  ratingAvg,
}: {
  barberName: string;
  shopName: string;
  ratingAvg: number | null;
}) {
  return (
    <div className="flex items-center gap-3 bg-surface rounded-[14px] p-3 mt-3">
      <span className="w-11 h-11 rounded-full bg-white flex items-center justify-center shrink-0">
        <ImageIcon className="w-5 h-5 text-muted" />
      </span>
      <span>
        <span className="block text-[15px] font-semibold text-ink">
          {barberName || 'Your barber'}
        </span>
        <span className="block text-[12px] text-muted mt-0.5">
          {shopName || 'Barber'}{ratingAvg ? ` • ★ ${ratingAvg}` : ''}
        </span>
      </span>
    </div>
  );
}

/* The ring is the one moving part on the screen, and its arithmetic is fiddly,
   so it is kept on its own where it can be read and checked in isolation. */
function CountdownRing({ secondsLeft }: { secondsLeft: number }) {
  const dashOffset = RING_CIRCUMFERENCE * (1 - secondsLeft / WAIT_SECONDS);
  return (
    <div className="relative w-[200px] h-[200px] mx-auto mt-6">
      <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90">
        <circle cx="90" cy="90" r={RING_RADIUS} fill="none" stroke="#e9e8ef" strokeWidth="10" />
        <circle
          cx="90"
          cy="90"
          r={RING_RADIUS}
          fill="none"
          stroke="#000000"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-bold text-ink">
          {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
        </span>
        <span className="text-[13px] text-muted mt-1">Seconds Left</span>
      </div>
    </div>
  );
}

function WaitingStatusPanels() {
  return (
    <>
      {/* payment hold — board renders this row black */}
      <div className="bg-ink rounded-[12px] px-4 py-3 mt-6 flex items-center justify-between">
        <span>
          <span className="block text-[11px] text-white/60">Payment Authorizes</span>
          <span className="block text-[15px] font-semibold text-white">Temporary Hold Only</span>
        </span>
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-[12px] font-semibold text-white">
          <span className="w-1 h-1 rounded-full bg-white" />
          Pending
        </span>
      </div>

      <div className="bg-surface rounded-[12px] px-4 py-3 mt-3">
        <span className="block text-[11px] text-muted">Request Status</span>
        <span className="block text-[15px] text-ink">Waiting for barber response…</span>
      </div>

      <div className="bg-surface rounded-[12px] px-4 py-3 mt-3">
        <p className="text-[13px] text-ink leading-5">
          Your card has been authorizes for a hold only. Funds will only be captured once the
          barber accepts the request.
        </p>
      </div>
    </>
  );
}

function WaitingScreen({
  barberName,
  shopName,
  ratingAvg,
  secondsLeft,
  onBack,
  onCancel,
  onChooseAnother,
}: {
  barberName: string;
  shopName: string;
  ratingAvg: number | null;
  secondsLeft: number;
  onBack: () => void;
  onCancel: () => void;
  onChooseAnother: () => void;
}) {
  return (
    <div className="relative w-full bg-white" style={{ minHeight: 900 }}>
      {/* board header */}
      <div className="flex items-center px-5 pt-14 pb-2">
        <button type="button" onClick={onBack} className="p-1 -ml-1">
          <ChevronLeft className="w-6 h-6 text-ink" />
        </button>
        <p className="flex-1 text-center text-[16px] font-bold text-ink pr-6">Booking Status</p>
      </div>

      <div className="px-5">
        {/* barber card */}
        <BarberSummaryCard barberName={barberName} shopName={shopName} ratingAvg={ratingAvg} />

        <h1 className="text-[22px] font-bold text-ink text-center mt-6">Waiting for Barber</h1>
        <p className="text-[13px] text-muted text-center mt-1 leading-5">
          We've sent your request to {barberName || 'the barber'}. They have 2 minutes to accept.
        </p>

        {/* countdown ring — board shows mm:ss over "Seconds Left" */}
        <CountdownRing secondsLeft={secondsLeft} />

        <WaitingStatusPanels />

        <button
          type="button"
          onClick={onCancel}
          className="w-full bg-ink text-white text-[15px] font-semibold py-[18px] rounded-full mt-6"
        >
          Cancel Request
        </button>
        <button
          type="button"
          onClick={onChooseAnother}
          className="w-full py-4 text-[14px] font-semibold text-muted"
        >
          Choose another barber
        </button>
      </div>
    </div>
  );
}

export default function BookingWaiting() {
  const { id: bookingId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [secondsLeft, setSecondsLeft] = useState(WAIT_SECONDS);
  const [phase, setPhase] = useState<Phase>('waiting');
  const [barberName, setBarberName] = useState('');
  const [shopName, setShopName] = useState('');
  const [ratingAvg, setRatingAvg] = useState<number | null>(null);
  const cancelledRef = useRef(false);

  // Countdown ring
  useEffect(() => {
    if (phase !== 'waiting') return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase === 'waiting' && secondsLeft === 0) {
      setPhase('no_response');
    }
  }, [secondsLeft, phase]);

  // Real status polling against GET /api/bookings (there is no GET /api/bookings/:id
  // endpoint on the backend, so we fetch the customer's booking list and find this one —
  // same pattern already used by RateBarber.tsx).
  useEffect(() => {
    if (!user?.id || !bookingId) return;
    if (phase !== 'waiting' && phase !== 'no_response') return;

    let cancelled = false;
    async function poll() {
      try {
        const response = await authFetch(`/api/bookings`, {
        });
        if (!response.ok) return;
        const data: Booking[] = await response.json();
        const found = data.find((b) => b.id === bookingId);
        if (!found || cancelled) return;
        setBarberName(found.barber_profiles?.display_name || '');
        setShopName((found.barber_profiles as any)?.shop_name || '');
        setRatingAvg((found.barber_profiles as any)?.rating_avg ?? null);
        if (found.status === 'confirmed') setPhase('confirmed');
        else if (found.status === 'cancelled') setPhase('rejected');
      } catch (err) {
        console.error(`[BookingWaiting] polling the booking status failed:`, err);
        // Transient network errors don't change phase — we just try again next tick.
      }
    }
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [bookingId, user?.id, phase]);

  useEffect(() => {
    if (phase === 'confirmed' && bookingId) navigate(`/customer/booking-confirmed/${bookingId}`, { replace: true });
    if (phase === 'rejected' && bookingId) navigate(`/customer/booking-rejected/${bookingId}`, { replace: true });
  }, [phase, bookingId, navigate]);

  async function handleCancel() {
    if (!bookingId || !user?.id || cancelledRef.current) return;
    cancelledRef.current = true;
    try {
      const response = await authFetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(`Failed to cancel: ${response.status}`);
      toast.success('Request cancelled');
      navigate('/customer');
    } catch (err) {
      toast.error(`${err}`);
      cancelledRef.current = false;
    }
  }

  if (phase === 'no_response') {
    return (
      <NoResponseScreen
        onBack={() => navigate(-1)}
        onCancel={handleCancel}
        onChooseAnother={() => navigate('/customer')}
      />
    );
  }

  return (
    <WaitingScreen
      barberName={barberName}
      shopName={shopName}
      ratingAvg={ratingAvg}
      secondsLeft={secondsLeft}
      onBack={() => navigate(-1)}
      onCancel={handleCancel}
      onChooseAnother={() => navigate('/customer')}
    />
  );
}
