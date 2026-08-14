import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ImageIcon, Clock } from 'lucide-react';

// Board frame 31 — "Booking sent".
// Board layout: image placeholder, title, "Waiting for barber confirmation.",
// an "Estimated wait time" card, and a plain "Cancel Request" action.
export default function BookingSent() {
  const navigate = useNavigate();

  return (
    <div className="relative w-full bg-white flex flex-col" style={{ minHeight: 900 }}>
      <div className="h-14 w-full" />

      <div className="flex flex-col items-center px-6" style={{ marginTop: 96 }}>
        <div className="w-[100px] h-[100px] rounded-[16px] bg-surface flex items-center justify-center">
          <ImageIcon className="w-9 h-9 text-muted" />
        </div>

        <h1 className="text-[22px] font-bold text-ink mt-6">Booking sent</h1>
        <p className="text-[14px] text-muted mt-1">Waiting for barber confirmation.</p>

        <div className="w-full bg-surface rounded-[14px] px-4 py-4 mt-8">
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <Clock className="w-4 h-4" />
            Estimated wait time
          </p>
          <p className="text-[16px] font-semibold text-ink mt-2">
            This usually takes 1 to 2 minutes
          </p>
        </div>
      </div>

      <div className="mt-auto px-6 pb-10">
        <button
          type="button"
          onClick={() => navigate('/customer')}
          className="w-full py-4 text-[15px] font-semibold text-ink"
        >
          Cancel Request
        </button>
      </div>
    </div>
  );
}
