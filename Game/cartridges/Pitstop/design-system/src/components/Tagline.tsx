import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface TaglineProps {
  children?: ReactNode;
  className?: string;
}

/**
 * The model-number line under a wordmark — "NEMS 500". Amber and widely tracked
 * so it reads as stamped on the cabinet rather than as more title.
 *
 * Named Tagline, not Subtitle, on purpose: `.subtitle` already means three
 * different things across the arcade's stylesheets, including disagreeing on
 * colour and on which margin it sets.
 */
export function Tagline({ children, className }: TaglineProps) {
  return <div className={cx('ps-tagline', className)}>{children}</div>;
}
