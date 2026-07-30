import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Scissors, Bell, User } from 'lucide-react';

interface Props {
  active: 'home' | 'bookings' | 'notifications' | 'profile';
}

const items = [
  { key: 'home' as const, label: 'Home', icon: Home, path: '/customer' },
  { key: 'bookings' as const, label: '', icon: Scissors, path: '/customer/bookings' },
  { key: 'notifications' as const, label: '', icon: Bell, path: '/customer/notifications' },
  { key: 'profile' as const, label: '', icon: User, path: '/customer/profile' },
];

export default function CustomerNav({ active }: Props) {
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] h-[88px] bg-white border-t border-[#f0f0f0] flex items-start justify-around pt-3 z-50">
      {items.map((item) => {
        const isActive = active === item.key;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => navigate(item.path)}
            className="relative flex flex-col items-center gap-0.5 w-[89px]"
          >
            {isActive && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-9 h-2 rounded-b-full bg-[#1c1b1f]" />
            )}
            <Icon
              className={`w-6 h-6 ${
                isActive ? 'text-[#1c1b1f]' : 'text-[#a09cab]'
              }`}
              strokeWidth={isActive ? 2.2 : 1.5}
            />
            {isActive && item.label && (
              <span className="text-[14px] font-semibold text-[#1c1b1f] capitalize">
                {item.label}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
