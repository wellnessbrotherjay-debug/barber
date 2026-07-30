import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function AcceptBooking() {
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-white">
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-[16px] font-bold">Accept booking?</h1>
      </div>
      <div className="px-5 space-y-4">
        <div className="border border-[#d2dbe9] rounded-xl p-4 space-y-2">
          <p className="font-semibold">John D.</p>
          <p className="text-sm text-[#514e59]">Signature Fade · $45</p>
          <p className="text-xs text-[#a09cab]">Requested 5 min ago · ~1.2 km away</p>
        </div>
        <button type="button" onClick={() => { toast.success('Booking accepted!'); navigate('/barber/jobs/upcoming'); }}
          className="w-full bg-[#1c1b1f] text-white font-semibold py-4 rounded-full">Accept</button>
        <button type="button" onClick={() => { toast.message('Booking declined'); navigate('/barber'); }}
          className="w-full border border-[#1c1b1f] text-[#1c1b1f] font-semibold py-4 rounded-full">Decline</button>
      </div>
    </div>
  );
}
