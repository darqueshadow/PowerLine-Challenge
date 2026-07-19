import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export type HeadingSize = 'display' | 'lg' | 'md' | 'sm';
export type HeadingLevel = 1 | 2 | 3 | 4;

export interface HeadingProps {
  children?: ReactNode;
  /** Visual scale. `display` is the wordmark. */
  size?: HeadingSize;
  /** Document level, INDEPENDENT of size — so a screen can be semantically
   *  correct and visually right at the same time. */
  level?: HeadingLevel;
  className?: string;
}

/** Cabinet-voice heading: pixel face, uppercase, phosphor, glowing. */
export function Heading({ children, size = 'lg', level = 2, className }: HeadingProps) {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';
  return (
    <Tag className={cx('ps-heading', `ps-heading--${size}`, className)}>{children}</Tag>
  );
}
