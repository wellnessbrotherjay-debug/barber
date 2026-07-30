import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Star, MapPin, Clock, ImageIcon } from 'lucide-react';

export default function BarberProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white pb-8">
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-[16px] font-bold text-[#1c1b1f]">Barber</h1>
      </div>
      <div className="px-5 flex flex-col items-center gap-3">
        <div className="w-24 h-24 rounded-2xl bg-[#f2f1fa] flex items-center justify-center"><ImageIcon className="w-10 h-10 text-[#a09cab]" /></div>
        <h2 className="text-[20px] font-bold text-[#1c1b1f]">Elena Rodriguez</h2>
        <div className="flex items-center gap-1"><Star className="w-4 h-4 fill-[#1c1b1f]" /><span className="text-sm font-semibold">4.9 (128 reviews)</span></div>
        <div className="flex items-center gap-1 text-[#a09cab] text-sm"><MapPin className="w-4 h-4" /> 1.2 km away · Downtown</div>
      </div>
      <div className="px-5 mt-6">
        <h3 className="font-semibold text-[#1c1b1f] mb-2">About</h3>
        <p className="text-sm text-[#514e59] leading-relaxed">Specializing in modern fades and classic cuts. 8 years experience. Verified professional.</p>
      </div>
      <div className="px-5 mt-6">
        <h3 className="font-semibold text-[#1c1b1f] mb-3">Services</h3>
        {[{ n: 'Signature Fade', p: 45, d: '45 min' }, { n: 'Beard Trim', p: 25, d: '30 min' }, { n: 'Full Service', p: 65, d: '75 min' }].map((s) => (
          <div key={s.n} className="flex justify-between items-center py-3 border-b border-[#f0f0f0]">
            <div><p className="font-semibold text-sm">{s.n}</p><p className="text-xs text-[#a09cab] flex items-center gap-1"><Clock className="w-3 h-3" />{s.d}</p></div>
            <p className="font-bold text-sm">${s.p}</p>
          </div>
        ))}
      </div>
      <div className="px-5 mt-8">
        <button type="button" onClick={() => navigate(`/customer/book/${id}`)} className="w-full bg-[#1c1b1f] text-white font-semibold py-4 rounded-full">Request Booking</button>
      </div>
    </div>
  );
}
