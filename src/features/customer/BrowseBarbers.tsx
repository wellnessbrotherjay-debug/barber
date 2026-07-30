import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Clock, ImageIcon } from 'lucide-react';
import CustomerNav from '@/components/CustomerNav';

const BARBERS = [
  { id: '1', name: 'Elena Rodriguez', price: 20, distance: '1.2 km away', rating: 4.9, eta: 'ETA : 25–35 min' },
  { id: '2', name: 'Marcus Chen', price: 20, distance: '2.4 km away', rating: 5.0, eta: 'ETA : 25 min' },
  { id: '3', name: 'Sarah Miller', price: 20, distance: '0.5km away', rating: 4.8, eta: 'ETA : 8 min' },
  { id: '4', name: 'James Wilson', price: 25, distance: '3.1 km away', rating: 4.7, eta: 'ETA : 40 min' },
];

export default function BrowseBarbers() {
  const navigate = useNavigate();
  return (
    <div className="relative w-full min-h-screen bg-white flex flex-col pb-[88px]">
      <div className="px-5 pt-14 pb-4"><h1 className="text-[16px] font-bold text-[#1c1b1f]">Available Now</h1></div>
      <div className="px-5 pb-4">
        <div className="bg-[#f4f5f8] rounded-lg p-3">
          <p className="text-[12px] font-medium text-[#1c1b1f]">Pay a small booking fee to confirm and unlock chat + call.</p>
        </div>
      </div>
      <div className="flex-1 px-5 flex flex-col gap-3 overflow-y-auto">
        {BARBERS.map((b) => (
          <div key={b.id} className="bg-white border border-[#d2dbe9] rounded-xl p-3 flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-lg bg-[#f2f1fa] flex items-center justify-center"><ImageIcon className="w-5 h-5 text-[#a09cab]" /></div>
                <div>
                  <p className="text-[14px] font-semibold text-[#1c1b1f]">{b.name}</p>
                  <div className="mt-1 bg-[#f8f8f8] inline-flex items-center gap-1 px-3 py-1.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                    <span className="text-[10px] font-medium text-[#514e59]">Online</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[14px] font-bold text-[#1c1b1f]">${b.price.toFixed(2)}</p>
                <p className="text-[10px] font-semibold text-[#a09cab]">{b.distance}</p>
              </div>
            </div>
            <div className="h-px bg-[#e8edf4]" />
            <div className="flex justify-between">
              <div className="flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-[#1c1b1f] text-[#1c1b1f]" /><span className="text-[10px] font-semibold">{b.rating}</span></div>
              <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-[#514e59]" /><span className="text-[10px] font-semibold text-[#514e59]">{b.eta}</span></div>
            </div>
            <div className="h-px bg-[#e8edf4]" />
            <button type="button" onClick={() => navigate(`/customer/barber/${b.id}`)} className="w-full bg-[#1c1b1f] text-white text-[12px] font-semibold py-3 rounded-full">Request Now</button>
          </div>
        ))}
      </div>
      <CustomerNav active="home" />
    </div>
  );
}
