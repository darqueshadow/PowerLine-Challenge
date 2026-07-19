import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface VersionStampProps {
  children?: ReactNode;
  className?: string;
}

/**
 * The build tag pinned in a screen's corner. Absolutely positioned, so it needs
 * a positioning ancestor — `Screen` provides one.
 */
export function VersionStamp({ children, className }: VersionStampProps) {
  return <div className={cx('plc-version', className)}>{children}</div>;
}
