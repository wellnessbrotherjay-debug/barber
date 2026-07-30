import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { User, Scissors } from 'lucide-react';

export default function RoleSelect() {
  const navigate = useNavigate();
  const { setUser, setSession } = useAuthStore();
  const [selected, setSelected] = useState<'customer' | 'barber' | null>(null);

  const handleContinue = () => {
    if (!selected) return;

    // Demo: create mock user and enter app
    const mockUser = {
      id: crypto.randomUUID(),
      full_name: selected === 'customer' ? 'John Customer' : 'Alex Barber',
      email: `${selected}@demo.app`,
      role: selected as 'customer' | 'barber',
      avatar_url: `https://i.pravatar.cc/150?u=${selected}`,
    };
    setUser(mockUser);
    setSession({ access_token: 'mock-token' });
    navigate(selected === 'customer' ? '/customer' : '/barber');
  };

  return (
    <div className="relative w-full min-h-screen bg-white flex flex-col">
      {/* Status bar area */}
      <div className="h-14 w-full" />

      {/* Header */}
      <div className="flex flex-col items-center gap-4 px-5 pt-6">
        <div className="w-[100px] h-[100px] rounded-lg bg-[#f2f1fa] flex items-center justify-center">
          <svg width="42" height="38" viewBox="0 0 42 38" fill="none">
            <rect x="4" y="8" width="34" height="24" rx="4" fill="#D4D2E3" />
            <path d="M14 22l5-6 4 5 5-7 6 8" stroke="#A09CAB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="16" cy="14" r="2.5" fill="#A09CAB" />
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-[24px] font-bold text-[#1c1b1f]">Welcome</h1>
          <p className="text-[12px] font-medium text-[#a09cab] mt-1 max-w-[281px] leading-4">
            Choose how you want to continue. You can switch later in Settings
          </p>
        </div>
      </div>

      {/* Role cards */}
      <div className="flex flex-col gap-4 px-5 mt-10">
        <button
          type="button"
          onClick={() => setSelected('customer')}
          className={`bg-white flex flex-col gap-4 p-4 rounded-xl text-left transition-all shadow-[0px_4px_22px_rgba(0,0,0,0.08)] ${
            selected === 'customer'
              ? 'ring-2 ring-[#1c1b1f]'
              : 'ring-1 ring-transparent'
          }`}
        >
          <div className="w-[38px] h-[38px] rounded-lg bg-[#fafaff] flex items-center justify-center">
            <User className="w-6 h-6 text-[#1c1b1f]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[16px] font-semibold text-[#1c1b1f] leading-5">
              Continue as Customer
            </p>
            <p className="text-[12px] font-medium text-[#a09cab] leading-[14px] mt-2">
              Browse barbers and book appointments
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelected('barber')}
          className={`bg-white flex flex-col gap-4 px-[13px] py-[11px] rounded-xl text-left transition-all shadow-[0px_4px_22px_rgba(0,0,0,0.08)] ${
            selected === 'barber'
              ? 'ring-2 ring-[#1c1b1f]'
              : 'ring-1 ring-transparent'
          }`}
        >
          <div className="w-[38px] h-[38px] rounded-lg bg-[#fafaff] flex items-center justify-center">
            <Scissors className="w-6 h-6 text-[#1c1b1f]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[16px] font-semibold text-[#1c1b1f] leading-5">
              Continue as Barber
            </p>
            <p className="text-[12px] font-medium text-[#a09cab] leading-[14px] mt-2">
              Receive booking requests and manage jobs
            </p>
          </div>
        </button>
      </div>

      {/* Bottom actions */}
      <div className="mt-auto px-5 pb-5 flex flex-col gap-1">
        <button
          type="button"
          disabled={!selected}
          onClick={handleContinue}
          className="w-full bg-[#1c1b1f] text-white text-[14px] font-semibold py-[18px] rounded-full disabled:opacity-40 active:scale-[0.98] transition-all"
        >
          Continue
        </button>

        <button
          type="button"
          onClick={() => navigate('/login')}
          className="w-full py-[18px] text-[14px] font-semibold text-[#a09cab]"
        >
          Already have an account?{' '}
          <span className="font-bold text-black">Log in</span>
        </button>

        <p className="text-[12px] font-medium text-[#a09cab] text-center leading-5 px-2">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
