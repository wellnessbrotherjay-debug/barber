import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Scissors, BellDot, UserRound } from 'lucide-react';

interface Props {
  active: 'home' | 'bookings' | 'notifications' | 'profile';
}

/* Customer bottom nav — Figma pages 6, 8-10: Home / Bookings / Notification / Profile.
   Active item: black notch tab above, filled icon, label below. Inactive: dark outline icon only. */
const items = [
  { key: 'home' as const, label: 'Home', icon: Home, path: '/customer' },
  { key: 'bookings' as const, label: 'Bookings', icon: Scissors, path: '/customer/bookings' },
  { key: 'notifications' as const, label: 'Notification', icon: BellDot, path: '/customer/notifications' },
  { key: 'profile' as const, label: 'Profile', icon: UserRound, path: '/customer/profile' },
];

export default function CustomerNav({ active }: Props) {
  const navigate = useNavigate();
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] h-[88px] bg-white border-t border-[#f0f0f0] flex items-start justify-around overflow-hidden z-50">
      {items.map((item) => {
        const isActive = active === item.key;
        const Icon = item.icon;
        return (
          <button key={item.key} type="button" onClick={() => navigate(item.path)} className="relative flex flex-col items-center justify-center gap-1 w-[89px] pt-[18px]">
            {isActive && <div className="absolute -top-[14px] left-1/2 -translate-x-1/2 w-[46px] h-[26px] rounded-[13px] bg-[#1c1b1f]" />}
            <Icon
              className="w-6 h-6 text-[#1c1b1f]"
              strokeWidth={isActive ? 2 : 1.7}
              fill={isActive ? 'currentColor' : 'none'}
            />
            {isActive && <span className="text-[12px] leading-4 font-semibold text-[#1c1b1f]">{item.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
