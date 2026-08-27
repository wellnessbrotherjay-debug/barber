import React, { useEffect, useState } from 'react';
import { AddressPinIcon, Caption, FieldValue, IconTile, QuietButton, SubduedLine } from '../../components/ScreenPieces';
import ScreenHeader from '../../components/ScreenHeader';
import { useNavigate, useParams } from 'react-router-dom';
import { X, User, Calendar } from 'lucide-react';
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
      <ScreenHeader title="Cancelled" />

      {/* Hero */}
      <div className="flex flex-col items-center px-5 pt-6">
        <div className="w-[136px] h-[136px] rounded-[16px] bg-[#f2f1fa] flex items-center justify-center">
          <span className="w-11 h-11 rounded-full border-[1.5px] border-[#1c1b1f] flex items-center justify-center">
            <X className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.8} />
          </span>
        </div>
        <h1 className="mt-6 text-[28px] leading-9 font-bold text-[#1c1b1f]">Customer cancelled</h1>
        <SubduedLine>
          This booking has been cancelled by the customer.
        </SubduedLine>
      </div>

      {/* Booking Overview */}
      <div className="px-5 pt-8">
        <h2 className="text-[20px] leading-6 font-bold text-[#1c1b1f]">Booking Overview</h2>
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <IconTile>
              <User className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.8} />
            </IconTile>
            <div>
              <Caption>Customer</Caption>
              <FieldValue>
                {job?.users?.full_name || '—'}
              </FieldValue>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <IconTile>
              <Calendar className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.8} />
            </IconTile>
            <div>
              <Caption>Scheduled Date</Caption>
              <FieldValue>
                {job?.booking_date || '—'}
              </FieldValue>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <IconTile>
              <AddressPinIcon />
            </IconTile>
            <div>
              <Caption>Location</Caption>
              <FieldValue>
                {job?.barber_profiles?.address_text || '—'}
              </FieldValue>
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
        <QuietButton type="button" onClick={() => navigate('/barber/report-issue')}>
          Contact Support
        </QuietButton>
      </div>
    </div>
  );
}
