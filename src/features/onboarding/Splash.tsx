import React from 'react';
import { useNavigate } from 'react-router-dom';

const imgMan =
  'https://www.figma.com/api/mcp/asset/70c141f8-c160-4107-9f4e-f7410c693949';
const imgWoman =
  'https://www.figma.com/api/mcp/asset/0259d7f3-57f4-46d3-a890-85f201ee7750';

export default function Splash() {
  const navigate = useNavigate();

  return (
    <div
      className="relative flex flex-col items-center overflow-hidden px-8 w-full min-h-screen"
      style={{ background: '#0a0e21' }}
    >
      {/* Status bar simulation */}
      <div className="flex items-center justify-between w-full pt-12 pb-8 px-4">
        <span className="text-white text-sm font-bold">9:41</span>
        <div className="flex gap-1.5 items-center opacity-80">
          <div className="w-4 h-4 rounded-sm bg-white/40" />
          <div className="w-4 h-4 rounded-sm bg-white/40" />
          <div className="w-5 h-3 rounded-sm bg-white/60" />
        </div>
      </div>

      {/* Floating cards section */}
      <div className="flex-1 flex flex-col items-center justify-center w-full relative pb-10">
        {/* Glow */}
        <div
          className="absolute inset-x-0 top-1/4 h-1/2 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at center, rgba(63,94,251,0.15) 0%, transparent 70%)',
          }}
        />

        {/* Bottom card (purple/blue) */}
        <div
          className="absolute w-[280px] rounded-3xl p-4 flex items-center gap-4 shadow-2xl"
          style={{
            background: 'linear-gradient(134deg, #7028e4 0%, #48c6ef 100%)',
            bottom: '18%',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <div className="w-16 h-16 rounded-full border-2 border-white/20 overflow-hidden shrink-0">
            <img src={imgMan} alt="" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-tight">VibeHive</p>
            <p className="text-white/70 text-xs">Active now</p>
            <button className="mt-2 bg-white text-black text-[10px] font-bold px-6 py-1.5 rounded-full">
              Follow
            </button>
          </div>
        </div>

        {/* Top card (lime) – rotated */}
        <div
          className="relative w-[280px] rounded-3xl p-4 flex items-center gap-4 shadow-2xl z-10"
          style={{
            background: 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)',
            transform: 'rotate(-6deg)',
          }}
        >
          <div className="w-16 h-16 rounded-full border-2 border-white/30 overflow-hidden shrink-0">
            <img src={imgWoman} alt="" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-gray-900 font-bold text-lg leading-tight">VibeHive</p>
            <p className="text-gray-700 text-xs">Active now</p>
            <button className="mt-2 bg-white text-black text-[10px] font-bold px-6 py-1.5 rounded-full shadow-sm">
              Follow
            </button>
          </div>
        </div>

        {/* Floating icon chips */}
        <div className="absolute top-[12%] right-[8%] w-10 h-10 rounded-xl bg-white/10 border border-white/10 backdrop-blur flex items-center justify-center rotate-12">
          <span className="text-white text-lg">👍</span>
        </div>
        <div className="absolute top-[38%] left-[-2%] w-10 h-10 rounded-xl bg-white/10 border border-white/10 backdrop-blur flex items-center justify-center -rotate-12">
          <span className="text-white text-lg">👍</span>
        </div>
        <div className="absolute top-[28%] right-[-2%] w-10 h-10 rounded-xl bg-white/10 border border-white/10 backdrop-blur flex items-center justify-center -rotate-[20deg]">
          <span className="text-white text-lg">🔗</span>
        </div>
        <div className="absolute bottom-[22%] left-[5%] w-10 h-10 rounded-xl bg-white/10 border border-white/10 backdrop-blur flex items-center justify-center">
          <span className="text-white text-lg">🔗</span>
        </div>
      </div>

      {/* Typography + CTA */}
      <div className="flex flex-col items-center gap-10 pb-20 w-full">
        <h1 className="text-white text-center font-bold text-[36px] leading-[41px] tracking-tight px-4">
          Connect Beyond
          <br />
          Boundaries
        </h1>

        <button
          onClick={() => navigate('/welcome')}
          className="flex items-center gap-3 pl-8 pr-3 py-3 rounded-full border border-white/20 bg-white/15 backdrop-blur-md active:scale-95 transition-transform"
        >
          <span className="text-white text-lg">Get Start</span>
          <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </button>
      </div>

      {/* Home indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1.5 rounded-full bg-white/20" />
    </div>
  );
}
