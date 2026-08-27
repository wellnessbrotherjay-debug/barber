import React from 'react';
import { ChevronLeft } from 'lucide-react';

/**
 * The title bar on the customer side of the app: a back arrow on the left and a
 * title centred across the rest of the row.
 *
 * WHY THERE ARE TWO HEADERS
 *   The Figma board draws the customer journey and the barber journey with
 *   different title bars, and they are genuinely different - this one sits
 *   lower on the screen, uses a heavier arrow and an 18px title, and balances
 *   the centring with padding rather than a spacer square. The barber side is
 *   ScreenHeader. Neither can be swapped for the other without changing what is
 *   drawn, so both exist, and each is written once.
 *
 *   This markup had been copied onto nine customer screens, which is how the
 *   same control ends up drawn six slightly different ways across an app.
 *
 * The measurements are the board's own and are not to be changed here without a
 * change to the design.
 */
export default function CustomerScreenHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center px-6 pt-16 pb-4">
      <button type="button" aria-label="Back" onClick={onBack}>
        <ChevronLeft className="w-6 h-6 text-ink" strokeWidth={2.25} />
      </button>
      <p className="flex-1 text-center text-[18px] font-bold text-ink pr-6">{title}</p>
    </div>
  );
}
