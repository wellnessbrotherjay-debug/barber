import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { requestLocation, markLocationDeclined } from '@/lib/geo';

// Board frame 13 — "Allow Your Location".
// Layout and copy are the board's; colour follows the brand book.
export default function LocationPermission() {
  const navigate = useNavigate();
  const [busy, setBusy] = React.useState(false);

  const allow = async () => {
    setBusy(true);
    try {
      await requestLocation();
      navigate('/customer', { replace: true });
    } catch (err) {
      // Denied or unavailable — the app still works, just without distance/ETA.
      markLocationDeclined();
      toast.error(err instanceof Error ? err.message : 'Could not get your location');
      navigate('/customer', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const later = () => {
    markLocationDeclined();
    navigate('/customer', { replace: true });
  };

  return (
    <div className="relative w-full bg-white flex flex-col" style={{ minHeight: 900 }}>
      <div className="h-14 w-full" />

      <div className="flex-1 flex flex-col items-center justify-center px-8 -mt-24">
        <div className="w-[140px] h-[140px] rounded-[24px] bg-surface flex items-center justify-center">
          <MapPin className="w-[70px] h-[70px] text-muted" strokeWidth={1.25} />
        </div>

        <h1 className="text-[24px] font-bold text-ink mt-8">Allow Your Location</h1>
        <p className="text-[14px] text-muted text-center leading-5 mt-2 max-w-[290px]">
          We'll use your location to recommend local groups and people that are
          relevent to you.
        </p>
      </div>

      <div className="px-6 pb-8 flex flex-col gap-2">
        <button
          type="button"
          onClick={allow}
          disabled={busy}
          className="w-full bg-black text-white text-[15px] font-semibold py-[19px] rounded-full disabled:opacity-50 active:scale-[0.99] transition-all"
        >
          {busy ? 'Getting your location…' : 'Allow Location'}
        </button>
        <button
          type="button"
          onClick={later}
          className="w-full py-4 text-[15px] font-semibold text-muted"
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
}
