import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, ShieldAlert, CheckCircle2, FileText, Info, Image as ImageIcon } from 'lucide-react';
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

// Covers both the "pending review" state (onboarding_completed=true,
// is_verified=false) and the "approved" state (is_verified=true) using
// real data from GET /api/barber/status + GET /api/barber/verification/documents.
export default function BarberPendingVerification() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isVerified, setIsVerified] = useState<boolean>(!!user?.is_verified);
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
          if (!cancelled) setIsVerified(!!status.is_verified);
        }
        if (docsRes.ok) {
          const docBody = await docsRes.json();
          if (!cancelled) setDocs(docBody);
        }
      } catch {
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
  const rows = ['drivers_license', 'passport', 'birth_certificate'];

  // ------------------------------------------------------------------
  // Approved state (Figma 1:750)
  // ------------------------------------------------------------------
  if (isVerified) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="flex items-center gap-2 px-5 py-4">
          <button type="button" onClick={() => navigate('/barber/jobs')} className="shrink-0 -ml-1 p-1">
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
                    {user?.full_name || 'Your profile'}
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
            onClick={() => navigate('/barber/profile')}
            className="w-full bg-ink text-white rounded-pill px-9 py-[18px] text-sm font-semibold leading-5 text-center"
          >
            View Profile
          </button>
          <button
            type="button"
            onClick={() => navigate('/barber/jobs')}
            className="w-full rounded-pill px-9 py-[18px] text-xs font-semibold leading-5 text-center text-muted"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Pending state (Figma 1:665)
  // ------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex items-center gap-2 px-5 py-4">
        <button type="button" onClick={() => navigate('/barber/jobs')} className="shrink-0 -ml-1 p-1">
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
      <div className="px-5 flex flex-col gap-3">
        {rows.map((key) => {
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

      {/* Info card (Figma 1:740) */}
      <div className="px-5 py-4 mt-2">
        <div className="bg-[#f4f5f8] rounded-[12px] p-4 flex gap-3 items-start">
          <div className="size-10 bg-white border border-[#e5e7eb] rounded-pill flex items-center justify-center shrink-0">
            <Info className="w-5 h-5 text-ink" />
          </div>
          <p className="text-xs font-medium leading-4 text-muted max-w-[264px]">
            Verification helps customers trust your profile and can improve booking conversion.
          </p>
        </div>
      </div>

      <div className="flex-1" />
      <div className="px-5 pb-5 pt-2 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => navigate('/barber/jobs')}
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
