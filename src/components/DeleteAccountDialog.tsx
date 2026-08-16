import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { authFetch, clearToken } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

// Account deletion — App Store Review Guideline 5.1.1(v) requires that an app
// which supports account creation also lets the user initiate deletion of that
// account from inside the app.
//
// Shared by the customer (EditProfile) and barber (BarberProfileEdit) profile
// screens. Visual language is the same Figma-derived token set used by those
// screens (ink #1c1b1f, muted #a09cab, surface #f2f1fa, 0.75px #d2dbe9 card
// borders, pill buttons) with red reserved for the destructive action only.

const REMOVED = [
  'Your profile and login details',
  'Your photos and uploaded documents',
  'Your services, schedule and availability',
  'Your booking history, reviews and payment records',
];

export function DeleteAccountRow({ label = 'Delete Account' }: { label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-[16px] border-[0.75px] border-[#d2dbe9] bg-white px-4 py-[16px] flex items-center gap-3 text-left"
      >
        <Trash2 className="w-5 h-5 text-[#d92d20]" strokeWidth={1.75} />
        <span className="flex-1 text-[15px] font-semibold text-[#d92d20]">{label}</span>
      </button>
      {open && <DeleteAccountDialog onClose={() => setOpen(false)} />}
    </>
  );
}

export default function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const armed = confirmText.trim().toUpperCase() === 'DELETE';

  const handleDelete = async () => {
    if (!armed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch('/api/account', {
        method: 'DELETE',
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not delete your account. Please try again.');
        setBusy(false);
        return;
      }
      logout();
      clearToken();
      navigate('/welcome', { replace: true });
    } catch {
      setError('Network error. Please check your connection and try again.');
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-6 sm:pb-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
    >
      <div className="w-full max-w-[380px] rounded-[24px] bg-white p-6">
        <div className="w-12 h-12 rounded-[16px] bg-[#f2f1fa] flex items-center justify-center">
          <Trash2 className="w-6 h-6 text-[#d92d20]" strokeWidth={1.75} />
        </div>

        <h2 id="delete-account-title" className="text-[20px] font-bold text-[#1c1b1f] mt-4">
          Delete Account
        </h2>
        <p className="text-[13px] font-medium text-[#6c6a75] leading-5 mt-2">
          This is permanent. Your account and all of its data are deleted from Shorter and cannot
          be recovered.
        </p>

        <div className="rounded-[16px] border-[0.75px] border-[#d2dbe9] bg-white p-4 mt-4">
          <p className="text-[13px] font-semibold text-[#1c1b1f]">What gets removed</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {REMOVED.map((item) => (
              <li key={item} className="text-[13px] font-medium text-[#6c6a75] leading-5">
                • {item}
              </li>
            ))}
          </ul>
        </div>

        <label className="block text-[13px] font-medium text-[#6c6a75] mt-4">
          Type <span className="font-bold text-[#1c1b1f]">DELETE</span> to confirm
        </label>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          disabled={busy}
          className="w-full rounded-full border-[0.75px] border-[#d2dbe9] bg-white px-5 py-[14px] mt-2 text-[14px] font-semibold tracking-[0.08em] text-[#1c1b1f] outline-none placeholder:font-medium placeholder:tracking-normal placeholder:text-[#a09cab] disabled:opacity-50"
        />

        {error && (
          <p className="text-[13px] font-medium text-[#d92d20] leading-5 mt-3">{error}</p>
        )}

        <div className="flex flex-col gap-1 mt-5">
          <button
            type="button"
            onClick={handleDelete}
            disabled={!armed || busy}
            className="w-full bg-[#d92d20] text-white rounded-full py-[16px] text-[15px] font-semibold disabled:opacity-40 active:scale-[0.99] transition-transform"
          >
            {busy ? 'Deleting…' : 'Delete My Account'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="w-full py-3.5 text-[15px] font-semibold text-[#a09cab] disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
