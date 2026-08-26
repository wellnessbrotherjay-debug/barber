import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, X, User, Calendar, MapPin } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchBarberJobs, type Job } from './BarberJobs';

/* Customer Cancelled — Figma p53 */
export default function CustomerCancelled() {
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useAuthStore((s) => s.user);
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    if (!user?.id || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchBarberJobs(user.id);
        const found = data.find((j) => j.id === id) || null;
        if (!cancelled) setJob(found);
      } catch (err) {
        console.error(`[CustomerCancelled] loading the cancelled booking failed:`, err);
        /* booking overview simply stays empty */
      }
    })();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  return (
    <div className="min-h-screen bg-white flex flex-col pb-8">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-center gap-1.5 px-5 py-4 pt-14 bg-white">
        <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="w-6 h-6 flex items-center justify-center shrink-0">
          <ChevronLeft className="w-6 h-6 text-[#1c1b1f]" strokeWidth={2} />
        </button>
        <p className="flex-1 text-center text-[16px] leading-6 font-bold text-[#1c1b1f]">Cancelled</p>
        <span className="w-6 h-6 shrink-0" />
      </div>

      {/* Hero */}
      <div className="flex flex-col items-center px-5 pt-6">
        <div className="w-[136px] h-[136px] rounded-[16px] bg-[#f2f1fa] flex items-center justify-center">
          <span className="w-11 h-11 rounded-full border-[1.5px] border-[#1c1b1f] flex items-center justify-center">
            <X className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.8} />
          </span>
        </div>
        <h1 className="mt-6 text-[28px] leading-9 font-bold text-[#1c1b1f]">Customer cancelled</h1>
        <p className="mt-1 text-[14px] leading-5 font-medium text-[#a09cab]">
          This booking has been cancelled by the customer.
        </p>
      </div>

      {/* Booking Overview */}
      <div className="px-5 pt-8">
        <h2 className="text-[20px] leading-6 font-bold text-[#1c1b1f]">Booking Overview</h2>
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-[10px] bg-[#f8f8f8] flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-[12px] leading-4 font-medium text-[#a09cab]">Customer</p>
              <p className="text-[14px] leading-5 font-semibold text-[#1c1b1f] mt-0.5">
                {job?.users?.full_name || '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-[10px] bg-[#f8f8f8] flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-[12px] leading-4 font-medium text-[#a09cab]">Scheduled Date</p>
              <p className="text-[14px] leading-5 font-semibold text-[#1c1b1f] mt-0.5">
                {job?.booking_date || '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-[10px] bg-[#f8f8f8] flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-[12px] leading-4 font-medium text-[#a09cab]">Location</p>
              <p className="text-[14px] leading-5 font-semibold text-[#1c1b1f] mt-0.5">
                {job?.barber_profiles?.address_text || '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 mt-auto pt-8">
        <button
          type="button"
          onClick={() => navigate('/barber/jobs/incoming')}
          className="w-full bg-[#1c1b1f] rounded-full px-9 py-[18px] text-[16px] leading-5 font-semibold text-white text-center"
        >
          Back to Requests
        </button>
        <button
          type="button"
          onClick={() => navigate('/barber/report-issue')}
          className="w-full mt-4 text-center text-[16px] leading-5 font-semibold text-[#a09cab] py-2"
        >
          Contact Support
        </button>
      </div>
    </div>
  );
}
