import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Shorter brand assets — these render the REAL files from the brand kit
 * (public/brand/*), not a redraw. The palette is strictly black & white, so each
 * asset ships in two variants:
 *   tone="dark"  → black artwork, for light surfaces (default)
 *   tone="light" → white artwork, for black/dark surfaces
 */
type Tone = 'dark' | 'light';

/** Motif only (two crossed clipper loops). */
export function ShorterMark({ className, tone = 'dark' }: { className?: string; tone?: Tone }) {
  return (
    <img
      src={tone === 'light' ? '/brand/shorter-mark-white.png' : '/brand/shorter-mark.png'}
      alt="Shorter"
      className={cn('w-6 h-auto object-contain select-none', className)}
      draggable={false}
    />
  );
}

/** Full lockup: motif + "Shorter" wordmark. */
export function ShorterLogo({ className, tone = 'dark' }: { className?: string; tone?: Tone }) {
  return (
    <img
      src={tone === 'light' ? '/brand/shorter-lockup-white.png' : '/brand/shorter-lockup.png'}
      alt="Shorter"
      className={cn('h-8 w-auto object-contain select-none', className)}
      draggable={false}
    />
  );
}

/** Wordmark only. */
export function ShorterWordmark({ className, tone = 'dark' }: { className?: string; tone?: Tone }) {
  return (
    <img
      src={tone === 'light' ? '/brand/shorter-wordmark-white.png' : '/brand/shorter-wordmark.png'}
      alt="Shorter"
      className={cn('h-6 w-auto object-contain select-none', className)}
      draggable={false}
    />
  );
}

export default ShorterLogo;
