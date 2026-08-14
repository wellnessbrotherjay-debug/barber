import React from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircle, ShieldCheck, ImageIcon, ChevronLeft } from 'lucide-react';

// Board frame 39 — "No barbers available right now".
// Reachable from BrowseBarbers.tsx when the barber list comes back empty.
const OPTIONS = [
  { label: 'Try again', detail: 'Restart the search with the same settings.' },
  { label: 'Expand radius', detail: 'Look for barbers further away from you.' },
  { label: 'Schedule later', detail: 'Book a slot for tomorrow or later this week.' },
];

export default function NoBarbersAvailable() {
  const navigate = useNavigate();

  return (
    <div className="relative w-full bg-white" style={{ minHeight: 900 }}>
      {/* board header: back chevron + "Booking Status" */}
      <div className="flex items-center px-5 pt-14 pb-2">
        <button type="button" onClick={() => navigate(-1)} className="p-1 -ml-1">
          <ChevronLeft className="w-6 h-6 text-ink" />
        </button>
        <p className="flex-1 text-center text-[16px] font-bold text-ink pr-6">Booking Status</p>
      </div>

      <div className="flex flex-col items-center px-5 pt-8">
        <div className="w-[100px] h-[100px] rounded-[16px] bg-surface flex items-center justify-center">
          <XCircle className="w-11 h-11 text-ink" strokeWidth={1.25} />
        </div>

        <h1 className="text-[24px] font-bold text-ink text-center mt-6 leading-8">
          No barbers available
          <br />
          right now
        </h1>
        <p className="text-[14px] text-muted text-center mt-2 leading-5">
          We couldn't find a match for your current location and time preferences.
        </p>

        {/* board renders this as a solid black reassurance bar, not a tinted alert */}
        <div className="w-full bg-ink rounded-[12px] px-4 py-4 mt-6 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-white shrink-0" />
          <p className="text-[14px] font-semibold text-white">Your card was not charged.</p>
        </div>

        <div className="w-full space-y-3 mt-5">
          {OPTIONS.map(({ label, detail }) => (
            <button
              key={label}
              type="button"
              onClick={() => navigate('/customer')}
              className="w-full flex items-center gap-3 p-3 rounded-[14px] bg-surface text-left"
            >
              <span className="w-11 h-11 rounded-full bg-white flex items-center justify-center shrink-0">
                <ImageIcon className="w-5 h-5 text-muted" />
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-ink">{label}</span>
                <span className="block text-[13px] text-muted mt-0.5">{detail}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/customer/help')}
        className="absolute left-0 right-0 text-center text-[14px] font-semibold text-muted"
        style={{ bottom: 40 }}
      >
        Need help? Contact support
      </button>
    </div>
  );
}
