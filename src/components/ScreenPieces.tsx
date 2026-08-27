import React from 'react';

/**
 * The small pieces every Shorter screen is built from, written once.
 *
 * WHY THIS EXISTS
 *   The same button, the same icon tile and the same card were written out with
 *   their measurements by hand on six screens each. Every copy carried the
 *   Figma numbers separately, so a correction meant six edits and the screens
 *   had already begun to drift - the same back arrow was drawn six different
 *   ways before this.
 *
 * WHY IT IS NOT @bnb/ui
 *   The estate's shared pieces live in @bnb/ui and are the right answer for a
 *   BnB module. Shorter is not one: it is a standalone client app in a Capacitor
 *   shell, with no @bnb/ui dependency, no /empire proxy and no platform
 *   stylesheet, and its look is contractually locked to its own Figma board.
 *   Pushing one client's design into the shared package would be worse than
 *   keeping its own. See RULES_SHORTER_ARCHITECTURE_EXCEPTIONS.
 *
 * The measurements here are the board's own. Change them only with the design.
 */

/** The black full-width call to action at the foot of a screen. */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full bg-[#1c1b1f] rounded-full px-9 py-[18px] text-[16px] leading-5 font-semibold text-white text-center disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/** The quiet grey action under a primary button - cancel, skip, not now. */
export function QuietButton({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full mt-4 text-center text-[16px] leading-5 font-semibold text-[#a09cab] py-2"
    >
      {children}
    </button>
  );
}

/** The rounded square an icon sits in, beside a line of text. */
export function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-11 h-11 rounded-[10px] bg-[#f8f8f8] flex items-center justify-center shrink-0">
      {children}
    </span>
  );
}

/** The same tile, round and white, used where the row sits on a tinted card. */
export function RoundIconTile({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-11 h-11 rounded-full bg-white flex items-center justify-center shrink-0">
      {children}
    </span>
  );
}

/** The bordered white card most sections are laid out inside. */
export function PanelCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[16px] border-[0.75px] border-[#d2dbe9] bg-white p-4 ${className}`.trim()}>
      {children}
    </div>
  );
}

/** The tinted note that explains something beside an icon. */
export function NoteCard({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#f4f5f8] rounded-[12px] p-4 flex gap-3 items-start">{children}</div>;
}
