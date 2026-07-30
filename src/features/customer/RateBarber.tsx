import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Star } from 'lucide-react';
import { toast } from 'sonner';

export default function RateBarber() {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');

  return (
    <div className="min-h-screen bg-white">
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-[16px] font-bold">Rate your barber</h1>
      </div>
      <div className="px-5 space-y-6">
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)}>
              <Star className={`w-10 h-10 ${n <= rating ? 'fill-[#1c1b1f] text-[#1c1b1f]' : 'text-[#d4d2e3]'}`} />
            </button>
          ))}
        </div>
        <textarea value={review} onChange={(e) => setReview(e.target.value)} rows={4}
          className="w-full border border-[#d2dbe9] rounded-xl p-3 text-sm resize-none" placeholder="Write a review (optional)" />
        <button type="button" disabled={!rating} onClick={() => { toast.success('Thanks for your review!'); navigate('/customer/bookings'); }}
          className="w-full bg-[#1c1b1f] text-white font-semibold py-4 rounded-full disabled:opacity-40">Submit</button>
      </div>
    </div>
  );
}
