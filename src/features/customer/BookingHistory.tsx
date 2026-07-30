import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerNav from '@/components/CustomerNav';

const TABS = ['Upcoming', 'Past', 'Cancelled'] as const;

const DATA = {
  Upcoming: [
    { id: '1', barber: 'Elena Rodriguez', service: 'Signature Fade', date: 'Today, 3:00 PM', status: 'Confirmed', fee: true },
    { id: '2', barber: 'Marcus Chen', service: 'Beard Trim', date: 'Tomorrow, 11:00 AM', status: 'Pending', fee: false },
  ],
  Past: [
    { id: '3', barber: 'Sarah Miller', service: 'Full Service', date: 'Mar 20, 10:00 AM', status: 'Completed', fee: true },
  ],
  Cancelled: [
    { id: '4', barber: 'James Wilson', service: 'Buzz Cut', date: 'Mar 15', status: 'Cancelled', fee: false },
  ],
};

export default function BookingHistory() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Upcoming');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white pb-[88px]">
      <div className="px-5 pt-14 pb-4"><h1 className="text-[16px] font-bold">Booking History</h1></div>
      <div className="px-5 flex gap-2 mb-4">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-full text-xs font-semibold ${
              tab === t ? 'bg-[#1c1b1f] text-white' : 'bg-[#f4f5f8] text-[#514e59]'
            }`}>{t}</button>
        ))}
      </div>
      <div className="px-5 space-y-3">
        {DATA[tab].map((b) => (
          <div key={b.id} className="border border-[#d2dbe9] rounded-xl p-4">
            <div className="flex justify-between mb-1">
              <p className="font-semibold text-sm">{b.barber}</p>
              <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                b.status === 'Confirmed' ? 'bg-green-50 text-green-700' :
                b.status === 'Pending' ? 'bg-amber-50 text-amber-700' :
                b.status === 'Completed' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
              }`}>{b.status}</span>
            </div>
            <p className="text-xs text-[#a09cab]">{b.service} · {b.date}</p>
            <div className="mt-3 flex gap-2">
              {!b.fee && b.status === 'Confirmed' && (
                <button type="button" onClick={() => navigate(`/customer/pay/${b.id}`)} className="flex-1 bg-[#1c1b1f] text-white text-xs font-semibold py-2.5 rounded-full">Pay booking fee</button>
              )}
              {b.status === 'Completed' && (
                <button type="button" onClick={() => navigate(`/customer/rate/${b.id}`)} className="flex-1 border border-[#1c1b1f] text-[#1c1b1f] text-xs font-semibold py-2.5 rounded-full">Rate barber</button>
              )}
            </div>
          </div>
        ))}
      </div>
      <CustomerNav active="bookings" />
    </div>
  );
}
