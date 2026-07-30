import React from 'react';
import BarberNav from '@/components/BarberNav';

export default function BarberWallet() {
  return (
    <div className="min-h-screen bg-white pb-[88px]">
      <div className="px-5 pt-14 pb-4"><h1 className="text-[16px] font-bold">Wallet</h1></div>
      <div className="px-5">
        <div className="bg-[#1c1b1f] rounded-2xl p-6 text-white mb-6">
          <p className="text-sm text-white/70">Available balance</p>
          <p className="text-3xl font-bold mt-1">$342.50</p>
          <button type="button" className="mt-4 bg-white text-[#1c1b1f] text-sm font-semibold px-5 py-2.5 rounded-full">Withdraw</button>
        </div>
        <h2 className="font-semibold text-sm mb-3">Recent transactions</h2>
        {[
          { t: 'Booking fee · John D.', a: '+$5.00', d: 'Today' },
          { t: 'Service · Alex P.', a: '+$65.00', d: 'Yesterday' },
          { t: 'Withdrawal', a: '-$100.00', d: 'Mar 20' },
        ].map((x, i) => (
          <div key={i} className="flex justify-between py-3 border-b border-[#f0f0f0]">
            <div><p className="text-sm font-medium">{x.t}</p><p className="text-xs text-[#a09cab]">{x.d}</p></div>
            <p className={`text-sm font-semibold ${x.a.startsWith('+') ? 'text-green-600' : 'text-[#1c1b1f]'}`}>{x.a}</p>
          </div>
        ))}
      </div>
      <BarberNav active="wallet" />
    </div>
  );
}
