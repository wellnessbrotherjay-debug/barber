import React, { useEffect, useState } from 'react';
import ScreenHeader from '../../components/ScreenHeader';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, Store, Truck, Scissors, Image as ImageIcon } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchBarberJobs, type Job } from './BarberJobs';

const COUNTDOWN_SECONDS = 80; // 1:20 — Figma p62

/* Incoming Request Detail — Figma p62 */
export default function IncomingRequest() {
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useAuthStore((s) => s.user);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);

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

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="min-h-screen bg-white flex flex-col pb-8">
      {/* Top Navigation Bar */}
      <ScreenHeader title="Incoming Requests" />

      <div className="px-5 pt-4 space-y-5">
        {loading && <p className="text-sm text-[#a09cab]">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && !job && <p className="text-sm text-[#a09cab]">Request not found.</p>}

        {job && (
          <div className="border-[0.75px] border-[#d2dbe9] rounded-[16px] p-4 space-y-4">
            {/* Header row: pill + countdown */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 bg-[#f8f8f8] rounded-full px-3 py-2">
                <span className="w-[3px] h-[3px] rounded-full bg-[#514e59]" />
                <span className="text-[12px] leading-4 font-medium text-[#514e59]">Payment authorizes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#1c1b1f]" strokeWidth={1.8} />
                <span className="text-[14px] leading-5 font-bold text-[#1c1b1f]">{mm}:{ss}</span>
              </div>
            </div>

            {/* Customer block */}
            <div className="flex items-center gap-4 bg-[#f4f5f8] rounded-[12px] p-4">
              <div className="w-[52px] h-[52px] rounded-full bg-white flex items-center justify-center shrink-0">
                <ImageIcon className="w-5 h-5 text-[#d4d2e3]" strokeWidth={1.6} />
              </div>
              <div>
                <p className="text-[16px] leading-6 font-semibold text-[#1c1b1f]">{job.users?.full_name}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-[#a09cab]" strokeWidth={1.8} />
                  <p className="text-[13px] leading-4 font-medium text-[#a09cab]">{job.services?.name}</p>
                </div>
              </div>
            </div>

            {/* Info tiles */}
            <div className="flex gap-3">
              <div className="flex-1 flex items-center gap-3 bg-[#fafafa] rounded-[12px] p-3">
                <span className="w-10 h-10 rounded-[10px] bg-white flex items-center justify-center shrink-0">
                  <Store className="w-4.5 h-4.5 text-[#1c1b1f]" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="text-[13px] leading-4 font-semibold text-[#1c1b1f]">Date &amp; Time</p>
                  <p className="text-[11px] leading-4 font-medium text-[#a09cab] mt-0.5">
                    {job.booking_date}, {job.start_time}
                  </p>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-3 bg-[#fafafa] rounded-[12px] p-3">
                <span className="w-10 h-10 rounded-[10px] bg-white flex items-center justify-center shrink-0">
                  <Truck className="w-4.5 h-4.5 text-[#1c1b1f]" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="text-[13px] leading-4 font-semibold text-[#1c1b1f]">Price</p>
                  <p className="text-[11px] leading-4 font-medium text-[#a09cab] mt-0.5">
                    ${Number(job.total_amount).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Note — Figma copy verbatim */}
        <div className="bg-[#f4f5f8] rounded-[12px] p-4">
          <p className="text-[13px] leading-5 font-medium text-[#1c1b1f]">
            <span className="font-bold">Payment Note:</span> Funds are held securely by the platform.
            Confirming this request will capture the authorizes amount.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 mt-auto pt-8">
        <button
          type="button"
          onClick={() => job && navigate(`/barber/accept/${job.id}`)}
          disabled={!job}
          className="w-full bg-[#1c1b1f] rounded-full px-9 py-[18px] text-[16px] leading-5 font-semibold text-white text-center disabled:opacity-60"
        >
          Accept Request
        </button>
        <button
          type="button"
          onClick={() => job && navigate(`/barber/decline/${job.id}`)}
          disabled={!job}
          className="w-full mt-4 text-center text-[16px] leading-5 font-semibold text-[#a09cab] py-2"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
