import React from 'react';
import { Star } from 'lucide-react';
import BarberNav from '@/components/BarberNav';

const REVIEWS = [
  { name: 'John D.', rating: 5, text: 'Best fade in the city. On time and professional.', date: '2 days ago' },
  { name: 'Mike R.', rating: 4, text: 'Great cut, will book again.', date: '1 week ago' },
  { name: 'Chris L.', rating: 5, text: 'Amazing attention to detail.', date: '2 weeks ago' },
];

export default function BarberReviews() {
  return (
    <div className="min-h-screen bg-white pb-[88px]">
      <div className="px-5 pt-14 pb-4"><h1 className="text-[16px] font-bold">Reviews</h1></div>
      <div className="px-5 flex items-center gap-2 mb-4">
        <Star className="w-6 h-6 fill-[#1c1b1f]" />
        <span className="text-2xl font-bold">4.9</span>
        <span className="text-sm text-[#a09cab]">(128 reviews)</span>
      </div>
      <div className="px-5 space-y-3">
        {REVIEWS.map((r, i) => (
          <div key={i} className="border border-[#d2dbe9] rounded-xl p-4">
            <div className="flex justify-between mb-1">
              <p className="font-semibold text-sm">{r.name}</p>
              <div className="flex">{Array.from({ length: r.rating }).map((_, j) => <Star key={j} className="w-3 h-3 fill-[#1c1b1f] text-[#1c1b1f]" />)}</div>
            </div>
            <p className="text-xs text-[#514e59]">{r.text}</p>
            <p className="text-[10px] text-[#a09cab] mt-1">{r.date}</p>
          </div>
        ))}
      </div>
      <BarberNav active="reviews" />
    </div>
  );
}
