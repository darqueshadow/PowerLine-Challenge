import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface PanelProps {
  children?: ReactNode;
  /** Cap the height and scroll the body — for instructions and reference tables
   *  that would otherwise push a screen's own controls off the bottom. */
  scroll?: boolean;
  /** Tighter padding, for a panel used as a card rather than as a page body. */
  tight?: boolean;
  /** Soft phosphor bloom. Draws the eye without spending a signal colour. */
  glow?: boolean;
  className?: string;
}

/** A bordered field of phosphor glass — the arcade's workhorse container. */
export function Panel({ children, scroll, tight, glow, className }: PanelProps) {
  return (
    <div
      className={cx(
        'ps-panel',
        scroll && 'ps-panel--scroll',
        tight && 'ps-panel--tight',
        glow && 'ps-panel--glow',
        className,
      )}
    >
      {children}
    </div>
  );
}
