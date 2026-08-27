import React, { useEffect, useState } from 'react';
import { NoteCard } from '../../components/ScreenPieces';
import { useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, ShieldAlert, CheckCircle2, FileText, Info, Image as ImageIcon, CircleX } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { authFetch } from '@/lib/api';

const DOC_LABELS: Record<string, string> = {
  drivers_license: "Driver's Licence",
  passport: 'Passport',
  birth_certificate: 'Birth Certificate (Optional)',
  business_registration: 'Business Registration',
};

interface SubmittedDoc {
  document_type: string;
  submitted_at: string;
}

/** Grey status pill with leading dot (Figma 1:688) */
function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 bg-[#f8f8f8] rounded-pill px-3 py-1.5">
      <span className="size-[3px] rounded-full bg-[#514e59]" />
      <span className="text-[10px] leading-3 font-medium text-[#514e59]">{label}</span>
    </span>
  );
}

// The three document rows the pending screen always lists, in board order.
const ROWS = ['drivers_license', 'passport', 'birth_certificate'];

// ------------------------------------------------------------------
// Approved state (Figma 1:750)
// ------------------------------------------------------------------
// This is a whole separate frame on the board rather than a variation of the
// pending one — different artwork, different copy, different buttons — so it
// is a component of its own instead of a branch buried inside the screen.
function ApprovedState({
  userName,
  onBack,
  onViewProfile,
  onBackToDashboard,
}: {
  userName: string;
  onBack: () => void;
  onViewProfile: () => void;
  onBackToDashboard: () => void;
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex items-center gap-2 px-5 py-4">
        <button type="button" onClick={onBack} className="shrink-0 -ml-1 p-1">
          <ArrowLeft className="w-5 h-5 text-ink" />
        </button>
        <h1 className="text-lg font-bold leading-6 text-ink">Verification Status</h1>
      </div>

      <div className="px-5 py-4">
        <div className="bg-white border-[0.75px] border-[#d2dbe9] rounded-[12px] p-3 flex flex-col gap-3 items-center">
          <div className="size-[100px] bg-surface rounded-[8px] flex items-center justify-center">
            <ShieldCheck className="w-[50px] h-[50px] text-ink" />
          </div>
          <StatusPill label="Approved" />
          <div className="flex flex-col gap-1 items-center text-center">
            <h2 className="text-2xl font-bold text-ink max-w-[303px]">You are now Verified</h2>
            <p className="text-xs font-medium leading-4 text-muted max-w-[304px]">
              Your verification is complete. A Verified badge is now visible on your barber profile.
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4">
        <p className="text-lg font-semibold leading-6 text-ink">Profile badge</p>
      </div>

      {/* Profile badge card (Figma 1:796) */}
      <div className="px-5">
        <div className="bg-white border-[0.75px] border-[#d2dbe9] rounded-[12px] p-3 flex flex-col gap-3">
          <div className="flex items-start justify-between w-full">
            <div className="flex gap-3 items-start">
              <div className="size-12 bg-surface rounded-[8px] flex items-center justify-center">
                <ImageIcon className="w-[22px] h-5 text-[#c9c6da]" />
              </div>
              <div className="flex flex-col gap-1 items-start">
                <p className="text-sm font-semibold leading-5 text-ink">
                  {userName}
                </p>
                <StatusPill label="Master Barber & Stylist" />
              </div>
            </div>
            <div className="flex flex-col gap-1 items-center justify-center">
              <p className="text-sm font-bold leading-5 text-ink text-right">★ New</p>
              <p className="text-[10px] font-semibold leading-[14px] text-muted whitespace-nowrap">
                (no reviews yet)
              </p>
            </div>
          </div>
          <div className="h-[2px] w-full bg-[#f6f6f6] rounded-pill" />
          <div className="flex gap-2 items-start">
            <div className="size-8 bg-[#f4f5f8] border border-[#e5e7eb] rounded-pill flex items-center justify-center shrink-0">
              <Info className="w-4 h-4 text-ink" />
            </div>
            <p className="text-xs font-medium leading-4 text-muted max-w-[264px]">
              Customers will see this badge on your profile and listing card to build trust and
              increase bookings.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1" />
      <div className="px-5 pb-5 pt-2 flex flex-col gap-1">
        <button
          type="button"
          onClick={onViewProfile}
          className="w-full bg-ink text-white rounded-pill px-9 py-[18px] text-sm font-semibold leading-5 text-center"
        >
          View Profile
        </button>
        <button
          type="button"
          onClick={onBackToDashboard}
          className="w-full rounded-pill px-9 py-[18px] text-xs font-semibold leading-5 text-center text-muted"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// In-progress state (Figma page 28 — "Review in Progress")
// Shown when the API reports an active review, or via ?state=in-progress.
// ------------------------------------------------------------------
// Its own component for the same reason as the approved state: the board draws
// it as a separate frame, not as a tweak to another one.
function ReviewInProgressState({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex items-center justify-center gap-1.5 px-5 py-4">
        <button type="button" aria-label="Back" onClick={onBack} className="w-6 h-6 flex items-center justify-center shrink-0">
          <ArrowLeft className="w-5 h-5 text-ink" />
        </button>
        <h1 className="flex-1 text-center text-[16px] leading-6 font-bold text-ink">Verification Status</h1>
        <span className="w-6 h-6 shrink-0" />
      </div>

      <div className="px-5 pt-24 flex flex-col items-center text-center gap-6">
        <div className="w-[124px] h-[124px] bg-[#f2f1fa] rounded-[12px] flex items-center justify-center">
          <CircleX className="w-[46px] h-[46px] text-ink" strokeWidth={1.3} />
        </div>
        <div className="flex flex-col gap-2 items-center">
          <h2 className="text-[28px] leading-9 font-bold text-ink">Review in Progress</h2>
          <p className="text-[14px] leading-5 font-medium text-muted max-w-[330px]">
            Our team is currently reviewing your documents. This usually takes 24–48 hours.
          </p>
        </div>
      </div>

      {/* Estimated completion card — Figma page 28 */}
      <div className="px-5 pt-10">
        <div className="bg-white border-[0.75px] border-[#d2dbe9] rounded-[12px] px-4 py-5 flex items-center justify-between">
          <p className="text-[16px] leading-6 font-bold text-ink">Estimated completion:</p>
          <p className="text-[14px] leading-5 font-medium text-muted">Today by 5:00 PM</p>
        </div>
      </div>
    </div>
  );
}

// The list of submitted documents (Figma 1:711). Pulled out on its own because
// it is the only part of the pending screen that varies with the loaded data,
// so the rest of that screen reads as fixed layout.
function SubmittedDocumentRows({
  submittedTypes,
  loading,
}: {
  submittedTypes: Set<string>;
  loading: boolean;
}) {
  return (
    <div className="px-5 flex flex-col gap-3">
      {ROWS.map((key) => {
        const uploaded = submittedTypes.has(key);
        return (
          <div
            key={key}
            className="bg-white border-[0.75px] border-[#d2dbe9] rounded-[12px] p-3 flex items-center justify-between"
          >
            <div className="flex gap-3 items-center">
              <div className="size-[38px] bg-surface-2 rounded-[8px] flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-ink" />
              </div>
              <div className="flex flex-col gap-1 items-start">
                <p className="text-[10px] font-medium leading-[14px] text-muted">{DOC_LABELS[key]}</p>
                <p className="text-xs font-bold leading-4 text-ink">
                  {loading ? '…' : uploaded ? 'Uploaded' : 'Not submitted'}
                </p>
              </div>
            </div>
            {uploaded && !loading && <CheckCircle2 className="w-6 h-6 text-ink" />}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------
// Pending state (Figma 1:665)
// ------------------------------------------------------------------
// The third frame on the board, kept beside its two siblings above so the
// screen's three faces are all visible at the same level.
function PendingState({
  submittedTypes,
  loading,
  onBack,
  onDone,
}: {
  submittedTypes: Set<string>;
  loading: boolean;
  onBack: () => void;
  onDone: () => void;
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex items-center gap-2 px-5 py-4">
        <button type="button" onClick={onBack} className="shrink-0 -ml-1 p-1">
          <ArrowLeft className="w-5 h-5 text-ink" />
        </button>
        <h1 className="text-lg font-bold leading-6 text-ink">Verification Status</h1>
      </div>

      <div className="px-5 py-4">
        <div className="bg-white border-[0.75px] border-[#d2dbe9] rounded-[12px] p-3 flex flex-col gap-3 items-center">
          <StatusPill label="Pending Review" />
          <div className="size-[100px] bg-surface rounded-[8px] flex items-center justify-center">
            <ShieldAlert className="w-[50px] h-[50px] text-ink" />
          </div>
          <div className="flex flex-col gap-1 items-center text-center">
            <h2 className="text-2xl font-bold text-ink max-w-[303px]">
              Your documents are under review
            </h2>
            <p className="text-xs font-medium leading-4 text-muted max-w-[304px]">
              Our team is reviewing your documents manually. We&rsquo;ll notify you once verification
              is complete.
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4">
        <p className="text-lg font-semibold leading-6 text-ink">Submitted documents</p>
      </div>

      {/* Document rows (Figma 1:711) */}
      <SubmittedDocumentRows submittedTypes={submittedTypes} loading={loading} />

      {/* Info card (Figma 1:740) */}
      <div className="px-5 py-4 mt-2">
        <NoteCard>
          <div className="size-10 bg-white border border-[#e5e7eb] rounded-pill flex items-center justify-center shrink-0">
            <Info className="w-5 h-5 text-ink" />
          </div>
          <p className="text-xs font-medium leading-4 text-muted max-w-[264px]">
            Verification helps customers trust your profile and can improve booking conversion.
          </p>
        </NoteCard>
      </div>

      <div className="flex-1" />
      <div className="px-5 pb-5 pt-2 flex flex-col gap-1">
        <button
          type="button"
          onClick={onDone}
          className="w-full bg-ink text-white rounded-pill px-9 py-[18px] text-sm font-semibold leading-5 text-center"
        >
          Done
        </button>
        <p className="w-full px-9 py-[18px] text-xs font-semibold leading-5 text-center text-muted">
          You can continue using the app while verification is in review.
        </p>
      </div>
    </div>
  );
}

// Covers both the "pending review" state (onboarding_completed=true,
// is_verified=false) and the "approved" state (is_verified=true) using
// real data from GET /api/barber/status + GET /api/barber/verification/documents.
export default function BarberPendingVerification() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const [isVerified, setIsVerified] = useState<boolean>(!!user?.is_verified);
  const [reviewInProgress, setReviewInProgress] = useState<boolean>(false);
  const [docs, setDocs] = useState<SubmittedDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [statusRes, docsRes] = await Promise.all([
          authFetch('/api/barber/status'),
          authFetch('/api/barber/verification/documents'),
        ]);
        if (statusRes.ok) {
          const status = await statusRes.json();
          if (!cancelled) {
            setIsVerified(!!status.is_verified);
            setReviewInProgress(!!status.review_in_progress);
          }
        }
        if (docsRes.ok) {
          const docBody = await docsRes.json();
          if (!cancelled) setDocs(docBody);
        }
      } catch (err) {
        console.error(`[BarberPendingVerification] checking verification status failed:`, err);
        // network hiccup — leave existing state, don't block the screen
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const submittedTypes = new Set(docs.map((d) => d.document_type));

  if (isVerified) {
    return (
      <ApprovedState
        userName={user?.full_name || 'Your profile'}
        onBack={() => navigate('/barber/jobs/incoming')}
        onViewProfile={() => navigate('/barber/profile')}
        onBackToDashboard={() => navigate('/barber/jobs/incoming')}
      />
    );
  }

  if (reviewInProgress || searchParams.get('state') === 'in-progress') {
    return <ReviewInProgressState onBack={() => navigate('/barber/jobs/incoming')} />;
  }

  return (
    <PendingState
      submittedTypes={submittedTypes}
      loading={loading}
      onBack={() => navigate('/barber/jobs/incoming')}
      onDone={() => navigate('/barber/jobs/incoming')}
    />
  );
}
