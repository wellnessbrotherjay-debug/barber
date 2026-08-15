import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ChevronsRight } from 'lucide-react';

// Splash / hero — page 1 of the Shorter Figma board, replicated literally
// (locked design per the service agreement, cl. 4.1): navy #23313E circle,
// copper #CF8654 chips, "Barbar" wordmark and "Find best barbarr in town."
// copy exactly as drawn. Photos and the scissors/comb/hair doodles are the
// board's own assets, extracted from the Figma export (public/figma/*).
const NAVY = '#23313E';
const COPPER = '#CF8654';
export default function Splash() {
  const navigate = useNavigate();

  return (
    <div className="relative w-full bg-white overflow-hidden" style={{ height: 900 }}>
      {/* Board wordmark */}
      <div className="absolute left-0 right-0 flex justify-center" style={{ top: 58 }}>
        <span className="font-bold text-black" style={{ fontSize: 28 }}>Barbar</span>
      </div>

      {/* ---- Hero cluster (board: x 7..381, y 134..517) ---- */}
      <div className="absolute inset-x-0" style={{ top: 0, height: 540 }}>
        {/* decorative doodles */}
        <img src="/figma/doodle-comb-scissors.png" alt="" aria-hidden
             className="absolute opacity-25" style={{ left: 82, top: 137, width: 46 }} />
        <img src="/figma/doodle-hair.png" alt="" aria-hidden
             className="absolute opacity-25" style={{ left: 302, top: 104, width: 42 }} />
        <img src="/figma/doodle-razor.png" alt="" aria-hidden
             className="absolute opacity-25" style={{ left: 336, top: 322, width: 44 }} />
        <img src="/figma/doodle-curl.png" alt="" aria-hidden
             className="absolute opacity-25" style={{ left: 7, top: 268, width: 34 }} />

        {/* main circle — board navy */}
        <div className="absolute rounded-full"
             style={{ left: 23, top: 167, width: 345, height: 345, background: NAVY }} />

        {/* headline, inside the circle */}
        <div className="absolute" style={{ left: 158, top: 291, width: 220 }}>
          <p className="text-white font-bold" style={{ fontSize: 34, lineHeight: '56px', letterSpacing: '-0.5px' }}>
            Find Your
          </p>
          <p className="text-white font-bold" style={{ fontSize: 18, lineHeight: '26px', letterSpacing: '1px' }}>
            Barber
          </p>
        </div>

        {/* barber photos (board assets, greyscale per brand book) */}
        <img src="/figma/barber-1.png" alt=""
             className="absolute rounded-full object-cover"
             style={{ left: 243, top: 147, width: 128, height: 128 }} />
        <img src="/figma/barber-2.png" alt=""
             className="absolute rounded-full object-cover"
             style={{ left: 20, top: 319, width: 119, height: 119 }} />

        {/* #Date — copper pill */}
        <div className="absolute text-white font-bold flex items-center justify-center rounded-full"
             style={{ left: 157, top: 226, width: 115, height: 47, fontSize: 17, background: COPPER }}>
          #Date
        </div>

        {/* #Cut — copper pill */}
        <div className="absolute text-white font-bold flex items-center justify-center rounded-full"
             style={{ left: 36, top: 468, width: 98, height: 47, fontSize: 17, background: COPPER }}>
          #Cut
        </div>

        {/* speech bubble */}
        <div className="absolute bg-white rounded-full flex items-center justify-center shadow-[0_4px_22px_rgba(0,0,0,0.12)]"
             style={{ left: 128, top: 418, width: 216, height: 48 }}>
          <span className="text-black font-bold" style={{ fontSize: 15 }}>Say more than “Hey”</span>
        </div>
      </div>

      {/* ---- Lower block ---- */}
      <div className="absolute" style={{ left: 20, top: 600, right: 20 }}>
        <div className="bg-black text-white font-semibold inline-flex items-center justify-center rounded-full"
             style={{ width: 138, height: 30, fontSize: 14 }}>
          100% Match
        </div>

        <h1 className="text-black font-bold" style={{ fontSize: 38, lineHeight: '50px', marginTop: 20 }}>
          Get Ready to Meet
          <br />
          Your Barber
        </h1>

        <p className="text-black" style={{ fontSize: 14, marginTop: 12 }}>
          Find best barbarr in town.
        </p>
      </div>

      {/* CTA bar — dark pill with copper heart chip, per board */}
      <button
        type="button"
        onClick={() => navigate('/welcome')}
        className="absolute bg-black rounded-full flex items-center active:scale-[0.99] transition-transform"
        style={{ left: 20, top: 813, width: 351, height: 56 }}
      >
        <span className="rounded-full flex items-center justify-center shrink-0"
              style={{ width: 53, height: 53, marginLeft: 1.5, background: COPPER }}>
          <Heart className="w-5 h-5 text-white" fill="currentColor" />
        </span>
        <span className="flex-1 text-white font-semibold" style={{ fontSize: 15 }}>Get Started</span>
        <ChevronsRight className="w-6 h-6 text-white mr-5" />
      </button>
    </div>
  );
}
