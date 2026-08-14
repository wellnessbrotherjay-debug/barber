import React from 'react';
import CustomerNav from '@/components/CustomerNav';

const NOTIFS = [
  { title: 'Booking confirmed', body: 'Elena accepted your request for today 3:00 PM', time: '2m ago' },
  { title: 'Payment received', body: 'Booking fee of $5 was paid successfully', time: '1h ago' },
  { title: 'Reminder', body: 'Your appointment with Marcus is tomorrow', time: 'Yesterday' },
];

export default function CustomerNotifications() {
  return (
    <div className="min-h-screen bg-white pb-[88px]">
      <div className="px-5 pt-14 pb-4"><h1 className="text-[16px] font-bold">Notifications</h1></div>
      <div className="px-5 space-y-3">
        {NOTIFS.length === 0 && (
          <p className="text-center text-sm text-[#a09cab] py-8">You're all caught up — no notifications yet</p>
        )}
        {NOTIFS.map((n, i) => (
          <div key={i} className="border border-[#d2dbe9] rounded-xl p-4">
            <div className="flex justify-between mb-1">
              <p className="font-semibold text-sm">{n.title}</p>
              <span className="text-[10px] text-[#a09cab]">{n.time}</span>
            </div>
            <p className="text-xs text-[#514e59]">{n.body}</p>
          </div>
        ))}
      </div>
      <CustomerNav active="notifications" />
    </div>
  );
}
