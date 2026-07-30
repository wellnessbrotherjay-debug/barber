import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function BarberPerformance() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white">
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-[16px] font-bold">Performance Overview</h1>
      </div>
      <div className="px-5 grid grid-cols-2 gap-3">
        {[...
          { l: 'Jobs completed', v: '48' },
          { l: 'Acceptance rate', v: '94%' },
          { l: 'Avg rating', v: '4.9' },
          { l: 'This month', v: '$1,240' },
        ].map((s) => (
          <div key={s.l} className="bg-[#fafaff] rounded-xl p-4">
            <p className="text-xs text-[#a09cab]">{s.l}</p>
            <p className="text-2xl font-bold mt-1">{s.v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
