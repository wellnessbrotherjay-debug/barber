import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

export default function PayFee() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const pay = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success('Booking fee paid!');
      navigate('/customer/bookings');
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-[16px] font-bold">Pay Booking Fee</h1>
      </div>
      <div className="px-5 space-y-6">
        <div className="bg-[#f4f5f8] rounded-2xl p-6 text-center">
          <p className="text-sm text-[#a09cab] mb-1">Amount due</p>
          <p className="text-4xl font-bold text-[#1c1b1f]">$5.00</p>
          <p className="text-xs text-[#514e59] mt-2">Unlocks chat + call with your barber</p>
        </div>
        <div className="border border-[#d2dbe9] rounded-xl p-4 flex items-center gap-3">
          <CreditCard className="w-6 h-6 text-[#1c1b1f]" />
          <div>
            <p className="font-semibold text-sm">•••• 4242</p>
            <p className="text-xs text-[#a09cab]">Visa ending 4242</p>
          </div>
        </div>
        <button type="button" disabled={loading} onClick={pay}
          className="w-full bg-[#1c1b1f] text-white font-semibold py-4 rounded-full disabled:opacity-50">
          {loading ? 'Processing…' : 'Pay $5.00'}
        </button>
      </div>
    </div>
  );
}
