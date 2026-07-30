import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Wallet, Star, User } from 'lucide-react';

interface Props {
  active: 'jobs' | 'wallet' | 'reviews' | 'profile';
}

const items = [
  { key: 'jobs' as const, label: 'Jobs', icon: LayoutDashboard, path: '/barber' },
  { key: 'wallet' as const, label: 'Wallet', icon: Wallet, path: '/barber/wallet' },
  { key: 'reviews' as const, label: 'Reviews', icon: Star, path: '/barber/reviews' },
  { key: 'profile' as const, label: 'Profile', icon: User, path: '/barber/profile' },
];

export default function BarberNav({ active }: Props) {
  const navigate = useNavigate();
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] h-[88px] bg-white border-t border-[#f0f0f0] flex items-start justify-around pt-3 z-50">
      {items.map((item) => {
        const isActive = active === item.key;
        const Icon = item.icon;
        return (
          <button key={item.key} type="button" onClick={() => navigate(item.path)} className="relative flex flex-col items-center gap-0.5 w-[89px]">
            {isActive && <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-9 h-2 rounded-b-full bg-[#1c1b1f]" />}
            <Icon className={`w-6 h-6 ${isActive ? 'text-[#1c1b1f]' : 'text-[#a09cab]'}`} strokeWidth={isActive ? 2.2 : 1.5} />
            {isActive && <span className="text-[12px] font-semibold text-[#1c1b1f]">{item.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
