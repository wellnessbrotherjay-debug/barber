import React from 'react';
import { useNavigate } from 'react-router-dom';
import BarberNav from '@/components/BarberNav';

interface Props {
  tab: 'incoming' | 'upcoming' | 'past';
}

const JOBS = {
  incoming: [
    { id: '1', customer: 'John D.', service: 'Signature Fade', time: 'Requested 5 min ago', price: 45 },
    { id: '2', customer: 'Mike R.', service: 'Beard Trim', time: 'Requested 20 min ago', price: 25 },
  ],
  upcoming: [
    { id: '3', customer: 'Alex P.', service: 'Full Service', time: 'Today 4:00 PM', price: 65 },
  ],
  past: [
    { id: '4', customer: 'Chris L.', service: 'Buzz Cut', time: 'Yesterday', price: 20 },
    { id: '5', customer: 'Sam K.', service: 'Fade', time: 'Mar 22', price: 45 },
  ],
};

export default function BarberJobs({ tab }: Props) {
  const navigate = useNavigate();
  const tabs = [
    { key: 'incoming' as const, label: 'Incoming', path: '/barber/jobs/incoming' },
    { key: 'upcoming' as const, label: 'Upcoming', path: '/barber/jobs/upcoming' },
    { key: 'past' as const, label: 'Past', path: '/barber/jobs/past' },
  ];

  return (
    <div className="min-h-screen bg-white pb-[88px]">
      <div className="px-5 pt-14 pb-4"><h1 className="text-[16px] font-bold">Jobs</h1></div>
      <div className="px-5 flex gap-2 mb-4">
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => navigate(t.path)}
            className={`px-4 py-2 rounded-full text-xs font-semibold ${
              tab === t.key ? 'bg-[#1c1b1f] text-white' : 'bg-[#f4f5f8] text-[#514e59]'
            }`}>{t.label}</button>
        ))}
      </div>
      <div className="px-5 space-y-3">
        {JOBS[tab].map((j) => (
          <button key={j.id} type="button" onClick={() => navigate(tab === 'incoming' ? `/barber/accept/${j.id}` : `/barber/job/${j.id}`)}
            className="w-full text-left border border-[#d2dbe9] rounded-xl p-4">
            <div className="flex justify-between">
              <p className="font-semibold text-sm">{j.customer}</p>
              <p className="font-bold text-sm">${j.price}</p>
            </div>
            <p className="text-xs text-[#a09cab] mt-1">{j.service} · {j.time}</p>
          </button>
        ))}
        {JOBS[tab].length === 0 && <p className="text-center text-sm text-[#a09cab] py-8">No jobs here</p>}
      </div>
      <BarberNav active="jobs" />
    </div>
  );
}
