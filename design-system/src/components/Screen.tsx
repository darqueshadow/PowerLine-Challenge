import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface ScreenProps {
  children?: ReactNode;
  /** Top-align and scroll instead of centring. Use when the content can exceed
   *  the viewport — a centred overflow hides its own top with no way to reach it. */
  scroll?: boolean;
  /** Drop the centring padding and stack gap: the screen IS the content (a race
   *  view, a canvas, a garage scene) rather than a centred stack on a field. */
  bleed?: boolean;
  className?: string;
}

/**
 * One page of the console — the black phosphor field every other component sits
 * on. Provides the positioning context that `Scanlines` and `VersionStamp` pin
 * themselves to, so those two only work inside a Screen.
 */
export function Screen({ children, scroll, bleed, className }: ScreenProps) {
  return (
    <div
      className={cx(
        'plc-screen',
        scroll && 'plc-screen--top',
        bleed && 'plc-screen--bleed',
        className,
      )}
    >
      {children}
    </div>
  );
}
