/* Live render harness. Imports the REAL components from src and mounts them
 * against the REAL built stylesheet, so what this shows is what a consumer
 * gets — not markup hand-copied from the CSS, which would only ever prove the
 * CSS agrees with itself. */
import { createRoot } from 'react-dom/client';
import {
  Screen, Scanlines, Panel, Overlay, Button, MenuList,
  Heading, Tagline, Subhead, VersionStamp,
} from '../src/index';

function Case({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ font: '11px monospace', color: '#6fae66', letterSpacing: 2, marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </section>
  );
}

function Demo() {
  return (
    <div className="ps-root" style={{ padding: 24, minHeight: '100vh' }}>
      <Case title="TITLE SCREEN">
        <div style={{ position: 'relative', height: 320, border: '1px solid #1f8a10' }}>
          <Screen>
            <Heading size="display" level={1}>PITSTOP</Heading>
            <Tagline>NEMS&nbsp;500</Tagline>
            <Subhead>NIAGARA REGIONAL POWERLINE RACE</Subhead>
            <MenuList auto label="Title">
              <Button variant="start" blink>▶ PRESS START</Button>
            </MenuList>
            <VersionStamp>v0.9.6 · PHASE 1</VersionStamp>
            <Scanlines vignette animated />
          </Screen>
        </div>
      </Case>

      <Case title="BUTTONS — variants & states">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button>Start Race</Button>
          <Button size="sm">◀ Back</Button>
          <Button variant="danger">Return to Arcade</Button>
          <Button variant="start">▶ PRESS START</Button>
          <Button disabled>Coming Soon</Button>
        </div>
      </Case>

      <Case title="MENU LIST — column & row">
        <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
          <MenuList label="Main menu">
            <Button>Start Race</Button>
            <Button>Instructions</Button>
            <Button variant="danger">Return to Arcade</Button>
          </MenuList>
          <MenuList row auto label="Nav">
            <Button size="sm">◀ Back</Button>
            <Button size="sm">Next ▶</Button>
          </MenuList>
        </div>
      </Case>

      <Case title="PANEL">
        <Panel>
          <Heading size="md" level={3}>How to Play</Heading>
          <p style={{ marginTop: 10, fontSize: 15, lineHeight: 1.5 }}>
            Post your unit base-to-base around the Niagara Region. Fast, correct
            typing is your throttle; a miss bleeds the speed.
          </p>
        </Panel>
      </Case>

      <Case title="PANEL — glow + tight">
        <Panel glow tight>Tight padding, soft phosphor bloom.</Panel>
      </Case>

      <Case title="OVERLAY">
        <div style={{ position: 'relative', height: 220, border: '1px solid #1f8a10' }}>
          <Screen><Heading size="lg">RACE IN PROGRESS</Heading></Screen>
          <Overlay label="Paused">
            <Heading size="lg">Paused</Heading>
            <MenuList auto>
              <Button>Resume</Button>
              <Button variant="danger">Quit to Menu</Button>
            </MenuList>
          </Overlay>
        </div>
      </Case>

      <Case title="TYPE SCALE">
        <Heading size="display" level={1}>DISPLAY</Heading>
        <Heading size="lg">LARGE</Heading>
        <Heading size="md" level={3}>MEDIUM</Heading>
        <Heading size="sm" level={4}>SMALL</Heading>
        <Tagline>TAGLINE</Tagline>
        <Subhead>Subhead — the terminal voice, dimmed.</Subhead>
      </Case>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Demo />);
