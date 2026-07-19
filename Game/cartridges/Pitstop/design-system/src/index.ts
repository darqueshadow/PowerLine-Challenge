/* ============================================================================
 * @pitstop/ui — public entry
 * ----------------------------------------------------------------------------
 * Components only. This file deliberately does NOT `import './styles/index.css'`:
 * TypeScript carries such an import into dist/index.d.ts, where a consumer's
 * compiler cannot resolve a .css module and the build then fails on our behalf.
 * The stylesheet is a separate first-class artifact instead — reached via the
 * package's "style" field or its "./styles.css" export — which is also exactly
 * what lets build-free Pitstop just <link> it.
 * ========================================================================= */

/* ---- Chrome: the console shell ---------------------------------------- */
export { Screen } from './components/Screen';
export type { ScreenProps } from './components/Screen';
export { Scanlines } from './components/Scanlines';
export type { ScanlinesProps } from './components/Scanlines';
export { Panel } from './components/Panel';
export type { PanelProps } from './components/Panel';
export { Overlay } from './components/Overlay';
export type { OverlayProps } from './components/Overlay';

/* ---- Controls --------------------------------------------------------- */
export { Button } from './components/Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/Button';
export { MenuList } from './components/MenuList';
export type { MenuListProps } from './components/MenuList';

/* ---- Typography ------------------------------------------------------- */
export { Heading } from './components/Heading';
export type { HeadingProps, HeadingSize, HeadingLevel } from './components/Heading';
export { Tagline } from './components/Tagline';
export type { TaglineProps } from './components/Tagline';
export { Subhead } from './components/Subhead';
export type { SubheadProps } from './components/Subhead';
export { VersionStamp } from './components/VersionStamp';
export type { VersionStampProps } from './components/VersionStamp';
