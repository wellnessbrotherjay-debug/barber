import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, XCircle, Search } from 'lucide-react';

// Figma page 35 — "Barber declined" (header: Cancelled).
// "Send to next available barber" routes back to browse — there is no backend
// auto-reassign, so the honest path is picking from the live list again.
export default function BarberDeclined() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex items-center px-6 pt-16 pb-4">
        <button type="button" aria-label="Back" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-6 h-6 text-ink" strokeWidth={2.25} />
        </button>
        <p className="flex-1 text-center text-[18px] font-bold text-ink pr-6">Cancelled</p>
      </div>

      <div className="flex flex-col items-center px-6 pt-8 text-center">
        <div className="w-[136px] h-[136px] rounded-[16px] bg-surface flex items-center justify-center">
          <XCircle className="w-[52px] h-[52px] text-ink" strokeWidth={1} />
        </div>
        <h1 className="text-[28px] leading-9 font-bold text-ink mt-6">Barber declined</h1>
        <p className="text-[15px] text-muted mt-2">No charge was made.</p>
      </div>

      <div className="mt-auto px-6 pb-6 w-full">
        <button
          type="button"
          onClick={() => navigate('/customer')}
          className="w-full bg-ink text-white text-[16px] font-semibold py-[20px] rounded-full"
        >
          Send to next available barber
        </button>
        <button
          type="button"
          onClick={() => navigate('/customer')}
          className="w-full flex items-center justify-center gap-2 py-4 text-[15px] font-semibold text-muted"
        >
          <Search className="w-4 h-4" strokeWidth={2} /> Choose another barber
        </button>
      </div>
    </div>
  );
}
