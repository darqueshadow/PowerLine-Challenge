import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface MenuListProps {
  children?: ReactNode;
  /** Lay the choices out horizontally — back/next pairs, confirm rows. */
  row?: boolean;
  /** Size to the buttons instead of the 320px column minimum. */
  auto?: boolean;
  /** Accessible name, e.g. "Main menu". */
  label?: string;
  className?: string;
}

/**
 * The stack of choices that IS an arcade menu. One component for what the
 * arcade currently calls `.menu-list`, `.menu-buttons` and `#deck-controls`.
 */
export function MenuList({ children, row, auto, label, className }: MenuListProps) {
  return (
    <nav
      aria-label={label}
      className={cx('plc-menu', row && 'plc-menu--row', auto && 'plc-menu--auto', className)}
    >
      {children}
    </nav>
  );
}
