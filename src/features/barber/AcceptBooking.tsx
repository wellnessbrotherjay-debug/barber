import React, { useEffect, useState } from 'react';
import { AddressPinIcon, Caption, FieldValue, IconTile, PrimaryButton, QuietButton, SubduedLine } from '../../components/ScreenPieces';
import ScreenHeader from '../../components/ScreenHeader';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Scissors, Clock, Phone, Star, Calendar, MessageSquareMore, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchBarberJobs, type Job } from './BarberJobs';
import { authFetch } from '@/lib/api';

/* Booking accepted — Figma p51 */
// A whole separate frame on the board, reached only after the accept call
// succeeds, so it lives beside the screen rather than inside it.
function BookingAcceptedState({
  job,
  onBack,
  onViewLocation,
  onCancelBooking,
}: {
  job: Job;
  onBack: () => void;
  onViewLocation: () => void;
  onCancelBooking: () => void;
}) {
  const address = job.barber_profiles?.address_text;
  return (
    <div className="min-h-screen bg-white flex flex-col pb-8">
      <ScreenHeader title="Accept Booking" onBack={onBack} />

      <div className="flex flex-col items-center px-5 pt-6">
        <div className="w-[136px] h-[136px] rounded-[16px] bg-[#f2f1fa] flex items-center justify-center">
          <ImageIcon className="w-10 h-10 text-[#d4d2e3]" strokeWidth={1.6} />
        </div>
        <h1 className="mt-6 text-[28px] leading-9 font-bold text-[#1c1b1f]">Booking accepted</h1>
        <SubduedLine>Chat and call are now unlocked.</SubduedLine>
      </div>

      {/* Customer */}
      <div className="px-5 pt-8">
        <h2 className="text-[20px] leading-6 font-bold text-[#1c1b1f]">Customer</h2>
        <div className="mt-4 flex items-center gap-4 border-[0.75px] border-[#d2dbe9] rounded-[12px] p-4">
          <div className="w-14 h-14 rounded-[12px] bg-[#f2f1fa] flex items-center justify-center shrink-0">
            <ImageIcon className="w-6 h-6 text-[#d4d2e3]" strokeWidth={1.6} />
          </div>
          <div>
            <p className="text-[15px] leading-5 font-semibold text-[#1c1b1f]">{job.users?.full_name}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-[#1c1b1f] fill-[#1c1b1f]" />
              <p className="text-[12px] leading-4 font-medium text-[#514e59]">4.9 • 42 jobs completed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Job Summary */}
      <div className="px-5 pt-8">
        <h2 className="text-[20px] leading-6 font-bold text-[#1c1b1f]">Job Summary</h2>
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <IconTile>
              <Calendar className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.8} />
            </IconTile>
            <div>
              <p className="text-[14px] leading-5 font-semibold text-[#1c1b1f]">{job.services?.name}</p>
              <p className="text-[12px] leading-4 font-medium text-[#a09cab] mt-0.5">
                {job.booking_date} • {job.start_time}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <IconTile>
              <AddressPinIcon />
            </IconTile>
            <div>
              <p className="text-[14px] leading-5 font-semibold text-[#1c1b1f]">In-Person</p>
              {address && (
                <p className="text-[12px] leading-4 font-medium text-[#a09cab] mt-0.5">{address}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* View Job location */}
      <button
        type="button"
        onClick={onViewLocation}
        className="mx-5 mt-8 flex items-center justify-between"
      >
        <span className="text-[18px] leading-6 font-bold text-[#1c1b1f]">View Job location</span>
        <ChevronRight className="w-5 h-5 text-[#1c1b1f]" strokeWidth={2} />
      </button>

      <div className="px-5 pt-6">
        <div className="bg-[#f4f5f8] rounded-[12px] p-4">
          <p className="text-[13px] leading-5 font-medium text-[#a09cab]">
            Customer pays a small booking fee to unlock chat/call. Haircut is paid directly to the barber offline.
          </p>
        </div>
      </div>

      <div className="px-5 mt-auto pt-8 flex items-center gap-4">
        <button
          type="button"
          onClick={onCancelBooking}
          className="flex-1 bg-[#1c1b1f] rounded-full px-9 py-[18px] text-[16px] leading-5 font-semibold text-white text-center"
        >
          Cancel Booking
        </button>
        <button
          type="button"
          disabled
          title="Coming soon"
          aria-label="Call customer"
          className="w-[58px] h-[58px] rounded-full border-[0.75px] border-[#d2dbe9] flex items-center justify-center shrink-0 disabled:opacity-70"
        >
          <Phone className="w-5 h-5 text-[#a09cab]" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}

// The three facts the barber judges the request on. Its own piece so the
// loading, error and not-found lines above it stay legible next to it.
function JobSummaryCard({ job }: { job: Job }) {
  return (
    <div className="bg-[#fafafa] rounded-[16px] p-4 space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-[10px] bg-[#f2f1fa] flex items-center justify-center shrink-0">
          <ImageIcon className="w-5 h-5 text-[#d4d2e3]" strokeWidth={1.6} />
        </div>
        <div>
          <p className="text-[15px] leading-5 font-semibold text-[#1c1b1f]">Customer</p>
          <p className="text-[12px] leading-4 font-medium text-[#a09cab] mt-1">{job.users?.full_name}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="w-12 h-12 rounded-[10px] bg-white flex items-center justify-center shrink-0">
          <Scissors className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.8} />
        </span>
        <div>
          <Caption>Service</Caption>
          <FieldValue>{job.services?.name}</FieldValue>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="w-12 h-12 rounded-[10px] bg-white flex items-center justify-center shrink-0">
          <Clock className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.8} />
        </span>
        <div>
          <Caption>Time</Caption>
          <FieldValue>
            {job.booking_date} {job.start_time}
          </FieldValue>
        </div>
      </div>
    </div>
  );
}

// The note the customer left, with the stand-in line shown when there isn't
// one. A small block of its own so the decision buttons below it are the next
// thing you read.
function CustomerNotes({ notes }: { notes?: string | null }) {
  return (
    <div className="px-5 pt-8">
      <div className="flex items-center gap-2.5">
        <MessageSquareMore className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.8} />
        <h2 className="text-[20px] leading-6 font-bold text-[#1c1b1f]">Notes From Customer</h2>
      </div>
      <div className="mt-4 bg-[#f4f5f8] rounded-[12px] p-4">
        <p className="text-[13px] leading-5 font-medium text-[#1c1b1f]">
          {notes || 'Chat and call will unlock after acceptance.'}
        </p>
      </div>
    </div>
  );
}

// The footer call to action: accept, or go back. Extracted so the pair sits
// together at the end of the file as it does at the end of the screen.
function AcceptActions({
  canAccept,
  submitting,
  onAccept,
  onGoBack,
}: {
  canAccept: boolean;
  submitting: boolean;
  onAccept: () => void;
  onGoBack: () => void;
}) {
  return (
    <div className="px-5 mt-auto pt-8">
      <PrimaryButton type="button" onClick={onAccept} disabled={!canAccept || submitting}>
        {submitting ? 'Accepting…' : 'Accept'}
      </PrimaryButton>
      <QuietButton type="button" onClick={onGoBack}>
        Go back
      </QuietButton>
    </div>
  );
}

export default function AcceptBooking() {
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useAuthStore((s) => s.user);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

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
      } catch (err) {
        if (!cancelled) setError(`${err}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  async function handleAccept() {
    if (!id || !user?.id) return;
    try {
      setSubmitting(true);
      const response = await authFetch(`/api/bookings/${id}/accept`, {
        method: 'POST',
        headers: {
        },
      });
      if (!response.ok) throw new Error(`Failed to accept booking: ${response.status}`);
      toast.success('Booking accepted');
      setAccepted(true);
    } catch (err) {
      toast.error(`${err}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (accepted && job) {
    return (
      <BookingAcceptedState
        job={job}
        onBack={() => navigate('/barber/jobs/upcoming')}
        onViewLocation={() => navigate(`/barber/arriving/${job.id}`)}
        onCancelBooking={() => navigate(`/barber/cancel/${job.id}`)}
      />
    );
  }

  /* Accept booking? — Figma p50 */
  return (
    <div className="min-h-screen bg-white flex flex-col pb-8">
      <ScreenHeader title="Accept booking?" />

      <div className="px-5 pt-4">
        {loading && <p className="text-sm text-[#a09cab]">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && !job && <p className="text-sm text-[#a09cab]">Booking not found.</p>}

        {job && <JobSummaryCard job={job} />}
      </div>

      {/* Notes From Customer */}
      <CustomerNotes notes={job?.notes} />

      <AcceptActions
        canAccept={!!job}
        submitting={submitting}
        onAccept={handleAccept}
        onGoBack={() => navigate(-1)}
      />
    </div>
  );
}
