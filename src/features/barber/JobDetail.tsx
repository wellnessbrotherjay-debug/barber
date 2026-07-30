import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function JobDetail() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white">
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-[16px] font-bold">Customer Details</h1>
      </div>
      <div className="px-5 space-y-4">
        <div className="border border-[#d2dbe9] rounded-xl p-4">
          <p className="font-semibold text-lg">Alex P.</p>
          <p className="text-sm text-[#514e59] mt-1">Full Service · $65</p>
          <p className="text-xs text-[#a09cab] mt-1">Today 4:00 PM</p>
        </div>
        <div className="flex gap-3">
          <button type="button" className="flex-1 flex items-center justify-center gap-2 border border-[#d2dbe9] rounded-full py-3 text-sm font-semibold"><Phone className="w-4 h-4" /> Call</button>
          <button type="button" className="flex-1 flex items-center justify-center gap-2 border border-[#d2dbe9] rounded-full py-3 text-sm font-semibold"><MessageCircle className="w-4 h-4" /> Chat</button>
        </div>
        <button type="button" onClick={() => { toast.success('Job marked complete'); navigate('/barber/jobs/past'); }}
          className="w-full bg-[#1c1b1f] text-white font-semibold py-4 rounded-full">Complete job</button>
        <button type="button" onClick={() => { toast.message('Booking cancelled'); navigate('/barber'); }}
          className="w-full text-red-600 font-semibold py-3">Cancel booking</button>
      </div>
    </div>
  );
}
