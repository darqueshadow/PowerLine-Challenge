/* ========================================================
   ASTEROID COMMAND — HOW TO PLAY (the manual)

   Copy and structure come from
   "Help Files/AsteroidCommand_HowToPlay_ContentSpec.md".
   The tone of that copy is fixed — do not rewrite it to be more
   explanatory, more polite or more complete. If a mechanic reads as
   under-explained, the fix is a new panel, not a longer paragraph.

   HOW TO PLAY opens on a menu of eight cards, not a document. One idea
   per screen, BACK on every panel. Panel 6 is the only one with sub-pages.

   Every number the manual quotes is read from the live datasets/config
   (progression.csv, scoring.csv, bases.csv, shorthand.csv, config.js) so
   the manual can never drift out of sync with a tuning pass. Prose is
   hardcoded; figures are not.
   ======================================================== */

const HowToPlay = (function () {
    'use strict';

    // Panel 1 opens by default the first time a dispatcher ever enters.
    // After that, HOW TO PLAY lands on the card menu.
    const SEEN_KEY = 'ac_htp_seen';

    // ── small helpers ────────────────────────────────────────────────────
    const esc = s => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const pct  = n => Math.round(n * 100) + '%';
    const num  = n => Number(n).toLocaleString('en-US');
    const secs = ms => (ms / 1000).toFixed(1).replace(/\.0$/, '') + 's';

    function kicker(html)  { return `<p class="htp-kicker">${html}</p>`; }
    function lead(html)    { return `<p class="htp-lead">${html}</p>`; }
    function para(html)    { return `<p>${html}</p>`; }

    // The load-bearing boxes — THE TRAP, F12, the CARD warning. Players
    // retain these and nothing else, so they get the Atari-manual
    // warning-box treatment rather than being folded into the prose.
    function callout(tone, title, html) {
        return `<div class="htp-callout htp-callout-${tone}">
                    ${title ? `<div class="htp-callout-head">${title}</div>` : ''}
                    <div class="htp-callout-body">${html}</div>
                </div>`;
    }

    function table(heads, rows, cls) {
        return `<table class="htp-tbl ${cls || ''}">
            ${heads ? `<thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead>` : ''}
            <tbody>${rows.map(r =>
                `<tr${r.tone ? ` class="htp-row-${r.tone}"` : ''}>${
                    (r.cells || r).map(c => `<td>${c}</td>`).join('')
                }</tr>`).join('')}</tbody>
        </table>`;
    }

    // Terminal-style example block
    function screen(lines) {
        return `<pre class="htp-screen">${lines.join('\n')}</pre>`;
    }

    // Rank ladder, in progression order.
    function tiers() {
        return Object.keys(TIERS)
            .sort((a, b) => TIERS[a].min - TIERS[b].min)
            .map(k => TIERS[k]);
    }
    function firstTier() { return tiers()[0] || {}; }
    function lastTier()  { const t = tiers(); return t[t.length - 1] || {}; }

    // ── PANEL 1 — THE SITUATION ──────────────────────────────────────────
    function panelSituation() {
        return kicker(`<strong>NIAGARA REGION DEFENSE SYSTEM</strong><br>
                       <em>Dispatcher Briefing &mdash; Read Once, Then Never Again</em>`)
            + para(`It is 2075, and nobody can agree on why the asteroids chose Niagara.`)
            + para(`The leading theory is the power grid. Sixty years of hydroelectric hum leaking
                    into deep space, and something out there heard it, decided it was a dinner bell,
                    and RSVP'd. Loudly. With rocks.`)
            + para(`Humanity built a great many defense systems in the panic that followed. Exactly
                    one of them worked, and &mdash; in a development that surprised absolutely
                    everyone except dispatchers &mdash; it was <strong>the CAD terminal.</strong>
                    It turns out asteroid targeting arrays and emergency dispatch consoles speak
                    close enough to the same language that if you type a properly formatted
                    PowerLine command at an incoming asteroid, the Radio Tower on the escarpment
                    will lock on and vaporize it.`)
            + para(`Type it wrong and the tower fires anyway. Wild. Into your own shield.`)
            + para(`So here is where things stand. Four landmarks are still standing. Everyone with
                    the sense to evacuate has evacuated. You had a shift.`)
            + callout('info', '', `<strong>You are the last dispatcher on the escarpment. Your keyboard
                    is a planetary defense weapon. Type clean, type fast, and the Niagara Region
                    sees morning.</strong>`)
            + para(`Coffee's in the pot. It's been in the pot a while.`);
    }

    // ── PANEL 2 — BASIC GAMEPLAY ─────────────────────────────────────────
    function panelGameplay() {
        const example = (DATA_LOCATIONS_FULL.find(l => l.c === 'Westwood') || { c: 'Westwood', m: '72122' });
        return kicker(`<strong>Rocks fall. You type. They stop falling.</strong>`)
            + para(`Targets drop from the top of the screen toward the five structures below. Each one
                    carries a <strong>unit number</strong> and a <strong>plain-English radio call</strong>.`)
            + para(`Your job is to translate that call into PowerLine and type it before the rock lands.`)
            + screen([
                `        2105`,
                `   Mobile to ${esc(example.c)}          &rarr;   ENP 2105 ${esc(example.m)}`
              ])
            + para(`Press <span class="htp-key">ENTER</span> to fire.`)
            + `<ul class="htp-list">
                 <li><span class="htp-bullet htp-ok">&#x25B8;</span><span class="htp-li-text">
                     <strong>Right command</strong> &mdash; the tower locks on, fires, and the target is
                     gone. Points awarded.</span></li>
                 <li><span class="htp-bullet htp-bad">&#x25B8;</span><span class="htp-li-text">
                     <strong>Wrong command</strong> &mdash; <strong>MISFIRE.</strong> The tower fires wild,
                     your own shield absorbs it. ${misfirePenalty()} points, one shield point, and every
                     streak you had resets to zero.</span></li>
                 <li><span class="htp-bullet htp-bad">&#x25B8;</span><span class="htp-li-text">
                     <strong>Nothing typed, ENTER pressed</strong> &mdash; also a misfire. The tower does
                     not need your permission to embarrass you.</span></li>
                 <li><span class="htp-bullet htp-bad">&#x25B8;</span><span class="htp-li-text">
                     <strong>Target reaches the ground</strong> &mdash; the landmark under it is
                     destroyed.</span></li>
               </ul>`
            + para(`<strong>Lose all four landmarks and the region falls.</strong> That is the only way
                    the run ends.`)
            + callout('info', '', `<strong>You are not aiming. You are not dodging. Typing the right
                    command <em>is</em> the shot.</strong>`)
            + `<h4 class="htp-sub">CONTROLS</h4>`
            + table(['KEY', 'ACTION'], [
                ['<span class="htp-key">ENTER</span>',     'Fire &mdash; submit the command'],
                ['<span class="htp-key">F12</span>',       '<strong>Clear the command box.</strong> Free. No penalty.'],
                ['<span class="htp-key">BACKSPACE</span>', 'Fix a typo &mdash; and pay for it'],
                ['<span class="htp-key">ESCAPE</span>',    'Pause / Resume'],
                ['<span class="htp-key">ARROW KEYS</span>','Navigate menus']
              ], 'htp-tbl-keys')
            + callout('warn', '&#9000; THE MOST IMPORTANT KEY IN THE GAME IS F12',
                `Backspacing costs points and breaks your Perfect Streak.
                 <strong>F12 costs nothing.</strong><br>
                 Typed garbage? Don't fix it. <strong>Wipe it and start again.</strong> Every experienced
                 dispatcher on this console does exactly that, and every rookie backspaces their score
                 into the floor.`);
    }

    // ── PANEL 3 — SPEAKING POWERLINE ─────────────────────────────────────
    // Meanings are copy; the phrasings and the base list are dataset-rendered.
    const CODE_MEANINGS = {
        AP:  'Post a unit to a base',
        ENP: 'Enroute &mdash; the unit is travelling there',
        BSE: 'On scene &mdash; the unit has arrived',
        LA:  'Local area &mdash; mobile <em>around</em> a district'
    };
    const CODE_ORDER = ['AP', 'ENP', 'BSE', 'LA'];

    function panelPowerline() {
        const example = (DATA_LOCATIONS_FULL.find(l => l.c === 'Westwood') || { c: 'Westwood', m: '72122' });

        // Group the challenge phrasings under the code they map to.
        const byCode = {};
        DATA_ACTIONS.forEach(a => {
            if (!a.m) return;
            (byCode[a.m] = byCode[a.m] || []).push(a.c);
        });
        const codes = CODE_ORDER.filter(c => byCode[c])
            .concat(Object.keys(byCode).filter(c => CODE_ORDER.indexOf(c) === -1));

        const codeRows = codes.map(c => [
            `<span class="htp-code-chip">${esc(c)}</span>`,
            CODE_MEANINGS[c] || '',
            `<span class="htp-phrases">${byCode[c].map(esc).join(' &middot; ')}</span>`
        ]);

        // Two columns of bases, filled down the left then down the right.
        const bases = DATA_LOCATIONS_FULL.length
            ? DATA_LOCATIONS_FULL
            : [{ c: 'Base list unavailable', m: '—' }];
        const baseHtml = bases.map(b =>
            `<div class="htp-base">
                 <span class="htp-base-name">${esc(b.c)}</span>
                 <span class="htp-base-dots"></span>
                 <span class="htp-base-num">${esc(b.m)}</span>
             </div>`).join('');

        return kicker(`<strong>Three parts. Always three parts.</strong>`)
            + screen([
                `   &lt;CODE&gt;   &lt;UNIT&gt;   &lt;BASE NUMBER&gt;`,
                `    ENP      2105      ${esc(example.m)}`
              ])
            + para(`The <strong>unit number</strong> is printed on the target &mdash; just retype it.
                    The <strong>code</strong> and the <strong>base number</strong> are what you have
                    to know.`)
            + `<h4 class="htp-sub">THE FOUR CODES</h4>`
            + para(`The wording of the radio call tells you which code to use.`)
            + table(['CODE', 'MEANING', 'THE CALL SOUNDS LIKE'], codeRows, 'htp-tbl-codes')
            + callout('danger', '&#9888; THE TRAP',
                `<strong>"Mobile to ${esc(example.c)}" is ENP.</strong><br>
                 <strong>"Mobile around ${esc(example.c)}" is LA.</strong><br><br>
                 One preposition. Different command. This is not a gotcha &mdash; it is the exact
                 distinction you make on a live radio, and it is the single skill this game exists
                 to drill into you.`)
            + `<h4 class="htp-sub">BASE NUMBERS</h4>`
            + `<div class="htp-bases">${baseHtml}</div>`
            + para(`<span class="htp-note-line">Exact match only. The whole string has to be right.
                    There is no partial credit and no autocomplete &mdash; same as the real
                    console.</span>`);
    }

    // ── PANEL 4 — THE DEFENSE GRID ───────────────────────────────────────
    function panelGrid() {
        // Repair delay doubles with every tower loss — destroyTower().
        const repairs = [0, 1, 2, 3].map(i => (4 * Math.pow(2, i)) + 's').join(' &rarr; ');
        const layers  = Math.round(CONFIG.maxShieldStrength / CONFIG.hpPerShieldLayer);

        return kicker(`<strong>Four landmarks. One gun. No spare parts.</strong>`)
            + table(null, [
                ['NOTL',           '<strong>Sir Adam Beck</strong> generating station', 'Zone'],
                ['NIAGARA FALLS',  '<strong>Skylon Tower</strong>',                     'Zone'],
                { tone: 'key', cells: ['<strong>CENTRE</strong>', '<strong>RADIO TOWER</strong>', '<strong>Your gun</strong>'] },
                ['THOROLD',        '<strong>Welland Canal lift bridge</strong>',        'Zone'],
                ['PORT COLBORNE',  '<strong>Robin Hood flour mill</strong>',            'Zone']
              ], 'htp-tbl-grid')
            + para(`The Radio Tower in the middle is not scenery. <strong>It is the thing that
                    shoots.</strong> If it goes down, you cannot fire &mdash; and the rocks do not
                    stop coming while you wait.`)
            + para(`<strong>The run ends when all four zones are gone.</strong> Losing the tower is
                    bad. Losing the zones is fatal.`)
            + `<h4 class="htp-sub">SHIELDS</h4>`
            + para(`Your tower carries <strong>${CONFIG.maxShieldStrength} shield points</strong>
                    &mdash; ${layers === 3 ? 'three' : layers} layers of ${CONFIG.hpPerShieldLayer}.`)
            + `<ul class="htp-list htp-list-tight">
                 <li><span class="htp-bullet htp-warn">&#x25B8;</span><span class="htp-li-text">
                     <strong>Misfire</strong> &mdash; ${CONFIG.misfireDamage} point</span></li>
                 <li><span class="htp-bullet htp-bad">&#x25B8;</span><span class="htp-li-text">
                     <strong>Target hits the tower</strong> &mdash; ${CONFIG.impactDamage} points</span></li>
                 <li><span class="htp-bullet htp-bad">&#x25B8;</span><span class="htp-li-text">
                     <strong>The shield never regenerates.</strong> What you spend is gone for the rest
                     of the run.</span></li>
               </ul>`
            + para(`At zero the tower is <strong>exposed</strong>. The next hit destroys it.`)
            + `<h4 class="htp-sub">NANOMEDIC REPAIR UNIT</h4>`
            + para(`When the tower falls, a NanoMedic &mdash; a space ambulance, because of course it
                    is &mdash; is dispatched to rebuild it. The gun is offline until it finishes. The
                    music degrades to static so you know exactly how the region feels about this.`)
            + para(`<strong>Each repair takes twice as long as the last: ${repairs}.</strong>`)
            + callout('info', '', `The CARD Shorthand lifeline still works while the tower is
                    rebuilding. It is the only thing that does.`)
            + `<h4 class="htp-sub">DEBRIS STRIKE</h4>`
            + para(`Calls keep getting routed to zones that are already rubble. Those calls still have
                    to be cleared.`)
            + para(`A target landing on a destroyed zone costs you points &mdash; but it is
                    <strong>not</strong> a zone loss. Your kill streak survives it.`);
    }

    // ── PANEL 5 — SCORING ────────────────────────────────────────────────
    function misfirePenalty() {
        return Math.max(SCORING.maxPenalty, -50);   // applyMisfire()
    }

    function panelScoring() {
        const t = TIERS[typeof state !== 'undefined' && state.selectedDifficulty]
               || firstTier();

        const bonusRows = [
            ['<strong>PERFECT</strong>',         `+${pct(SCORING.perfectMult)}`,
             'Zero backspaces on that target'],
            ['<strong>EARLY INTERCEPT</strong>', `+${pct(SCORING.earlyMult)}`,
             `Destroyed in the top quarter of the screen`],
            ['<strong>SPEED DEMON</strong>',     `+${pct(SCORING.speedDemonMult)}`,
             `Destroyed within ${secs(SCORING.speedDemonTime)} of it appearing`]
        ];

        const streakRows = SCORING.killStreakSteps
            .filter(s => s.mult > 1)
            .map(s => {
                const range = s.max === Infinity ? `<strong>${s.min}+</strong>` : `${s.min}&ndash;${s.max}`;
                const mult  = s.max === Infinity ? `<strong>${s.mult.toFixed(2)}&times;</strong>`
                                                 : `${s.mult.toFixed(2)}&times;`;
                return [range, mult, s.text ? `<strong>${esc(s.text)}</strong>` : '&mdash;'];
            });

        const milestones = SCORING.streakMilestones
            .map(m => `<strong>${m.threshold}</strong> &rarr; +${num(m.bonus)}`)
            .join(' &middot; ');

        // Zone loss escalation — destroyBase(): free once, then -100 per extra
        // consecutive loss, clamped at penaltyCap.
        const zoneSteps = [2, 3, 4]
            .map(n => num(Math.max(SCORING.penaltyCap, (n - 1) * -100)))
            .join(', ');

        const debris = Math.max(SCORING.maxPenalty,
                                -Math.floor((t.baseHit || 100) * SCORING.debrisStrikeMult));

        return kicker(`<strong>A clean kill pays. Everything else in this system is a modifier on
                       that one number.</strong>`)
            + para(`Your <strong>base hit</strong> value is set by your rank &mdash; it climbs from
                    ${esc(titleCase(firstTier().label || 'Trainee'))} to
                    ${esc(lastTier().label || 'O.A.S')}. That means every bonus is worth more at high
                    rank, and every mistake costs more too.`)
            + para(`<strong>Your score can never drop below zero.</strong> No single mistake costs more
                    than <strong>${num(SCORING.maxPenalty)}</strong>.`)
            + `<h4 class="htp-sub">BONUSES THAT MULTIPLY THE HIT</h4>`
            + para(`These stack. You can earn all three on one target.`)
            + table(['BONUS', 'WORTH', 'HOW'], bonusRows, 'htp-tbl-bonus')
            + para(`<strong>Early Intercept is the biggest single bonus in the game. Kill high.</strong>`)
            + `<h4 class="htp-sub">KILL STREAK</h4>`
            + para(`Consecutive kills without losing a zone.`)
            + table(['STREAK', 'MULTIPLIER', 'CALLOUT'], streakRows, 'htp-tbl-streak')
            + `<h4 class="htp-sub">PERFECT STREAK</h4>`
            + para(`Consecutive kills with <strong>zero backspaces</strong>. Pays a one-time flat bonus
                    at each milestone.`)
            + `<p class="htp-milestones">${milestones}</p>`
            + callout('warn', '', `<strong>One backspace on a target is forgiven. Two breaks the
                    streak</strong> and clears every milestone you were building toward. This is what
                    F12 is for.`)
            + `<h4 class="htp-sub">FLAT BONUSES</h4>`
            + table(null, [
                [`<strong>CLOSE CALL!</strong> +${SCORING.nearMissFlat}`,
                 `Destroyed in the bottom ${Math.round((1 - SCORING.nearMissThreshold) * 100)}% &mdash; a genuine last-second save`],
                [`<strong>ONLINE</strong> +${SCORING.firstBloodFlat}`,
                 `First kill of the session`],
                [`<strong>BACK ONLINE</strong> +${SCORING.comebackFlat}`,
                 `${SCORING.comebackTarget} kills in a row after losing a zone`],
                [`<strong>SYSTEMS CALIBRATED</strong> +${SCORING.calibrationFlat}`,
                 `Every ${num(SCORING.calibrationInterval)} points earned within a rank`],
                [`<strong>RANK UP!</strong>`,
                 `${SCORING.rankUpMult === 2 ? 'Two' : SCORING.rankUpMult} full base hits, paid on every promotion`]
              ], 'htp-tbl-flat')
            + `<h4 class="htp-sub">PENALTIES</h4>`
            + table(null, [
                { tone: 'bad', cells: ['<strong>Misfire</strong>',
                  `${num(misfirePenalty())}, one shield point, all streaks reset`] },
                { tone: 'bad', cells: ['<strong>Backspaces</strong>',
                  `1&ndash;2: &minus;${pct(SCORING.keyDustMult)} &middot; 3&ndash;4: &minus;${pct(SCORING.signalNoiseMult)} &middot; ` +
                  `5&ndash;6: ${num(SCORING.commsDriftFlat)} flat &middot; 7+: ${num(SCORING.staticJamFlat)} flat ` +
                  `<em>(highest tier only, counted per target)</em>`] },
                { tone: 'bad', cells: ['<strong>Zone lost</strong>',
                  `Free the first time. Then ${zoneSteps} for consecutive losses`] },
                { tone: 'bad', cells: ['<strong>Debris strike</strong>',
                  `&minus;${pct(SCORING.debrisStrikeMult)} of base hit, capped at ${num(SCORING.maxPenalty)} ` +
                  `<em>(${num(debris)} at ${esc(t.label || 'TRAINEE')})</em>`] }
              ], 'htp-tbl-pen')
            + callout('info', '', `<strong>One kill wipes the zone-loss escalation.</strong> If you
                    have just lost two zones, do not panic and do not chase &mdash; get <em>any</em>
                    target down and the counter resets.`);
    }

    function titleCase(s) {
        return String(s).replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
    }

    // ── PANEL 6 — SHORTHAND COMMENTS (sub-menu) ──────────────────────────
    function bannerPoints() {
        if (!DATA_SHORTHAND.length) return { lo: SATELLITE.defaultPoints, hi: SATELLITE.defaultPoints };
        const pts = DATA_SHORTHAND.map(s => s.points);
        return { lo: Math.min(...pts), hi: Math.max(...pts) };
    }

    function panelBanners() {
        const p = bannerPoints();
        const worth = p.lo === p.hi ? `<strong>${num(p.lo)} points</strong> each`
                                    : `<strong>${num(p.lo)}&ndash;${num(p.hi)} points</strong> each`;
        const sample = DATA_SHORTHAND.find(s => s.code === '/PDN') || DATA_SHORTHAND[0]
                    || { code: '/PDN', banner: 'Police have been notified' };

        // Flyby window, in seconds, for a given rank. The satellite rides the
        // rank's speed multiplier (spawnSatellite()), so the answer window
        // tightens as the game speeds up. Distance is the sky plus the tail the
        // banner still has to drag clear — a rough average across the dataset.
        const win = t => {
            if (!t || !t.speedMin) return '';
            const chars = DATA_SHORTHAND.length
                ? DATA_SHORTHAND.reduce((n, s) => n + s.banner.length, 0) / DATA_SHORTHAND.length
                : 24;
            const tail = SATELLITE.towLineLength + chars * SATELLITE.charSpacing
                       + SATELLITE.bannerPadding * 2;
            const travel = COORD_SYSTEM.width + SATELLITE.spriteW + tail;
            const at = mult => travel / Math.min(SATELLITE.speed *
                        (1 + (mult - 1) * SATELLITE.speedScaling), SATELLITE.maxSpeed);
            return `${Math.round(at(t.speedMax))}&ndash;${Math.round(at(t.speedMin))}`;
        };

        return kicker(`<strong>Somebody is still running ads during the apocalypse.</strong>`)
            + para(`Every so often a satellite tows an advertising banner across the sky. The banner
                    displays the <strong>full text</strong> of a CAD shorthand comment.`)
            + para(`You score it by typing <strong>the code itself, with a leading slash</strong>,
                    before the banner leaves the screen.`)
            + screen([
                `   BANNER READS:   ${esc(sample.banner)}`,
                `   YOU TYPE:       ${esc(sample.code)}`
              ])
            + `<ul class="htp-list htp-list-tight">
                 <li><span class="htp-bullet htp-ok">&#x25B8;</span><span class="htp-li-text">
                     ${worth}.</span></li>
                 <li><span class="htp-bullet htp-ok">&#x25B8;</span><span class="htp-li-text">
                     Catch them back to back and you build a <strong>separate chain multiplier, up to
                     ${SATELLITE.streakCap}&times;.</strong></span></li>
                 <li><span class="htp-bullet htp-bad">&#x25B8;</span><span class="htp-li-text">
                     A <strong>wrong</strong> <code>/code</code> is a misfire &mdash; points, shield,
                     chain gone.</span></li>
                 <li><span class="htp-bullet htp-warn">&#x25B8;</span><span class="htp-li-text">
                     Letting one drift off untouched just resets the chain. No points lost.</span></li>
               </ul>`
            + para(`Commands never start with a slash, so <code>/</code> is an unambiguous signal. You
                    can answer a banner mid-flow without your normal typing getting confused.`)
            + para(`<strong>The window shrinks as you rank up.</strong> Roughly
                    ${win(firstTier()) || '16–24'} seconds at
                    ${esc(titleCase(firstTier().label || 'Trainee'))}, down to
                    ${win(lastTier()) || '3–5'} at ${esc(lastTier().label || 'O.A.S')}.`)
            + callout('info', '', `Banners are free money at low rank. Build the
                    ${SATELLITE.streakCap}&times; chain while the window is still generous.`);
    }

    function panelMasterList() {
        const list = DATA_SHORTHAND.length ? DATA_SHORTHAND : [];
        if (!list.length) {
            return kicker(`<strong>The shorthand dataset has not loaded.</strong>`)
                 + para(`Start the game from a web server (or rebuild the offline data pack) and the
                         master list will appear here.`);
        }
        return kicker(`${list.length} codes. You will not memorize these tonight. That's what the
                       banners are for.`)
            + `<div class="htp-chart-sh">${list.map(s =>
                `<div class="htp-sh">
                     <span class="htp-sh-code">${esc(s.code)}</span>
                     <span class="htp-sh-dots"></span>
                     <span class="htp-sh-text">${esc(s.banner)}</span>
                 </div>`).join('')}</div>`;
    }

    function panelCard() {
        // Matched case-insensitively — CARD_HELP.triggers[0] is the canonical one.
        const phrase = titleCase((CARD_HELP.triggers || ['CARD SHORTHAND'])[0])
                        .replace(/^Card/, 'CARD');
        return kicker(`<strong>Blanking on a code with the banner already halfway across the
                       sky?</strong>`)
            + para(`Type:`)
            + screen([`   ${esc(phrase)}`])
            + para(`A card appears showing the banner text and exactly what to type.`)
            + `<h4 class="htp-sub">IT IS NOT FREE. THIS IS A CHEAT WITH TEETH.</h4>`
            + table(null, [
                { tone: 'bad', cells: ['<strong>The game does not pause.</strong>',
                  'Targets keep falling behind the card.'] },
                { tone: 'bad', cells: ['<strong>Your input line is locked.</strong>',
                  'The only thing the console will accept is the code on that card. You cannot defend anything until you clear it.'] },
                { tone: 'bad', cells: ['<strong>Your streaks are already gone.</strong>',
                  'Kill streak, perfect streak and banner chain zero out the moment you ask. Win or lose.'] },
                { tone: 'warn', cells: ['<strong>Clear it in time</strong>',
                  'The banner is destroyed &mdash; and pays <strong>nothing</strong>.'] },
                { tone: 'bad', cells: ['<strong>Let it escape</strong>',
                  'The banner strikes your tower, and you take a <strong>heavy points penalty that scales with your rank.</strong> At the top it is worse than losing a zone.'] }
              ], 'htp-tbl-card')
            + para(`If you ask with no banner in the sky, you get <code>NO BANNER IN RANGE</code>.
                    No hint, but no punishment either.`)
            + callout('danger', '', `<strong>Use it to learn a code you genuinely don't know. Do not use
                    it as a reflex.</strong> A failed CARD at high rank undoes a full clean kill and
                    then some.`);
    }

    // ── PANEL 7 — DIFFICULTY & RANK ──────────────────────────────────────
    function panelRanks() {
        const rows = tiers().map((t, i, all) => {
            const cells = [
                `<strong>${esc(t.label)}</strong>`,
                esc(t.difficulty || t.label),
                num(t.min),
                `${t.speedMin.toFixed(1)}&ndash;${t.speedMax.toFixed(1)}&times;`,
                `${(t.spawnMin / 1000).toFixed(1)}&ndash;${(t.spawnMax / 1000).toFixed(1)}s`,
                String(t.maxTargets)
            ];
            return i === all.length - 1 ? { tone: 'key', cells } : cells;
        });
        const top = lastTier();

        return kicker(`<strong>${tiers().length} ranks. They are the real career ladder, and they
                       behave like it.</strong>`)
            + table(['RANK', 'DIFFICULTY', 'POINTS TO REACH', 'SPEED', 'SPAWN', 'MAX ON SCREEN'],
                    rows, 'htp-tbl-ranks')
            + para(`Ranking up raises your base hit <strong>and</strong> your penalties. High rank is
                    not a victory lap &mdash; it is a harder shift that pays better.`)
            + `<h4 class="htp-sub">YOU DON'T HAVE TO START AT THE BOTTOM</h4>`
            + para(`<strong>MAIN MENU &rarr; DIFFICULTY</strong> lets you open at any of the
                    ${tiers().length}. Pick your level and the run starts at that rank's speed, spawn
                    rate, target count and scoring. An experienced dispatcher should not have to grind
                    the ${esc(titleCase(firstTier().label || 'Trainee'))} ramp to find a challenge.`)
            + para(`Two things worth knowing:`)
            + `<ol class="htp-ol">
                 <li><strong>Your pick is your floor.</strong> You can be promoted upward, but never
                     demoted below the difficulty you chose.</li>
                 <li><strong>It sticks.</strong> Your choice is remembered between sessions.</li>
               </ol>`
            + para(`Every target also carries a <strong>&plusmn;15% speed variance</strong>, so no two
                    rocks fall at quite the same rate even inside a single rank.`)
            + callout('danger', '', `<strong>${esc(top.label || 'O.A.S')}:</strong> sub-second spawns,
                    ${top.speedMax ? top.speedMax.toFixed(0) : 'four'}-times speed,
                    ${top.maxTargets || 25} targets in the air at once. This is the endgame. Nobody
                    expects you to enjoy it.`);
    }

    // ── PANEL 8 — DISPATCHER'S EDGE ──────────────────────────────────────
    function panelEdge() {
        const tips = [
            [`Learn the prepositions before anything else.`,
             `<em>to</em> = ENP &middot; <em>around / by / at</em> = LA &middot; <em>Arriving</em> = BSE
              &middot; <em>Post / Assign / Required / Needed</em> = AP. That is most of the game right
              there.`],
            [`F12, not backspace.`,
             `Backspaces are the single biggest avoidable points leak in the game. Clearing is free.
              There is no situation where backspacing five characters beats a fresh start.`],
            [`Kill high.`,
             `Early Intercept is +${pct(SCORING.earlyMult)}. A rock caught near the top is worth half
              again as much as the same rock caught near the bottom.`],
            [`Protect the streak, not the score.`,
             `At 25+ kills every clean call pays
              ${SCORING.killStreakSteps[SCORING.killStreakSteps.length - 1].mult.toFixed(2)}&times;. One
              panicked misfire throws all of it away. A moment's care beats a fast wrong answer every
              single time.`],
            [`One kill resets the collapse.`,
             `Just lost two zones? Do not chase the whole screen. Get <em>any</em> target down and the
              escalation counter goes back to zero.`],
            [`Treat CARD as a last resort.`,
             `It costs your streak <em>and</em> locks you out of defending while rocks are falling. It
              is a learning tool, not a crutch.`],
            [`Farm banners early.`,
             `At ${esc(titleCase(firstTier().label || 'Trainee'))} you get up to 24 seconds to answer
              one. At ${esc(lastTier().label || 'O.A.S')} you get three. Build the chain while the
              window is generous.`]
        ];

        return kicker(`<strong>${tips.length} things the veterans on this console already
                       know.</strong>`)
            + `<ol class="htp-ol htp-ol-tips">${tips.map(([head, body]) =>
                `<li><strong>${head}</strong><br>${body}</li>`).join('')}</ol>`
            + closingCard();
    }

    // ── CLOSING CARD ─────────────────────────────────────────────────────
    // Shown at the end of Panel 8, and at the foot of the card menu — the
    // screen the player is on when they leave HOW TO PLAY.
    function closingCard() {
        return `<div class="htp-closing">
            <div class="htp-closing-title">ASTEROID COMMAND</div>
            <div class="htp-closing-sub">A PowerLine Challenge Cartridge</div>
            <p>Every unit number, base code, radio phrase and shorthand comment in this game is drawn
               from real Niagara Region EMS operational data. The rocks are made up.
               <strong>The commands are not.</strong></p>
            <div class="htp-closing-sign">Type clean. Type fast. Save the region.</div>
        </div>`;
    }

    // ── PANEL TABLE OF CONTENTS ──────────────────────────────────────────
    const PANELS = [
        { id: 'situation', n: '1', title: 'THE SITUATION',
          blurb: 'The story. Why the rocks, why Niagara, why you.', body: panelSituation },
        { id: 'gameplay',  n: '2', title: 'BASIC GAMEPLAY',
          blurb: 'The loop, the controls, F12.', body: panelGameplay },
        { id: 'powerline', n: '3', title: 'SPEAKING POWERLINE',
          blurb: 'Command anatomy, the four codes, the preposition trap, base numbers.',
          body: panelPowerline },
        { id: 'grid',      n: '4', title: 'THE DEFENSE GRID',
          blurb: 'The five structures, shields, the tower, NanoMedic repair.', body: panelGrid },
        { id: 'scoring',   n: '5', title: 'SCORING',
          blurb: 'Bonuses, streaks, penalties.', body: panelScoring },
        { id: 'shorthand', n: '6', title: 'SHORTHAND COMMENTS',
          blurb: 'How banners work, the master list, the CARD lifeline.',
          sub: [
              { id: 'banners', n: '6A', title: 'HOW BANNERS WORK',
                blurb: 'The satellite, the slash, the chain multiplier.', body: panelBanners },
              { id: 'master',  n: '6B', title: 'MASTER LIST',
                blurb: 'Every code, every phrase.', body: panelMasterList },
              { id: 'card',    n: '6C', title: 'THE CARD LIFELINE',
                blurb: 'The cheat with teeth.', body: panelCard }
          ] },
        { id: 'ranks',     n: '7', title: 'DIFFICULTY & RANK',
          blurb: 'The eight ranks, choosing your start.', body: panelRanks },
        { id: 'edge',      n: '8', title: "DISPATCHER'S EDGE",
          blurb: 'Strategy tips.', body: panelEdge }
    ];

    // ── NAVIGATION ───────────────────────────────────────────────────────
    // route: null = contents menu · {p} = panel · {p, s} = sub-page of panel 6
    let route = null;

    function panelAt(r) {
        if (!r) return null;
        const p = PANELS.find(x => x.id === r.p);
        if (!p) return null;
        return r.s ? (p.sub || []).find(x => x.id === r.s) || null : p;
    }

    function cardButton(item, parentId) {
        return `<button type="button" class="htp-card" data-goto="${parentId ? parentId + '/' : ''}${item.id}">
                    <span class="htp-card-n">${item.n}</span>
                    <span class="htp-card-text">
                        <span class="htp-card-title">${item.title}</span>
                        <span class="htp-card-blurb">${item.blurb}</span>
                    </span>
                    <span class="htp-card-arrow">&#x25B6;</span>
                </button>`;
    }

    function renderContents() {
        return `<div class="htp-contents-head">SELECT A SECTION</div>
                <div class="htp-cards">${PANELS.map(p => cardButton(p)).join('')}</div>
                ${closingCard()}`;
    }

    function renderSubMenu(p) {
        return `<div class="htp-contents-head">SELECT A SECTION</div>
                <div class="htp-cards">${p.sub.map(s => cardButton(s, p.id)).join('')}</div>`;
    }

    function draw() {
        const host = document.getElementById('howtoplay-scroll');
        const crumb = document.getElementById('htp-crumb');
        const backBtn = document.getElementById('howtoplay-back-btn');
        const nextBtn = document.getElementById('htp-next-btn');
        if (!host) return;

        if (!route) {
            host.innerHTML = renderContents();
            if (crumb) crumb.textContent = 'CONTENTS';
            if (backBtn) backBtn.textContent = 'BACK TO MAIN MENU';
            if (nextBtn) nextBtn.classList.add('hidden');
        } else {
            const parent = PANELS.find(x => x.id === route.p);
            const item = panelAt(route);
            if (!item) { route = null; return draw(); }

            const body = item.sub ? renderSubMenu(item) : item.body();
            host.innerHTML = `<article class="htp-panel">
                    <header class="htp-panel-head">
                        <span class="htp-panel-n">${item.n}</span>
                        <h3>${item.title}</h3>
                    </header>
                    ${body}
                </article>`;

            if (crumb) {
                crumb.textContent = route.s
                    ? `${parent.title} / ${item.title}`
                    : item.title;
            }
            if (backBtn) {
                backBtn.textContent = route.s ? `◀ ${parent.title}` : '◀ CONTENTS';
            }
            if (nextBtn) {
                const sibs = route.s ? parent.sub : PANELS;
                const idx = sibs.findIndex(x => x.id === (route.s || route.p));
                const next = sibs[idx + 1];
                nextBtn.classList.toggle('hidden', !next);
                if (next) nextBtn.textContent = `${next.n}. ${next.title} ▶`;
            }
        }
        host.scrollTop = 0;
    }

    // ── PUBLIC API ───────────────────────────────────────────────────────
    function go(target) {
        if (!target) { route = null; }
        else {
            const [p, s] = String(target).split('/');
            route = s ? { p, s } : { p };
        }
        draw();
    }

    function open() {
        let seen = null;
        try { seen = localStorage.getItem(SEEN_KEY); } catch (e) { /* private mode */ }
        if (!seen) {
            try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* private mode */ }
            route = { p: 'situation' };     // briefing, first time only
        } else {
            route = null;                    // returning player lands on the menu
        }
        draw();
    }

    // Returns true if it handled the step, false when there is nowhere left to
    // go but out of HOW TO PLAY entirely.
    function back() {
        if (route && route.s) { route = { p: route.p }; draw(); return true; }
        if (route)            { route = null;           draw(); return true; }
        return false;
    }

    function next() {
        if (!route) return;
        const parent = PANELS.find(x => x.id === route.p);
        const sibs = route.s ? parent.sub : PANELS;
        const idx = sibs.findIndex(x => x.id === (route.s || route.p));
        const n = sibs[idx + 1];
        if (!n) return;
        route = route.s ? { p: route.p, s: n.id } : { p: n.id };
        draw();
    }

    function onCardClick(e) {
        const card = e.target.closest('.htp-card');
        if (!card) return;
        go(card.dataset.goto);
    }

    return { open, back, next, go, draw, onCardClick,
             atContents: () => !route };
})();
