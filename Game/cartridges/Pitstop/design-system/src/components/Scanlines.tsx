import { cx } from '../lib/cx';

export interface ScanlinesProps {
  /** Darken the corners like a real tube. Right for a full console shell; on a
   *  small card it just reads as a smudge. */
  vignette?: boolean;
  /** Drift the lines. Sells a live tube over a printed texture. */
  animated?: boolean;
  className?: string;
}

/**
 * The CRT veil — the defining motif of the PLC arcade, and the single canonical
 * recipe for it. Covers its whole positioned ancestor and never takes pointer
 * events, so controls underneath stay clickable.
 */
export function Scanlines({ vignette, animated, className }: ScanlinesProps) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        'ps-ui-scanlines',
        vignette && 'ps-ui-scanlines--vignette',
        animated && 'ps-ui-scanlines--animated',
        className,
      )}
    />
  );
}
