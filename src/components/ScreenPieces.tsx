import { ChevronLeft, MapPin, User as UserIcon, Scissors } from 'lucide-react';
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

/** A field in the signed-out forms, with room on the left for its icon. */
export function FormInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full pl-12 pr-4 py-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-accent/20 transition-all"
    />
  );
}

/** The small grey line of text under a value or beside a label. */
export function Caption({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] leading-4 font-medium text-[#a09cab]">{children}</p>;
}

/** The heading that opens a section on the admin screens. */
export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-lg font-bold text-[#1c1b1f] mb-4 flex items-center gap-2">{children}</h3>
  );
}

/** The smaller square tile an icon sits in inside a row. */
export function SmallIconTile({ children }: { children: React.ReactNode }) {
  return (
    <div className="size-[38px] bg-surface-2 rounded-[8px] flex items-center justify-center shrink-0">
      {children}
    </div>
  );
}

/** The same square tile in white, for rows that sit on a tinted card. */
export function WhiteIconTile({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-11 h-11 rounded-[10px] bg-white flex items-center justify-center shrink-0">
      {children}
    </span>
  );
}

/** The full-stop-sized dot that separates two facts on one line. */
export function DotSeparator() {
  return <span className="w-[3px] h-[3px] rounded-full bg-[#514e59]" />;
}

/** The square a bare icon-only button occupies, so rows line up. */
export function IconButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="w-6 h-6 flex items-center justify-center shrink-0"
    >
      {children}
    </button>
  );
}

/** The other full-width call to action, in the ink colour token. */
export function InkButton({
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
      className="w-full bg-ink text-white text-[16px] font-semibold py-[20px] rounded-full"
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------------------
 * The written styles. The board draws a handful of sizes of text and uses them
 * over and over; each was typed out with its measurements wherever it appeared,
 * four or more times each. Naming them by their job means a screen says what a
 * line of text IS, and a change to the board is one edit rather than a hunt.
 * ------------------------------------------------------------------------- */

/** A value under its label - the answer, in the ordinary weight. */
export function FieldValue({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] leading-5 font-semibold text-[#1c1b1f] mt-0.5">{children}</p>;
}

/** A short bold label inside a card or chip. */
export function SmallLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] font-semibold leading-4 text-[#1c1b1f]">{children}</p>;
}

/** The tiny caption under an icon in a row of tiles. */
export function TinyLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold leading-[14px] text-muted">{children}</p>;
}

/** The same tiny caption in the grey the board uses for secondary rows. */
export function TinyLabelMuted({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold leading-[14px] text-[#a09cab]">{children}</p>;
}

/** The explaining line under a heading. */
export function SubduedLine({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[14px] leading-5 font-medium text-[#a09cab]">{children}</p>;
}

/** The centred title in a title bar that fills the row. */
export function CentredTitle({ children }: { children: React.ReactNode }) {
  return <p className="flex-1 text-center text-[16px] font-bold leading-6 text-[#1c1b1f]">{children}</p>;
}

/** The smaller heading that opens a block inside a section. */
export function BlockHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="text-base font-bold text-[#1c1b1f] mb-3 flex items-center gap-2">{children}</h4>;
}

/** The back arrow itself, at the size and weight the customer screens draw it. */
export function BackArrowIcon() {
  return <ChevronLeft className="w-6 h-6 text-ink" strokeWidth={2.25} />;
}

/** The map pin at the size the job screens draw it beside an address. */
export function AddressPinIcon() {
  return <MapPin className="w-5 h-5 text-[#1c1b1f]" strokeWidth={1.8} />;
}

/**
 * The Customer / Barber choice at the top of signing in and signing up.
 *
 * Both screens had written the whole toggle out, so the same control existed
 * twice with the same measurements - and only one of the two set type="button",
 * which inside a form is the difference between choosing a role and submitting
 * the form by accident. Written once, that cannot drift again.
 */
export function RoleToggle({
  role,
  onSelect,
}: {
  role: 'customer' | 'barber';
  onSelect: (r: 'customer' | 'barber') => void;
}) {
  const tab = (selected: boolean) =>
    `flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
      selected ? 'bg-white shadow-sm text-primary' : 'text-neutral-500'
    }`;
  return (
    <div className="flex p-1 bg-stone-100 rounded-2xl">
      <button type="button" onClick={() => onSelect('customer')} className={tab(role === 'customer')}>
        <UserIcon className="w-4 h-4" />
        Customer
      </button>
      <button type="button" onClick={() => onSelect('barber')} className={tab(role === 'barber')}>
        <Scissors className="w-4 h-4" />
        Barber
      </button>
    </div>
  );
}
