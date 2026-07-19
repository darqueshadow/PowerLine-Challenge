import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface SubheadProps {
  children?: ReactNode;
  className?: string;
}

/** Supporting copy under a heading — terminal voice, dimmed. */
export function Subhead({ children, className }: SubheadProps) {
  return <p className={cx('ps-subhead', className)}>{children}</p>;
}
