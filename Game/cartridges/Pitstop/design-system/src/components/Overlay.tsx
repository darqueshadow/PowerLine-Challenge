import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface OverlayProps {
  children?: ReactNode;
  /** Raise above every other layer and darken further — for the Ctrl+Shift+B
   *  developer gate, which can be summoned while a pause overlay is already up. */
  dev?: boolean;
  /** Accessible name for the dialog. */
  label?: string;
  className?: string;
}

/**
 * A scrim over the console with a centred stack on top — pause, confirm,
 * developer gate.
 *
 * There is no `visible` prop and no `.hidden` class ON PURPOSE. The arcade has
 * three mutually incompatible definitions of "hidden" in play today, so this
 * library refuses to pick one: an Overlay that should not be seen is simply not
 * rendered by its parent.
 */
export function Overlay({ children, dev, label, className }: OverlayProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className={cx('ps-overlay', dev && 'ps-overlay--dev', className)}
    >
      {children}
    </div>
  );
}
