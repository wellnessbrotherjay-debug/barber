import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

export default function BookingSent() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8 text-center">
      <CheckCircle className="w-16 h-16 text-[#22c55e] mb-4" />
      <h1 className="text-2xl font-bold text-[#1c1b1f] mb-2">Booking sent</h1>
      <p className="text-sm text-[#a09cab] mb-8">Your request was sent to the barber. You’ll be notified when they respond.</p>
      <button type="button" onClick={() => navigate('/customer/bookings')} className="w-full bg-[#1c1b1f] text-white font-semibold py-4 rounded-full mb-3">View Bookings</button>
      <button type="button" onClick={() => navigate('/customer')} className="w-full text-[#a09cab] font-semibold py-3">Back to Home</button>
    </div>
  );
}
