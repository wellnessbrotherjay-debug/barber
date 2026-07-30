import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function BarberAvailability() {
  const navigate = useNavigate();
  const [active, setActive] = useState<Record<string, boolean>>({
    Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: false,
  });

  return (
    <div className="min-h-screen bg-white">
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-[16px] font-bold">Availability</h1>
      </div>
      <div className="px-5 space-y-3">
        {DAYS.map((d) => (
          <div key={d} className="flex items-center justify-between border border-[#d2dbe9] rounded-xl px-4 py-3">
            <div>
              <p className="font-semibold text-sm">{d}</p>
              <p className="text-xs text-[#a09cab]">{active[d] ? '9:00 AM – 6:00 PM' : 'Off'}</p>
            </div>
            <button type="button" onClick={() => setActive((s) => ({ ...s, [d]: !s[d] }))}
              className={`w-12 h-7 rounded-full transition-colors ${active[d] ? 'bg-[#1c1b1f]' : 'bg-[#d4d2e3]'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${active[d] ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => { toast.success('Availability saved'); navigate(-1); }}
          className="w-full bg-[#1c1b1f] text-white font-semibold py-4 rounded-full mt-4">Save</button>
      </div>
    </div>
  );
}
