import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import BarberNav from '@/components/BarberNav';
import { LogOut, User } from 'lucide-react';

export default function BarberProfileEdit() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white pb-[88px]">
      <div className="px-5 pt-14 pb-6 flex flex-col items-center">
        <div className="w-20 h-20 rounded-full bg-[#f2f1fa] flex items-center justify-center mb-3">
          {user?.avatar_url ? <img src={user.avatar_url} className="w-full h-full rounded-full object-cover" alt="" /> : <User className="w-8 h-8 text-[#a09cab]" />}
        </div>
        <h1 className="text-lg font-bold">{user?.full_name}</h1>
        <p className="text-sm text-[#a09cab]">Barber · Verified</p>
      </div>
      <div className="px-5 space-y-2">
        {[
          { l: 'Edit Profile', p: '/barber/profile' },
          { l: 'Services', p: '/barber/services' },
          { l: 'Availability', p: '/barber/availability' },
          { l: 'Performance', p: '/barber/performance' },
        ].map((item) => (
          <button key={item.l} type="button" onClick={() => navigate(item.p)}
            className="w-full text-left px-4 py-4 rounded-xl bg-[#fafaff] font-medium text-sm">{item.l}</button>
        ))}
        <button type="button" onClick={() => { logout(); navigate('/'); }}
          className="w-full flex items-center gap-2 px-4 py-4 rounded-xl text-red-600 font-medium text-sm mt-4">
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>
      <BarberNav active="profile" />
    </div>
  );
}
