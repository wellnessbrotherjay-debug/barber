import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Scissors } from 'lucide-react';
import { ShorterLogo } from '@/components/ShorterLogo';


export default function RoleSelect() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<'customer' | 'barber' | null>(null);

  const handleContinue = () => {
    if (!selected) return;
    // Route to real signup with the chosen role pre-selected — no account
    // exists yet, so this must never log the user in directly.
    // The board draws no account form - only these role cards, Continue, and a
    // Log in link. Continue therefore goes to the one auth screen the design
    // actually points at, carrying the role that was chosen.
    navigate('/login', { state: { role: selected } });
  };

  return (
    <div className="relative w-full min-h-screen bg-white flex flex-col">
      {/* Status bar area */}
      <div className="h-14 w-full" />

      {/* Header */}
      <div className="flex flex-col items-center gap-4 px-5 pt-6">
        {/* board frame 11 has an empty 100x100 image placeholder here — brand lockup fills it */}
        <div className="w-[100px] h-[100px] flex items-center justify-center">
          <ShorterLogo className="h-[26px]" />
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
          By continuing, you agree to our{' '}
          <button type="button" onClick={() => navigate('/terms')} className="font-bold text-black underline">
            Terms of Service
          </button>{' '}
          and{' '}
          <button type="button" onClick={() => navigate('/privacy')} className="font-bold text-black underline">
            Privacy Policy
          </button>
          .
        </p>
      </div>
    </div>
  );
}
