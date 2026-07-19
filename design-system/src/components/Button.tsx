import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';

export type ButtonVariant = 'default' | 'danger' | 'start';
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  /** `default` outline · `danger` amber exit/destructive · `start` the filled
   *  arcade "insert coin" button (PRESS START, RACE AGAIN). */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Attract-mode blink. Reserve it for the one control that is asking to be
   *  pressed — a screen with two blinking buttons has neither. */
  blink?: boolean;
}

/**
 * The arcade button: transparent face, chunky phosphor border, uppercase and
 * tracked, inverting on hover and on focus.
 *
 * This one component replaces the seventeen- and eighteen-ID selector lists
 * that Asteroid Command and The Aquanaut each maintain today.
 *
 * `type="button"` is defaulted deliberately: HTML's own default is `submit`,
 * which silently submits any form a button happens to be nested in.
 */
export function Button({
  children,
  variant = 'default',
  size = 'md',
  blink,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'plc-btn',
        size === 'sm' && 'plc-btn--sm',
        variant === 'danger' && 'plc-btn--danger',
        variant === 'start' && 'plc-btn--start',
        blink && 'plc-btn--blink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
