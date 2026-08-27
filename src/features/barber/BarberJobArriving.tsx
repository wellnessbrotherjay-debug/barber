import React, { useEffect, useState } from 'react';
import { AddressPinIcon, IconTile, QuietButton } from '../../components/ScreenPieces';
import ScreenHeader from '../../components/ScreenHeader';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchBarberJobs, type Job } from './BarberJobs';

// The two "running late" buttons are a self-contained pair with no data of their
// own, so they read better as one named piece of the screen.
function RunningLate() {
  return (
    <div className="px-5 pt-8">
      <h2 className="text-[20px] leading-6 font-bold text-[#1c1b1f]">Running late</h2>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => toast.message('Note sent: running 10 mins late')}
          className="flex-1 text-left border-[0.75px] border-[#d2dbe9] rounded-[12px] p-4"
        >
          <p className="text-[14px] leading-5 font-semibold text-[#1c1b1f]">10 mins</p>
          <p className="text-[12px] leading-4 font-medium text-[#a09cab] mt-1">Send quick note</p>
        </button>
        <button
          type="button"
          onClick={() => toast.message('Note sent: running 20+ mins late')}
          className="flex-1 text-left border-[0.75px] border-[#d2dbe9] rounded-[12px] p-4"
        >
          <p className="text-[14px] leading-5 font-semibold text-[#1c1b1f]">20+ mins</p>
          <p className="text-[12px] leading-4 font-medium text-[#a09cab] mt-1">Inform Customer</p>
        </button>
      </div>
    </div>
  );
}

/* Barber Arriving — Figma p54 */
export default function BarberJobArriving() {
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useAuthStore((s) => s.user);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

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
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  const customerName = job?.users?.full_name || 'Customer';
  const address = job?.barber_profiles?.address_text || '';
  const mapsUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;

  return (
    <div className="min-h-screen bg-white flex flex-col pb-8">
      {/* Top Navigation Bar */}
      <ScreenHeader title="Barber Arriving" />

      {loading && <p className="text-center text-sm text-[#a09cab] py-4">Loading…</p>}

      {/* Map placeholder */}
      <div className="mx-5 mt-2 h-[380px] rounded-[16px] bg-[#f2f1fa] flex items-center justify-center">
        <ImageIcon className="w-14 h-14 text-[#d4d2e3]" strokeWidth={1.4} />
      </div>

      {/* Estimated Arrival — dark banner */}
      <div className="mx-5 mt-6 flex items-center justify-between bg-[#1c1b1f] rounded-[16px] px-5 py-4">
        <div>
          <p className="text-[13px] leading-4 font-medium text-[#a09cab]">Estimated Arrival</p>
          <p className="mt-1 text-[18px] leading-6 font-bold text-white">14 mins</p>
        </div>
        <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
          <Clock className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.8} />
        </span>
      </div>

      {/* Customer Address */}
      <div className="px-5 pt-8">
        <h2 className="text-[20px] leading-6 font-bold text-[#1c1b1f]">Customer Address</h2>
        <div className="mt-4 flex items-center gap-3">
          <IconTile>
            <AddressPinIcon />
          </IconTile>
          <div>
            <p className="text-[14px] leading-5 font-semibold text-[#1c1b1f]">{customerName}</p>
            {address && (
              <p className="text-[12px] leading-4 font-medium text-[#a09cab] mt-0.5">{address}</p>
            )}
          </div>
        </div>
      </div>

      {/* Running late */}
      <RunningLate />

      {/* Actions */}
      <div className="px-5 mt-auto pt-8">
        <button
          type="button"
          onClick={() => mapsUrl && window.open(mapsUrl, '_blank', 'noopener,noreferrer')}
          disabled={!mapsUrl}
          className="w-full bg-[#1c1b1f] rounded-full px-9 py-[18px] text-[16px] leading-5 font-semibold text-white text-center disabled:opacity-60"
        >
          Open in Google Maps
        </button>
        <QuietButton type="button">
          Call {customerName}
        </QuietButton>
        {job && (
          <button
            type="button"
            onClick={() => navigate(`/barber/complete/${job.id}`)}
            className="w-full mt-2 text-center text-[14px] leading-5 font-semibold text-[#1c1b1f] py-2"
          >
            Mark Complete
          </button>
        )}
      </div>
    </div>
  );
}
