import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function BookingRequest() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState('fade');
  const [note, setNote] = useState('');

  return (
    <div className="min-h-screen bg-white">
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-[16px] font-bold">Booking Request</h1>
      </div>
      <div className="px-5 space-y-5">
        <div>
          <p className="text-sm font-semibold mb-2">Select service</p>
          {[
            { id: 'fade', label: 'Signature Fade', price: 45 },
            { id: 'beard', label: 'Beard Trim', price: 25 },
            { id: 'full', label: 'Full Service', price: 65 },
          ].map((s) => (
            <button key={s.id} type="button" onClick={() => setService(s.id)}
              className={`w-full flex justify-between p-4 rounded-xl border mb-2 text-left ${
                service === s.id ? 'border-[#1c1b1f] bg-[#fafaff]' : 'border-[#d2dbe9]'
              }`}>
              <span className="font-semibold text-sm">{s.label}</span>
              <span className="font-bold text-sm">${s.price}</span>
            </button>
          ))}
        </div>
        <div>
          <p className="text-sm font-semibold mb-2">Notes for barber</p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
            className="w-full border border-[#d2dbe9] rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1c1b1f]/20"
            placeholder="Any preferences?" />
        </div>
        <div className="bg-[#f4f5f8] rounded-xl p-4">
          <p className="text-xs text-[#514e59]">Booking fee $5 will be charged to confirm. Unlocks chat & call with your barber.</p>
        </div>
        <button type="button" onClick={() => navigate('/customer/booking-sent')}
          className="w-full bg-[#1c1b1f] text-white font-semibold py-4 rounded-full">Send Request</button>
      </div>
    </div>
  );
}
