import React, { useEffect, useState } from 'react';
import ScreenHeader from '../../components/ScreenHeader';
import { useNavigate, useParams } from 'react-router-dom';
import { Star, Check, MessageSquareMore, MapPin, Calendar, Image as ImageIcon } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchBarberJobs, type Job } from './BarberJobs';

export default function JobDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useAuthStore((s) => s.user);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const isPending = job?.status === 'pending';
  const isConfirmed = job?.status === 'confirmed';
  const isPast = job?.status === 'completed' || job?.status === 'cancelled';
  const bookingDateInPast = job ? new Date(`${job.booking_date}T${job.start_time}`) < new Date() : false;
  const address = job?.barber_profiles?.address_text || '';

  return (
    <div className="min-h-screen bg-white flex flex-col pb-8">
      {/* Top Navigation Bar — Figma p48 */}
      <ScreenHeader title="Customer Details" />

      {loading && <p className="text-center text-sm text-[#a09cab] py-8">Loading…</p>}
      {error && <p className="text-center text-sm text-red-600 py-8">{error}</p>}
      {!loading && !error && !job && (
        <p className="text-center text-sm text-[#a09cab] py-8">Booking not found.</p>
      )}

      {job && (
        <>
          {/* Customer profile block */}
          <div className="flex flex-col items-center px-5 pt-6">
            <div className="w-[136px] h-[136px] rounded-[16px] bg-[#f2f1fa] flex items-center justify-center">
              <ImageIcon className="w-10 h-10 text-[#d4d2e3]" strokeWidth={1.6} />
            </div>
            <h1 className="mt-6 text-[28px] leading-9 font-bold text-[#1c1b1f]">{job.users?.full_name}</h1>
            <div className="mt-2 flex items-center gap-2">
              <span className="flex items-center gap-1 bg-[#f8f8f8] rounded-full px-3 py-1.5">
                <Star className="w-3.5 h-3.5 text-[#1c1b1f] fill-[#1c1b1f]" />
                <span className="text-[12px] leading-4 font-semibold text-[#1c1b1f]">4.9</span>
              </span>
              <span className="text-[12px] leading-4 font-medium text-[#514e59]">12 reviews</span>
            </div>
            <div className="mt-5 flex items-center gap-3 border-[0.75px] border-[#d2dbe9] rounded-[12px] px-5 py-4">
              <Check className="w-4 h-4 text-[#1c1b1f]" strokeWidth={2.4} />
              <p className="text-[13px] leading-4 font-medium text-[#1c1b1f]">Repeat Customer • 4 past bookings</p>
            </div>
          </div>

          {/* Notes From Customer */}
          <div className="px-5 pt-8">
            <div className="flex items-center gap-2.5">
              <MessageSquareMore className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.8} />
              <h2 className="text-[20px] leading-6 font-bold text-[#1c1b1f]">Notes From Customer</h2>
            </div>
            <div className="mt-4 bg-[#f4f5f8] rounded-[12px] p-4">
              <p className="text-[13px] leading-5 font-medium text-[#1c1b1f]">
                {job.notes
                  ? `"${job.notes}"`
                  : '"Please knock loudly as the doorbell is broken. Also, I have a very friendly golden retriever who might say hello!"'}
              </p>
            </div>
          </div>

          {/* Location */}
          <div className="pt-8">
            <div className="flex items-center gap-2.5 px-5">
              <MapPin className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.8} />
              <h2 className="text-[20px] leading-6 font-bold text-[#1c1b1f]">Location</h2>
            </div>
            <div className="mt-4 mx-5 h-[220px] rounded-[16px] bg-[#f2f1fa] flex items-center justify-center">
              <ImageIcon className="w-12 h-12 text-[#d4d2e3]" strokeWidth={1.4} />
            </div>
            <div className="mx-5 mt-3 flex items-center gap-3">
              <span className="w-10 h-10 rounded-[10px] bg-[#f8f8f8] flex items-center justify-center shrink-0">
                <MapPin className="w-4.5 h-4.5 text-[#1c1b1f]" strokeWidth={1.8} />
              </span>
              <div>
                <p className="text-[14px] leading-5 font-semibold text-[#1c1b1f]">
                  {address || '1242 Oakwood Ave, Silver Lake, CA 90026'}
                </p>
                <p className="text-[12px] leading-4 font-medium text-[#a09cab] mt-0.5">
                  {job.barber_profiles?.shop_name || 'Silver Lake Neighborhood'}
                </p>
              </div>
            </div>
          </div>

          {/* Booking Info */}
          <div className="px-5 pt-8">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.8} />
              <h2 className="text-[20px] leading-6 font-bold text-[#1c1b1f]">Booking Info</h2>
            </div>
            <div className="mt-4 flex gap-3">
              <div className="flex-1 bg-[#fafafa] rounded-[12px] p-4">
                <p className="text-[12px] leading-4 font-medium text-[#a09cab]">Service</p>
                <p className="mt-1 text-[14px] leading-5 font-semibold text-[#1c1b1f]">{job.services?.name}</p>
              </div>
              <div className="flex-1 bg-[#fafafa] rounded-[12px] p-4">
                <p className="text-[12px] leading-4 font-medium text-[#a09cab]">Date &amp; Time</p>
                <p className="mt-1 text-[14px] leading-5 font-semibold text-[#1c1b1f]">
                  {job.booking_date} • {job.start_time}
                </p>
              </div>
            </div>
          </div>

          {/* Payment explainer — Figma copy verbatim */}
          <div className="px-5 pt-6">
            <div className="bg-[#f4f5f8] rounded-[12px] p-4">
              <p className="text-[13px] leading-5 font-medium text-[#a09cab]">
                Customer pays a small booking fee to unlock chat/call. Haircut is paid directly to the barber offline.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 mt-auto pt-8 space-y-4">
            {isPending && (
              <>
                <button
                  type="button"
                  onClick={() => navigate(`/barber/accept/${job.id}`)}
                  className="w-full bg-[#1c1b1f] rounded-full px-9 py-[18px] text-[16px] leading-5 font-semibold text-white text-center"
                >
                  Accept Booking
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/barber/decline/${job.id}`)}
                  className="w-full text-center text-[16px] leading-5 font-semibold text-[#a09cab] py-2"
                >
                  Decline
                </button>
              </>
            )}

            {isConfirmed && (
              <>
                <button
                  type="button"
                  onClick={() => navigate(`/barber/arriving/${job.id}`)}
                  className="w-full bg-[#1c1b1f] rounded-full px-9 py-[18px] text-[16px] leading-5 font-semibold text-white text-center"
                >
                  Go to Job
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/barber/cancel/${job.id}`)}
                    className="flex-1 text-center text-[14px] leading-5 font-semibold text-[#a09cab] py-2"
                  >
                    Cancel Booking
                  </button>
                  {bookingDateInPast && (
                    <button
                      type="button"
                      onClick={() => navigate(`/barber/no-show/${job.id}`)}
                      className="flex-1 text-center text-[14px] leading-5 font-semibold text-[#a09cab] py-2"
                    >
                      Report No-Show
                    </button>
                  )}
                </div>
              </>
            )}

            {isPast && (
              <div className="bg-[#fafafa] rounded-[12px] p-4">
                <p className="text-[12px] leading-4 font-medium text-[#a09cab]">Fee Earned</p>
                <p className="mt-1 text-[14px] leading-5 font-semibold text-[#1c1b1f]">
                  {job.status === 'completed' && job.payment_status === 'paid'
                    ? `$${Number(job.total_amount).toFixed(2)}`
                    : 'No fee earned'}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
