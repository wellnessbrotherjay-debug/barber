import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

/**
 * The title bar at the top of a screen: a back arrow, a centred title, and an
 * empty square on the right so the title sits in the true centre rather than
 * being pushed off it by the arrow.
 *
 * WHY THIS EXISTS
 *   The same seven lines of markup were written out on thirteen screens. Every
 *   one of them carried the measurements from the Figma board by hand, so a
 *   correction to the header meant thirteen edits, and the screens had already
 *   started to drift apart from each other. The board draws one header; there
 *   is now one header.
 *
 * The measurements are the board's own and are not to be changed here without
 * a change to the design: the padding lifts the bar clear of the notch, and the
 * back arrow and the spacer are the same size for the centring to hold.
 */
export default function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  /** Where the arrow goes. Defaults to the previous screen. */
  onBack?: () => void;
  /** Anything sitting on the right. The spacer keeps the title centred without it. */
  right?: React.ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center gap-1.5 px-5 py-4 pt-14 bg-white">
      <button
        type="button"
        aria-label="Back"
        onClick={onBack ?? (() => navigate(-1))}
        className="w-6 h-6 flex items-center justify-center shrink-0"
      >
        <ChevronLeft className="w-6 h-6 text-[#1c1b1f]" strokeWidth={2} />
      </button>
      <p className="flex-1 text-center text-[16px] leading-6 font-bold text-[#1c1b1f]">{title}</p>
      {right ?? <span className="w-6 h-6 shrink-0" />}
    </div>
  );
}
