import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { toast } from 'sonner';

const INITIAL = [
  { id: '1', name: 'Signature Fade', price: 45, duration: 45 },
  { id: '2', name: 'Beard Trim', price: 25, duration: 30 },
  { id: '3', name: 'Full Service', price: 65, duration: 75 },
];

export default function BarberServices() {
  const navigate = useNavigate();
  const [services] = useState(INITIAL);

  return (
    <div className="min-h-screen bg-white">
      <div className="px-5 pt-14 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-[16px] font-bold">Services</h1>
        </div>
        <button type="button" onClick={() => toast.message('Add service coming soon')} className="p-2"><Plus className="w-5 h-5" /></button>
      </div>
      <div className="px-5 space-y-3">
        {services.map((s) => (
          <div key={s.id} className="border border-[#d2dbe9] rounded-xl p-4 flex justify-between">
            <div>
              <p className="font-semibold text-sm">{s.name}</p>
              <p className="text-xs text-[#a09cab]">{s.duration} min</p>
            </div>
            <p className="font-bold text-sm">${s.price}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
