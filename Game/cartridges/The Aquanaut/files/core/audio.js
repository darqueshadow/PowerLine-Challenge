/* ========================================================
   THE AQUANAUT — BELOW THE BLACK — AUDIO MODULE
   Web Audio API synthesizer — dual-mode (Standard / Holodeck)
   Deep-sea horror soundscape
   ======================================================== */

const AudioManager = {
    ctx: null,
    mode: 'standard',          // 'standard' | 'holodeck'
    masterGain: null,
    noiseBuffer: null,
    activeSounds: 0,
    maxConcurrent: 8,
    lastTypingTime: 0,
    typingThrottle: 50,        // ms between typing sounds
    initialized: false,

    // ── Hybrid sample layer ──
    // Map an event name to a sound file to OVERRIDE its synth voice in STANDARD
    // mode (Holodeck always stays pure synth — it's the digital theme). Missing
    // or failed files are skipped silently and the synth plays instead, so this
    // list can be partial (mirrors how MUSIC tolerates missing tracks). Drop
    // files into files/assets/sfx/ and add a line here to use them.
    //   gain     — playback level (0–1), multiplied by masterGain
    //   pitchVar — ± random playbackRate spread (0.06 = ±6%) to avoid machine-gun
    // Leave high-frequency sounds (typing/fire) on the synth — samples repeat
    // audibly when fired rapidly; the synth's per-call pitch jitter sounds better.
    sampleSpecs: {
        // hit:      { url: 'assets/sfx/hit.wav',      gain: 1.0, pitchVar: 0.10 },
        // jawSnap:  { url: 'assets/sfx/jaw_snap.wav', gain: 1.0, pitchVar: 0.04 },
        // implosion:{ url: 'assets/sfx/implosion.wav',gain: 1.0, pitchVar: 0.0  },
    },
    samples: {},               // decoded AudioBuffer cache keyed by event name
    _samplesLoaded: false,

    // ── Lazy init (call on first user gesture) ──
    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.35;
            this.masterGain.connect(this.ctx.destination);
            this._createNoiseBuffer();
            this.initialized = true;
            this.loadSamples();     // fire-and-forget; no-op if sampleSpecs is empty
            this._preloadScenes();  // warm the menu/game-over/launch buffers
        } catch (e) {
            console.warn('[AudioManager] Web Audio not available:', e.message);
        }
    },

    // ── Fetch + decode declared samples (safe to call repeatedly) ──
    async loadSamples() {
        if (!this.ctx) return;
        const specs = this.sampleSpecs || {};
        await Promise.all(Object.keys(specs).map(async (event) => {
            try {
                const res = await fetch(specs[event].url);
                if (!res.ok) return;                       // 404 → synth fallback
                const data = await res.arrayBuffer();
                this.samples[event] = await this.ctx.decodeAudioData(data);
            } catch (e) { /* missing/undecodable file → synth fallback */ }
        }));
        this._samplesLoaded = true;
    },

    // ── Play a decoded sample (pitch jitter + concurrency guard) ──
    _playSample(event) {
        const buf = this.samples[event];
        if (!buf) return false;
        const spec = this.sampleSpecs[event] || {};
        if (!this._track(buf.duration * 1000)) return true;  // dropped, but handled
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        if (spec.pitchVar) {
            src.playbackRate.value = 1 + (Math.random() * 2 - 1) * spec.pitchVar;
        }
        const g = this._gain(spec.gain != null ? spec.gain : 1);
        src.connect(g);
        src.start(this.ctx.currentTime);
        return true;
    },

    // ── Mode switch ──
    setMode(mode) {
        this.mode = mode;
    },

    // ── Volume control ──
    setVolume(v) {
        if (this.masterGain) this.masterGain.gain.value = Math.max(0, Math.min(1, v));
    },

    // ── White noise buffer (created once) ──
    _createNoiseBuffer() {
        const len = this.ctx.sampleRate * 2;
        this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    },

    // ── Concurrency guard ──
    _track(duration) {
        if (this.activeSounds >= this.maxConcurrent) return false;
        this.activeSounds++;
        setTimeout(() => { this.activeSounds = Math.max(0, this.activeSounds - 1); }, duration);
        return true;
    },

    // ── Main dispatcher ──
    play(event) {
        if (!this.initialized || !this.ctx) return;
        if (this._sfxMuted) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        if (this.mode === 'holodeck') {
            this._playHolodeck(event);
        } else {
            this._playStandard(event);
        }
    },

    // ============================================
    // STANDARD MODE — deep-sea / underwater horror
    // ============================================

    _playStandard(event) {
        // Hybrid: if a sample is loaded for this event, it overrides the synth.
        if (this.samples[event] && this._playSample(event)) return;
        const t = this.ctx.currentTime;
        switch (event) {
            case 'typing':       this._stdTyping(t, false); break;
            case 'typingDelete': this._stdTyping(t, true); break;
            case 'fire':         this._stdFire(t); break;
            case 'hit':          this._stdHit(t); break;
            case 'misfire':      this._stdMisfire(t); break;
            case 'targetImpact': this._stdTargetImpact(t); break;
            case 'shieldHit':
            case 'hullHit':      this._stdHullHit(t); break;
            case 'shieldDown':
            case 'hullBreach':   this._stdHullBreach(t); break;
            case 'towerDown':
            case 'bellBreach':   this._stdBellBreach(t); break;
            case 'spawn':        this._stdSpawn(t); break;
            case 'gameOver':     this._stdGameOver(t); break;
            case 'latch':        this._stdLatch(t); break;
            case 'unlatch':      this._stdUnlatch(t); break;
            case 'rovArrival':   this._stdRovArrival(t); break;
            case 'rovDestroyed': this._stdRovDestroyed(t); break;
            case 'salvage':      this._stdSalvage(t); break;
            case 'hoseDown':     this._stdHoseDown(t); break;
            case 'killCamStart': this._stdKillCamStart(t); break;
            case 'heartbeat':    this._stdHeartbeat(t); break;
            case 'misfireAlarm': this._stdMisfireAlarm(t); break;
            case 'diverAlarm':   this._stdDiverAlarm(t); break;
            // ── v2 kill-cam / death sequence events ──
            case 'glassCrack':   this._stdGlassCrack(t); break;
            case 'metalGroan':   this._stdMetalGroan(t); break;
            case 'implosion':    this._stdImplosion(t); break;
            case 'jawSnap':      this._stdJawSnap(t); break;
            case 'tentacle':     this._stdTentacle(t); break;
            case 'hullCreak':    this._stdHullCreak(t); break;
        }
    },

    // ── Hull creak: soft low groan + faint metallic tick (depth ambience, §9) ──
    _stdHullCreak(t) {
        if (!this._track(1100)) return;
        const dur = 0.6 + Math.random() * 0.6;
        const g = this._gain(0.05);
        const f = this._filter('lowpass', 320, 4);
        const base = 60 + Math.random() * 34;
        const o = this._osc('sawtooth', base, f);
        f.connect(g);
        o.frequency.setValueAtTime(base, t);
        o.frequency.linearRampToValueAtTime(base * 0.82, t + dur);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.05, t + 0.18);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.start(t); o.stop(t + dur + 0.05);

        const g2 = this._gain(0.018);
        const f2 = this._filter('bandpass', 1100 + Math.random() * 500, 6);
        const n = this._noise(f2);
        f2.connect(g2);
        g2.gain.setValueAtTime(0.018, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        n.start(t); n.stop(t + 0.15);
    },

    // ============================================
    // AMBIENT PRESSURE BED (§9) — continuous, depth-scaled. Standard mode only.
    // A low beating drone + muffled water wash; deeper = lower, swells, more muffled.
    // ============================================
    _ambient: null,

    startAmbient() {
        if (!this.initialized || !this.ctx || this._sfxMuted) return;
        if (this.mode !== 'standard') return;     // holodeck is the digital theme
        if (this._ambient) return;
        try {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            const t = this.ctx.currentTime;
            const out = this.ctx.createGain();
            out.gain.value = 0.0001;
            out.connect(this.masterGain);

            const droneFilter = this.ctx.createBiquadFilter();
            droneFilter.type = 'lowpass';
            droneFilter.frequency.value = 220; droneFilter.Q.value = 0.6;
            droneFilter.connect(out);
            const o1 = this.ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 58; o1.connect(droneFilter);
            const o2 = this.ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 87; o2.connect(droneFilter); // gentle beating

            const nFilter = this.ctx.createBiquadFilter();
            nFilter.type = 'lowpass'; nFilter.frequency.value = 500; nFilter.Q.value = 0.5;
            const nGain = this.ctx.createGain(); nGain.gain.value = 0.04;
            nFilter.connect(nGain); nGain.connect(out);
            const n = this.ctx.createBufferSource(); n.buffer = this.noiseBuffer; n.loop = true; n.connect(nFilter);

            o1.start(t); o2.start(t); n.start(t);
            out.gain.setValueAtTime(0.0001, t);
            out.gain.linearRampToValueAtTime(0.11, t + 1.8);   // click-free fade-in
            this._ambient = { out, o1, o2, n, droneFilter, nFilter };
        } catch (e) { this._ambient = null; }
    },

    setAmbientDepth(dr) {
        if (!this._ambient || !this.ctx) return;
        dr = Math.max(0, Math.min(1, dr));
        const t = this.ctx.currentTime;
        const a = this._ambient;
        try {
            a.out.gain.setTargetAtTime(0.10 + 0.10 * dr, t, 0.8);   // swells with depth
            a.droneFilter.frequency.setTargetAtTime(240 - 120 * dr, t, 0.8); // muffle highs
            a.o1.frequency.setTargetAtTime(58 - 12 * dr, t, 1.0);   // sinks in pitch
            a.o2.frequency.setTargetAtTime(87 - 16 * dr, t, 1.0);
            a.nFilter.frequency.setTargetAtTime(500 - 250 * dr, t, 0.8);
        } catch (e) { /* node torn down mid-call */ }
    },

    stopAmbient() {
        if (!this._ambient || !this.ctx) return;
        const a = this._ambient;
        this._ambient = null;
        try {
            const t = this.ctx.currentTime;
            a.out.gain.cancelScheduledValues(t);
            a.out.gain.setValueAtTime(a.out.gain.value, t);
            a.out.gain.linearRampToValueAtTime(0.0001, t + 0.4);   // click-free fade-out
            a.o1.stop(t + 0.5); a.o2.stop(t + 0.5); a.n.stop(t + 0.5);
        } catch (e) { /* already stopped */ }
    },

    // ── Typing: soft wet sonar-console keystroke ──
    //   isDelete=false → bright blip chirping up   (character entered)
    //   isDelete=true  → low dull blip dropping down (backspace/delete)
    _stdTyping(t, isDelete) {
        const now = performance.now();
        if (now - this.lastTypingTime < this.typingThrottle) return;
        this.lastTypingTime = now;
        if (!this._track(80)) return;

        // Main blip — inserts sit high & bright, deletes drop low & dull
        const base = isDelete ? 360 : 760;
        const span = isDelete ? 140 : 360;
        const freq = base + Math.random() * span;
        const vol  = isDelete ? 0.05 : 0.06;
        const g = this._gain(vol);
        const o = this._osc('sine', freq, g);
        o.frequency.exponentialRampToValueAtTime(freq * (isDelete ? 0.8 : 1.18), t + 0.03);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
        o.start(t);
        o.stop(t + 0.055);

        // Key-contact tick — tiny high-noise transient for crispness
        const gN = this._gain(0.018);
        const f = this._filter('highpass', 3500, 0.7);
        const n = this._noise(f);
        f.connect(gN);
        gN.gain.setValueAtTime(0.018, t);
        gN.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
        n.start(t);
        n.stop(t + 0.03);
    },

    // ── Fire (sonar pulse): launch thunk + water whoosh + submarine ping ──
    _stdFire(t) {
        if (!this._track(350)) return;

        // Launch thunk — low body so the shot has weight, not just a ping
        const gL = this._gain(0.12);
        const oL = this._osc('sine', 190, gL);
        oL.frequency.exponentialRampToValueAtTime(70, t + 0.09);
        gL.gain.setValueAtTime(0.12, t);
        gL.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        oL.start(t);
        oL.stop(t + 0.14);

        // Water-displacement whoosh — short filtered noise sweeping down
        const gW = this._gain(0.07);
        const fW = this._filter('bandpass', 1200, 1.2);
        const nW = this._noise(fW);
        fW.connect(gW);
        fW.frequency.setValueAtTime(1800, t);
        fW.frequency.exponentialRampToValueAtTime(500, t + 0.12);
        gW.gain.setValueAtTime(0.07, t);
        gW.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
        nW.start(t);
        nW.stop(t + 0.15);

        // Primary ping — sine sweep down (the signature sonar voice)
        const g = this._gain(0.14);
        const o = this._osc('sine', 2000, g);
        o.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
        g.gain.setValueAtTime(0.14, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.start(t);
        o.stop(t + 0.35);

        // Subtle harmonic overtone for richness
        const g2 = this._gain(0.04);
        const o2 = this._osc('sine', 4000, g2);
        o2.frequency.exponentialRampToValueAtTime(2400, t + 0.08);
        g2.gain.setValueAtTime(0.04, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        o2.start(t);
        o2.stop(t + 0.2);
    },

    // ── Hit: deep thud + mid thwack + bubble burst + kill-confirm sparkle ──
    _stdHit(t) {
        if (!this._track(300)) return;

        // Low thud — the body of the impact
        const g1 = this._gain(0.15);
        const o = this._osc('sine', 80, g1);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
        g1.gain.setValueAtTime(0.15, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o.start(t);
        o.stop(t + 0.3);

        // Mid 'thwack' — punchy snap so the hit lands, not just thuds
        const gM = this._gain(0.12);
        const fM = this._filter('bandpass', 1400, 1.4);
        const nM = this._noise(fM);
        fM.connect(gM);
        gM.gain.setValueAtTime(0.12, t);
        gM.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        nM.start(t);
        nM.stop(t + 0.07);

        // Bubble burst — short filtered noise
        const g2 = this._gain(0.1);
        const f = this._filter('bandpass', 1500, 3);
        const n = this._noise(f);
        f.connect(g2);
        g2.gain.setValueAtTime(0.1, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        n.start(t);
        n.stop(t + 0.08);

        // Kill-confirm sparkle — quick high blip chirping up on top
        const g3 = this._gain(0.05);
        const o3 = this._osc('sine', 1600, g3);
        o3.frequency.exponentialRampToValueAtTime(2200, t + 0.06);
        g3.gain.setValueAtTime(0.05, t);
        g3.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        o3.start(t);
        o3.stop(t + 0.1);
    },

    // ── Misfire (pressure spike): dissonant error stab + metallic groan ──
    _stdMisfire(t) {
        if (!this._track(500)) return;

        // Dissonant error stab — two clashing tones, sharp attack ("wrong")
        [110, 116.5].forEach((freq) => {
            const gs = this._gain(0.09);
            const os = this._osc('sawtooth', freq, gs);
            gs.gain.setValueAtTime(0.001, t);
            gs.gain.linearRampToValueAtTime(0.09, t + 0.008);
            gs.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            os.start(t);
            os.stop(t + 0.2);
        });

        // Low ominous sawtooth
        const g = this._gain(0.1);
        const o = this._osc('sawtooth', 50, g);
        o.frequency.setValueAtTime(50, t);
        o.frequency.linearRampToValueAtTime(40, t + 0.2);
        o.frequency.linearRampToValueAtTime(60, t + 0.35);
        o.frequency.linearRampToValueAtTime(38, t + 0.45);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.1, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        o.start(t);
        o.stop(t + 0.5);

        // Filtered noise for creaking texture
        const g2 = this._gain(0.04);
        const f = this._filter('bandpass', 200, 5);
        const n = this._noise(f);
        f.connect(g2);
        g2.gain.setValueAtTime(0.04, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        n.start(t);
        n.stop(t + 0.45);
    },

    // ── Misfire Alarm (rebreather jam): harsh repeating klaxon ──
    _stdMisfireAlarm(t) {
        if (!this._track(800)) return;

        // Two-tone klaxon — alternating pitches
        for (let i = 0; i < 3; i++) {
            const offset = i * 0.25;
            const g = this._gain(0.12);
            const o = this._osc('square', i % 2 === 0 ? 440 : 330, g);
            g.gain.setValueAtTime(0.12, t + offset);
            g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.2);
            o.start(t + offset);
            o.stop(t + offset + 0.22);
        }
    },

    // ── Diver-attack alarm: frantic rising klaxon (PLACEHOLDER — tune later) ──
    _stdDiverAlarm(t) {
        if (!this._track(900)) return;

        // Fast rising two-tone klaxon — more frantic than the misfire jam
        for (let i = 0; i < 4; i++) {
            const offset = i * 0.18;
            const g = this._gain(0.13);
            const o = this._osc('square', i % 2 === 0 ? 520 : 660, g);
            o.frequency.linearRampToValueAtTime(i % 2 === 0 ? 600 : 760, t + offset + 0.14);
            g.gain.setValueAtTime(0.13, t + offset);
            g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.15);
            o.start(t + offset);
            o.stop(t + offset + 0.17);
        }

        // Tension swell underneath
        const g2 = this._gain(0.06);
        const f = this._filter('bandpass', 1200, 1.5);
        const n = this._noise(f);
        f.connect(g2);
        g2.gain.setValueAtTime(0.001, t);
        g2.gain.linearRampToValueAtTime(0.06, t + 0.4);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
        n.start(t);
        n.stop(t + 0.9);
    },

    // ── Target Impact (creature reaches hose): wet tearing/crunch ──
    _stdTargetImpact(t) {
        if (!this._track(500)) return;

        // Descending tone — tearing feel
        const g1 = this._gain(0.18);
        const o = this._osc('sawtooth', 300, g1);
        o.frequency.exponentialRampToValueAtTime(60, t + 0.3);
        g1.gain.setValueAtTime(0.18, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        o.start(t);
        o.stop(t + 0.45);

        // Crunching noise burst
        const g2 = this._gain(0.15);
        const f = this._filter('bandpass', 800, 2);
        const n = this._noise(f);
        f.connect(g2);
        g2.gain.setValueAtTime(0.15, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        n.start(t);
        n.stop(t + 0.2);

        // Secondary wet noise
        const g3 = this._gain(0.08);
        const f2 = this._filter('lowpass', 400, 1);
        const n2 = this._noise(f2);
        f2.connect(g3);
        g3.gain.setValueAtTime(0.001, t + 0.05);
        g3.gain.linearRampToValueAtTime(0.08, t + 0.1);
        g3.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        n2.start(t + 0.05);
        n2.stop(t + 0.4);
    },

    // ── Hull Hit: metal stress creak — detuned dissonance ──
    _stdHullHit(t) {
        if (!this._track(350)) return;

        // Two detuned tones for dissonant creak
        const g1 = this._gain(0.09);
        const o1 = this._osc('sine', 200, g1);
        g1.gain.setValueAtTime(0.09, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o1.start(t);
        o1.stop(t + 0.35);

        const g2 = this._gain(0.09);
        const o2 = this._osc('sine', 207, g2);
        g2.gain.setValueAtTime(0.09, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o2.start(t);
        o2.stop(t + 0.35);

        // Metallic creak texture
        const g3 = this._gain(0.03);
        const f = this._filter('bandpass', 3000, 8);
        const n = this._noise(f);
        f.connect(g3);
        g3.gain.setValueAtTime(0.001, t);
        g3.gain.linearRampToValueAtTime(0.03, t + 0.05);
        g3.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        n.start(t);
        n.stop(t + 0.25);
    },

    // ── Hull Breach: pressure alarm — submarine klaxon ──
    _stdHullBreach(t) {
        if (!this._track(800)) return;

        const g = this._gain(0.14);
        const o = this._osc('square', 440, g);
        // Alternating klaxon tones: 440→220→440→220
        o.frequency.setValueAtTime(440, t);
        o.frequency.setValueAtTime(220, t + 0.15);
        o.frequency.setValueAtTime(440, t + 0.3);
        o.frequency.setValueAtTime(220, t + 0.45);
        g.gain.setValueAtTime(0.14, t);
        g.gain.setValueAtTime(0.14, t + 0.55);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
        o.start(t);
        o.stop(t + 0.75);

        // Low pressure undertone
        const g2 = this._gain(0.06);
        const o2 = this._osc('sine', 55, g2);
        g2.gain.setValueAtTime(0.06, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
        o2.start(t);
        o2.stop(t + 0.75);
    },

    // ── Bell Breach: deep implosion — massive low boom ──
    _stdBellBreach(t) {
        if (!this._track(1200)) return;

        // Massive sub-bass boom
        const g1 = this._gain(0.3);
        const o = this._osc('sine', 25, g1);
        o.frequency.exponentialRampToValueAtTime(15, t + 0.8);
        g1.gain.setValueAtTime(0.3, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
        o.start(t);
        o.stop(t + 1.1);

        // Pressure collapse noise
        const g2 = this._gain(0.18);
        const f = this._filter('lowpass', 300, 1);
        const n = this._noise(f);
        f.connect(g2);
        g2.gain.setValueAtTime(0.18, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        n.start(t);
        n.stop(t + 0.9);

        // Metallic shudder overtone
        const g3 = this._gain(0.06);
        const o2 = this._osc('sawtooth', 80, g3);
        o2.frequency.exponentialRampToValueAtTime(30, t + 0.6);
        g3.gain.setValueAtTime(0.001, t);
        g3.gain.linearRampToValueAtTime(0.06, t + 0.1);
        g3.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
        o2.start(t);
        o2.stop(t + 0.8);
    },

    // ── Spawn (creature appears): sonar ping — classic submarine contact ping ──
    _stdSpawn(t) {
        if (!this._track(800)) return;

        // Primary ping — clean sine at ~1.5kHz, short and sharp
        const pingFreq = 1400 + Math.random() * 200;
        const g1 = this._gain(0.08);
        const o1 = this._osc('sine', pingFreq, g1);
        g1.gain.setValueAtTime(0.001, t);
        g1.gain.linearRampToValueAtTime(0.08, t + 0.01);
        g1.gain.exponentialRampToValueAtTime(0.02, t + 0.15);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        o1.start(t);
        o1.stop(t + 0.65);

        // Reverb tail — lower octave echo
        const g2 = this._gain(0.03);
        const o2 = this._osc('sine', pingFreq * 0.5, g2);
        g2.gain.setValueAtTime(0.001, t + 0.05);
        g2.gain.linearRampToValueAtTime(0.03, t + 0.1);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
        o2.start(t + 0.05);
        o2.stop(t + 0.75);
    },

    // ── Game Over: descending bubbles + fading low drone ──
    _stdGameOver(t) {
        if (!this._track(2500)) return;

        // Descending bubble pops
        const bubbleFreqs = [1200, 1000, 800, 600, 400, 250];
        bubbleFreqs.forEach((freq, i) => {
            const g = this._gain(0.07);
            const o = this._osc('sine', freq, g);
            const start = t + i * 0.3;
            o.frequency.exponentialRampToValueAtTime(freq * 0.6, start + 0.15);
            g.gain.setValueAtTime(0.07, start);
            g.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
            o.start(start);
            o.stop(start + 0.25);
        });

        // Fading low drone underneath
        const gDrone = this._gain(0.1);
        const oDrone = this._osc('sine', 60, gDrone);
        oDrone.frequency.exponentialRampToValueAtTime(30, t + 2.0);
        gDrone.gain.setValueAtTime(0.1, t);
        gDrone.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
        oDrone.start(t);
        oDrone.stop(t + 2.3);

        // Watery filtered noise fading out
        const gN = this._gain(0.06);
        const f = this._filter('lowpass', 600, 1);
        const n = this._noise(f);
        f.connect(gN);
        gN.gain.setValueAtTime(0.06, t);
        gN.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
        n.start(t);
        n.stop(t + 2.1);
    },

    // ── Latch: wet sucking/constricting ──
    _stdLatch(t) {
        if (!this._track(500)) return;

        // Filtered noise — ominous wet suction
        const g1 = this._gain(0.12);
        const f = this._filter('bandpass', 500, 3);
        const n = this._noise(f);
        f.connect(g1);
        f.frequency.setValueAtTime(500, t);
        f.frequency.exponentialRampToValueAtTime(200, t + 0.3);
        g1.gain.setValueAtTime(0.001, t);
        g1.gain.linearRampToValueAtTime(0.12, t + 0.05);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        n.start(t);
        n.stop(t + 0.45);

        // Low constricting tone
        const g2 = this._gain(0.08);
        const o = this._osc('sine', 90, g2);
        o.frequency.exponentialRampToValueAtTime(50, t + 0.3);
        g2.gain.setValueAtTime(0.08, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        o.start(t);
        o.stop(t + 0.4);
    },

    // ── Unlatch: release pop + rising tone ──
    _stdUnlatch(t) {
        if (!this._track(300)) return;

        // Pop
        const g1 = this._gain(0.1);
        const o = this._osc('sine', 300, g1);
        o.frequency.exponentialRampToValueAtTime(800, t + 0.08);
        g1.gain.setValueAtTime(0.1, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o.start(t);
        o.stop(t + 0.15);

        // Short noise burst
        const g2 = this._gain(0.06);
        const f = this._filter('highpass', 1000, 1);
        const n = this._noise(f);
        f.connect(g2);
        g2.gain.setValueAtTime(0.06, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        n.start(t);
        n.stop(t + 0.08);
    },

    // ── ROV Arrival: mechanical whir — rising sawtooth with modulation ──
    _stdRovArrival(t) {
        if (!this._track(600)) return;

        const g = this._gain(0.08);
        const o = this._osc('sawtooth', 120, g);
        o.frequency.exponentialRampToValueAtTime(400, t + 0.4);

        // Modulation for motor whir
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.value = 12;
        lfoGain.gain.value = 30;
        lfo.connect(lfoGain);
        lfoGain.connect(o.frequency);

        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.08, t + 0.15);
        g.gain.setValueAtTime(0.08, t + 0.35);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        o.start(t);
        lfo.start(t);
        o.stop(t + 0.6);
        lfo.stop(t + 0.6);
    },

    // ── ROV Destroyed: descending grind + explosion ──
    _stdRovDestroyed(t) {
        if (!this._track(700)) return;

        // Descending mechanical grind
        const g1 = this._gain(0.12);
        const o = this._osc('sawtooth', 400, g1);
        o.frequency.exponentialRampToValueAtTime(50, t + 0.5);
        g1.gain.setValueAtTime(0.12, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        o.start(t);
        o.stop(t + 0.6);

        // Impact noise
        const g2 = this._gain(0.15);
        const f = this._filter('lowpass', 500, 1);
        const n = this._noise(f);
        f.connect(g2);
        g2.gain.setValueAtTime(0.001, t + 0.1);
        g2.gain.linearRampToValueAtTime(0.15, t + 0.15);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        n.start(t + 0.1);
        n.stop(t + 0.55);
    },

    // ── Salvage: bright satisfying ding ──
    _stdSalvage(t) {
        if (!this._track(300)) return;

        const g1 = this._gain(0.1);
        const o1 = this._osc('sine', 1500, g1);
        g1.gain.setValueAtTime(0.1, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o1.start(t);
        o1.stop(t + 0.3);

        // Harmonic overtone for shimmer
        const g2 = this._gain(0.05);
        const o2 = this._osc('sine', 3000, g2);
        g2.gain.setValueAtTime(0.05, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        o2.start(t);
        o2.stop(t + 0.2);
    },

    // ── Hose Down: tearing + pressure release ──
    _stdHoseDown(t) {
        if (!this._track(600)) return;

        // Hissing pressure release
        const g1 = this._gain(0.14);
        const f = this._filter('highpass', 2000, 1);
        const n = this._noise(f);
        f.connect(g1);
        g1.gain.setValueAtTime(0.14, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        n.start(t);
        n.stop(t + 0.55);

        // Low snap tone
        const g2 = this._gain(0.12);
        const o = this._osc('sawtooth', 150, g2);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
        g2.gain.setValueAtTime(0.12, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.start(t);
        o.stop(t + 0.35);
    },

    // ── Kill Cam Start: low rumble — creeping dread ──
    _stdKillCamStart(t) {
        if (!this._track(2000)) return;

        // Deep sub-bass rumble
        const g1 = this._gain(0.15);
        const o = this._osc('sine', 30, g1);
        o.frequency.linearRampToValueAtTime(20, t + 1.5);
        g1.gain.setValueAtTime(0.001, t);
        g1.gain.linearRampToValueAtTime(0.15, t + 0.5);
        g1.gain.setValueAtTime(0.15, t + 1.2);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
        o.start(t);
        o.stop(t + 2.0);

        // Filtered rumble noise
        const g2 = this._gain(0.06);
        const f = this._filter('lowpass', 120, 2);
        const n = this._noise(f);
        f.connect(g2);
        g2.gain.setValueAtTime(0.001, t);
        g2.gain.linearRampToValueAtTime(0.06, t + 0.4);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
        n.start(t);
        n.stop(t + 1.9);
    },

    // ── Heartbeat: slow deep double-thump ──
    _stdHeartbeat(t) {
        if (!this._track(600)) return;

        // First beat (louder)
        const g1 = this._gain(0.18);
        const o1 = this._osc('sine', 45, g1);
        g1.gain.setValueAtTime(0.18, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o1.start(t);
        o1.stop(t + 0.15);

        // Second beat (softer, slightly delayed)
        const g2 = this._gain(0.12);
        const o2 = this._osc('sine', 40, g2);
        g2.gain.setValueAtTime(0.12, t + 0.15);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.27);
        o2.start(t + 0.15);
        o2.stop(t + 0.3);
    },

    // ── Glass Crack: sharp snap + crystalline ring + stress fizz ──
    _stdGlassCrack(t) {
        if (!this._track(700)) return;

        // The snap — broadband noise burst, very short
        const g1 = this._gain(0.22);
        const f1 = this._filter('highpass', 1800, 1);
        const n1 = this._noise(f1);
        f1.connect(g1);
        g1.gain.setValueAtTime(0.22, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
        n1.start(t);
        n1.stop(t + 0.09);

        // Crystalline ring — two detuned high sines decaying
        [3400, 5200].forEach((freq, i) => {
            const g = this._gain(0.07 - i * 0.02);
            const o = this._osc('sine', freq + Math.random() * 200, g);
            o.frequency.exponentialRampToValueAtTime(freq * 0.92, t + 0.4);
            g.gain.setValueAtTime(0.07 - i * 0.02, t + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
            o.start(t + 0.01);
            o.stop(t + 0.5);
        });

        // Stress fizz — quiet crackle tail
        const g3 = this._gain(0.05);
        const f3 = this._filter('bandpass', 4000, 8);
        const n3 = this._noise(f3);
        f3.connect(g3);
        g3.gain.setValueAtTime(0.05, t + 0.05);
        g3.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        n3.start(t + 0.05);
        n3.stop(t + 0.65);
    },

    // ── Metal Groan: hull under pressure — slow detuned moan ──
    _stdMetalGroan(t) {
        if (!this._track(1800)) return;

        // Two detuned low saws sliding against each other
        [52, 57].forEach((freq, i) => {
            const g = this._gain(0.07);
            const o = this._osc('sawtooth', freq, g);
            o.frequency.linearRampToValueAtTime(freq - 14 + i * 6, t + 1.2);
            g.gain.setValueAtTime(0.001, t);
            g.gain.linearRampToValueAtTime(0.07, t + 0.3);
            g.gain.setValueAtTime(0.07, t + 0.9);
            g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
            o.start(t);
            o.stop(t + 1.7);
        });

        // Creaking texture — resonant noise
        const g2 = this._gain(0.05);
        const f2 = this._filter('bandpass', 300, 12);
        const n2 = this._noise(f2);
        f2.connect(g2);
        g2.gain.setValueAtTime(0.001, t);
        g2.gain.linearRampToValueAtTime(0.05, t + 0.5);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
        n2.start(t);
        n2.stop(t + 1.6);
    },

    // ── Implosion: deep concussion + water roar + ear-ring ──
    _stdImplosion(t) {
        if (!this._track(2500)) return;

        // Sub-bass concussion — hard drop
        const g1 = this._gain(0.3);
        const o1 = this._osc('sine', 120, g1);
        o1.frequency.exponentialRampToValueAtTime(24, t + 0.5);
        g1.gain.setValueAtTime(0.3, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
        o1.start(t);
        o1.stop(t + 1.1);

        // Water roar — heavy lowpassed noise swelling then drowning out
        const g2 = this._gain(0.001);
        const f2 = this._filter('lowpass', 900, 1);
        const n2 = this._noise(f2);
        f2.connect(g2);
        g2.gain.setValueAtTime(0.001, t);
        g2.gain.linearRampToValueAtTime(0.2, t + 0.12);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
        n2.start(t);
        n2.stop(t + 2.1);

        // Glass burst transient
        const g3 = this._gain(0.18);
        const f3 = this._filter('highpass', 2500, 1);
        const n3 = this._noise(f3);
        f3.connect(g3);
        g3.gain.setValueAtTime(0.18, t);
        g3.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        n3.start(t);
        n3.stop(t + 0.15);

        // Ear-ring aftermath — thin high sine lingering
        const g4 = this._gain(0.001);
        const o4 = this._osc('sine', 2900, g4);
        g4.gain.setValueAtTime(0.001, t + 0.3);
        g4.gain.linearRampToValueAtTime(0.04, t + 0.5);
        g4.gain.exponentialRampToValueAtTime(0.001, t + 2.3);
        o4.start(t + 0.3);
        o4.stop(t + 2.4);
    },

    // ── Jaw Snap: heavy bite — thump + wet click ──
    _stdJawSnap(t) {
        if (!this._track(450)) return;

        // Jaw slam — punchy low thump
        const g1 = this._gain(0.26);
        const o1 = this._osc('sine', 140, g1);
        o1.frequency.exponentialRampToValueAtTime(45, t + 0.09);
        g1.gain.setValueAtTime(0.26, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        o1.start(t);
        o1.stop(t + 0.2);

        // Teeth click — tight noise tick
        const g2 = this._gain(0.14);
        const f2 = this._filter('bandpass', 2600, 6);
        const n2 = this._noise(f2);
        f2.connect(g2);
        g2.gain.setValueAtTime(0.14, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        n2.start(t);
        n2.stop(t + 0.07);

        // Water displacement whoosh
        const g3 = this._gain(0.08);
        const f3 = this._filter('lowpass', 500, 2);
        const n3 = this._noise(f3);
        f3.connect(g3);
        g3.gain.setValueAtTime(0.001, t);
        g3.gain.linearRampToValueAtTime(0.08, t + 0.04);
        g3.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        n3.start(t);
        n3.stop(t + 0.4);
    },

    // ── Tentacle: wet slither — slow squelching slide ──
    _stdTentacle(t) {
        if (!this._track(1200)) return;

        // Rubbery slide — resonant filtered noise gliding down
        const g1 = this._gain(0.07);
        const f1 = this._filter('bandpass', 800, 10);
        const n1 = this._noise(f1);
        f1.connect(g1);
        f1.frequency.setValueAtTime(800, t);
        f1.frequency.exponentialRampToValueAtTime(250, t + 0.9);
        g1.gain.setValueAtTime(0.001, t);
        g1.gain.linearRampToValueAtTime(0.07, t + 0.2);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
        n1.start(t);
        n1.stop(t + 1.1);

        // Suction pops — three quiet wet blips
        for (let i = 0; i < 3; i++) {
            const start = t + 0.15 + i * 0.28 + Math.random() * 0.08;
            const g = this._gain(0.05);
            const o = this._osc('sine', 320 + Math.random() * 120, g);
            o.frequency.exponentialRampToValueAtTime(110, start + 0.06);
            g.gain.setValueAtTime(0.05, start);
            g.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
            o.start(start);
            o.stop(start + 0.1);
        }
    },

    // ============================================
    // HOLODECK MODE — LCARS / TNG digital tones
    // ============================================

    _playHolodeck(event) {
        const t = this.ctx.currentTime;
        switch (event) {
            case 'typing':       this._holoTyping(t); break;
            case 'fire':         this._holoFire(t); break;
            case 'hit':          this._holoHit(t); break;
            case 'misfire':      this._holoMisfire(t); break;
            case 'targetImpact': this._holoTargetImpact(t); break;
            case 'shieldHit':
            case 'hullHit':      this._holoShieldHit(t); break;
            case 'shieldDown':
            case 'hullBreach':   this._holoShieldDown(t); break;
            case 'towerDown':
            case 'bellBreach':   this._holoTowerDown(t); break;
            case 'spawn':        this._holoSpawn(t); break;
            case 'lcarsButton':  this._holoLcarsButton(t); break;
            case 'gameOver':     this._holoGameOver(t); break;
            // New events fall through to simple holodeck tones
            case 'latch':        this._holoTargetImpact(t); break;
            case 'unlatch':      this._holoHit(t); break;
            case 'rovArrival':   this._holoSpawn(t); break;
            case 'rovDestroyed': this._holoTowerDown(t); break;
            case 'salvage':      this._holoHit(t); break;
            case 'hoseDown':     this._holoShieldDown(t); break;
            case 'killCamStart': this._holoTowerDown(t); break;
            case 'heartbeat':    this._holoLcarsButton(t); break;
            case 'misfireAlarm': this._holoMisfire(t); break;
            case 'diverAlarm':   this._holoMisfire(t); break;
            // ── v2 kill-cam / death sequence events ──
            case 'glassCrack':   this._holoMisfire(t); break;
            case 'metalGroan':   this._holoTowerDown(t); break;
            case 'implosion':    this._holoTowerDown(t); break;
            case 'jawSnap':      this._holoTargetImpact(t); break;
            case 'tentacle':     this._holoSpawn(t); break;
        }
    },

    // ── Typing: LCARS soft chirp 880Hz ──
    _holoTyping(t) {
        const now = performance.now();
        if (now - this.lastTypingTime < this.typingThrottle) return;
        this.lastTypingTime = now;
        if (!this._track(80)) return;

        const g = this._gain(0.06);
        const o = this._osc('sine', 880, g);
        g.gain.setValueAtTime(0.06, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        o.start(t);
        o.stop(t + 0.05);
    },

    // ── Fire: descending sine 1200→400Hz ──
    _holoFire(t) {
        if (!this._track(250)) return;
        const g = this._gain(0.1);
        const o = this._osc('sine', 1200, g);
        o.frequency.exponentialRampToValueAtTime(400, t + 0.18);
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        o.start(t);
        o.stop(t + 0.25);
    },

    // ── Hit: two-tone sine 600+800Hz ──
    _holoHit(t) {
        if (!this._track(200)) return;
        const g1 = this._gain(0.07);
        const o1 = this._osc('sine', 600, g1);
        g1.gain.setValueAtTime(0.07, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        o1.start(t);
        o1.stop(t + 0.18);

        const g2 = this._gain(0.07);
        const o2 = this._osc('sine', 800, g2);
        g2.gain.setValueAtTime(0.07, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        o2.start(t);
        o2.stop(t + 0.18);
    },

    // ── Misfire: descending three-tone ──
    _holoMisfire(t) {
        if (!this._track(400)) return;
        const tones = [600, 450, 300];
        tones.forEach((freq, i) => {
            const g = this._gain(0.08);
            const o = this._osc('sine', freq, g);
            const start = t + i * 0.1;
            g.gain.setValueAtTime(0.08, start);
            g.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
            o.start(start);
            o.stop(start + 0.1);
        });
    },

    // ── Target Impact: red alert 400/600Hz alternating ──
    _holoTargetImpact(t) {
        if (!this._track(600)) return;
        for (let i = 0; i < 4; i++) {
            const g = this._gain(0.1);
            const freq = i % 2 === 0 ? 400 : 600;
            const o = this._osc('sine', freq, g);
            const start = t + i * 0.12;
            g.gain.setValueAtTime(0.1, start);
            g.gain.exponentialRampToValueAtTime(0.001, start + 0.1);
            o.start(start);
            o.stop(start + 0.12);
        }
    },

    // ── Shield Hit: descending harmonic ──
    _holoShieldHit(t) {
        if (!this._track(250)) return;
        const g = this._gain(0.08);
        const o = this._osc('sine', 1000, g);
        o.frequency.exponentialRampToValueAtTime(300, t + 0.2);
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        o.start(t);
        o.stop(t + 0.25);
    },

    // ── Shield Down: LCARS critical ──
    _holoShieldDown(t) {
        if (!this._track(700)) return;
        const tones = [800, 600, 400, 800, 600, 400];
        tones.forEach((freq, i) => {
            const g = this._gain(0.09);
            const o = this._osc('sine', freq, g);
            const start = t + i * 0.1;
            g.gain.setValueAtTime(0.09, start);
            g.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
            o.start(start);
            o.stop(start + 0.1);
        });
    },

    // ── Tower Down: low rumble + high whine ──
    _holoTowerDown(t) {
        if (!this._track(1000)) return;
        const g1 = this._gain(0.12);
        const o1 = this._osc('sine', 80, g1);
        o1.frequency.exponentialRampToValueAtTime(40, t + 0.8);
        g1.gain.setValueAtTime(0.12, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        o1.start(t);
        o1.stop(t + 1.0);

        const g2 = this._gain(0.06);
        const o2 = this._osc('sine', 2000, g2);
        o2.frequency.exponentialRampToValueAtTime(3000, t + 0.8);
        g2.gain.setValueAtTime(0.001, t);
        g2.gain.linearRampToValueAtTime(0.06, t + 0.3);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        o2.start(t);
        o2.stop(t + 1.0);
    },

    // ── Spawn: sensor ping 1000Hz ──
    _holoSpawn(t) {
        if (!this._track(300)) return;
        const g = this._gain(0.05);
        const o = this._osc('sine', 1000, g);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.05, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o.start(t);
        o.stop(t + 0.3);
    },

    // ── LCARS Button: TNG touch panel 1400Hz ──
    _holoLcarsButton(t) {
        if (!this._track(200)) return;
        const g = this._gain(0.08);
        const o = this._osc('sine', 1400, g);
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o.start(t);
        o.stop(t + 0.15);

        const g2 = this._gain(0.04);
        const o2 = this._osc('sine', 700, g2);
        g2.gain.setValueAtTime(0.04, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o2.start(t);
        o2.stop(t + 0.12);
    },

    // ── Game Over: LCARS shutdown ──
    _holoGameOver(t) {
        if (!this._track(1500)) return;
        const notes = [800, 700, 500, 350, 200];
        notes.forEach((freq, i) => {
            const g = this._gain(0.08);
            const o = this._osc('sine', freq, g);
            const start = t + i * 0.3;
            g.gain.setValueAtTime(0.08, start);
            g.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
            o.start(start);
            o.stop(start + 0.3);
        });
    },

    // ============================================
    // HELPER FACTORIES
    // ============================================

    _gain(vol) {
        const g = this.ctx.createGain();
        g.gain.value = vol;
        g.connect(this.masterGain);
        return g;
    },

    _osc(type, freq, dest) {
        const o = this.ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        o.connect(dest);
        return o;
    },

    _noise(dest) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        src.connect(dest);
        return src;
    },

    _filter(type, freq, Q) {
        const f = this.ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = Q || 1;
        return f;
    },

    // ============================================
    // MUSIC PLAYBACK (HTML5 Audio for streaming MP3)
    // ============================================
    _musicEl: null,
    _musicOnEnded: null,
    _musicMuted: false,
    _sfxMuted: false,

    /**
     * Play a music track.
     * @param {string} src  - path to the MP3 file
     * @param {Object} opts - { loop, volume, onEnded, startTime }
     */
    playMusic(src, opts = {}) {
        this.stopMusic();
        const el = new Audio(src);
        el.loop = !!opts.loop;
        el.volume = this._musicMuted ? 0 : Math.max(0, Math.min(1, opts.volume ?? 0.5));
        if (typeof opts.onEnded === 'function') {
            this._musicOnEnded = opts.onEnded;
            el.addEventListener('ended', this._musicOnEnded);
        }
        if (opts.startTime) el.currentTime = opts.startTime;
        this._musicEl = el;

        el.play().catch(() => {
            // Autoplay blocked — retry on first user gesture
            const resume = () => {
                if (this._musicEl === el) el.play().catch(() => {});
                document.removeEventListener('keydown', resume);
                document.removeEventListener('click', resume);
                document.removeEventListener('touchstart', resume);
            };
            document.addEventListener('keydown', resume, { once: false });
            document.addEventListener('click', resume, { once: false });
            document.addEventListener('touchstart', resume, { once: false });
        });
    },

    /** Stop the currently playing music track. */
    stopMusic() {
        if (!this._musicEl) return;
        this._musicEl.pause();
        this._musicEl.currentTime = 0;
        if (this._musicOnEnded) {
            this._musicEl.removeEventListener('ended', this._musicOnEnded);
            this._musicOnEnded = null;
        }
        this._musicEl = null;
        this._playlist = null;
        this._playlistRemaining = null;
    },

    // ============================================
    // SHUFFLE PLAYLIST (play all tracks before repeating)
    // ============================================
    _playlist: null,
    _playlistRemaining: null,

    /**
     * Start a shuffled playlist. Picks a random track, and when it ends
     * picks from the remaining unplayed tracks. Only repeats after all
     * tracks have been played.
     * @param {string[]} tracks - array of MP3 paths
     * @param {number}   volume - playback volume (0-1)
     */
    startPlaylist(tracks, volume = 0.5) {
        this._playlist = tracks.slice();
        this._playlistRemaining = [];
        this._playlistVolume = volume;
        this._playNextFromPlaylist();
    },

    _playNextFromPlaylist() {
        if (!this._playlist) return;
        // Refill remaining pool if empty
        if (!this._playlistRemaining || this._playlistRemaining.length === 0) {
            this._playlistRemaining = this._playlist.slice();
        }
        // Pick a random track from the remaining pool
        const idx = Math.floor(Math.random() * this._playlistRemaining.length);
        const track = this._playlistRemaining.splice(idx, 1)[0];
        this.playMusic(track, {
            loop: false,
            volume: this._playlistVolume,
            onEnded: () => this._playNextFromPlaylist()
        });
    },

    // ============================================
    // RADIO STATIC EFFECT (bell destroyed)
    // Flickers music volume + overlays static noise
    // ============================================
    _staticActive: false,
    _staticNoiseSource: null,
    _staticNoiseGain: null,
    _flickerTimeout: null,
    _savedVolume: 1,

    /**
     * Enable broken-radio effect: flicker music volume + overlay static noise.
     */
    enableMusicStatic() {
        if (this._staticActive) return;
        this._staticActive = true;

        // Save current volume so we can restore it
        if (this._musicEl) {
            this._savedVolume = this._musicEl.volume;
        }

        // Start noise overlay via Web Audio
        if (this.ctx && this.noiseBuffer) {
            if (this.ctx.state === 'suspended') this.ctx.resume();

            const noiseSource = this.ctx.createBufferSource();
            noiseSource.buffer = this.noiseBuffer;
            noiseSource.loop = true;

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.value = 0.12;

            noiseSource.connect(noiseGain);
            noiseGain.connect(this.masterGain);   // route through masterGain so the SFX mute + volume slider apply (every other SFX does)
            noiseSource.start();

            this._staticNoiseSource = noiseSource;
            this._staticNoiseGain = noiseGain;
        }

        // Start flicker loop — randomly mute/unmute music
        const flicker = () => {
            if (!this._staticActive || !this._musicEl) return;

            const muted = this._musicEl.volume < 0.01;
            if (muted) {
                // Restore volume for a random duration (80-400ms) — but honor a user
                // MUSIC-mute toggled mid-static (don't un-mute what they just silenced).
                this._musicEl.volume = this._musicMuted ? 0 : this._savedVolume;
                this._flickerTimeout = setTimeout(flicker, 80 + Math.random() * 320);
            } else {
                // Mute for a random duration (40-250ms)
                this._musicEl.volume = 0;
                this._flickerTimeout = setTimeout(flicker, 40 + Math.random() * 210);
            }
        };
        // Kick off the first flicker after a short delay
        this._flickerTimeout = setTimeout(flicker, 100 + Math.random() * 200);
    },

    /**
     * Disable radio static — restore clean music playback.
     */
    disableMusicStatic() {
        if (!this._staticActive) return;
        this._staticActive = false;

        // Stop flicker
        if (this._flickerTimeout) {
            clearTimeout(this._flickerTimeout);
            this._flickerTimeout = null;
        }

        // Restore music volume (honor a user MUSIC-mute toggled during the static window)
        if (this._musicEl) {
            this._musicEl.volume = this._musicMuted ? 0 : this._savedVolume;
        }

        // Fade out and stop noise
        if (this._staticNoiseGain && this.ctx) {
            const t = this.ctx.currentTime;
            this._staticNoiseGain.gain.setTargetAtTime(0, t, 0.15);
            const src = this._staticNoiseSource;
            setTimeout(() => { try { src.stop(); } catch (e) {} }, 600);
        }
        this._staticNoiseSource = null;
        this._staticNoiseGain = null;
    },

    // ============================================
    // SCENE SOUNDSCAPES (menu / game-over / dive-launch)
    // A data-driven Web Audio mixer built from the assets/SFX library. Each
    // scene = continuous loops (volume + stereo pan) + random one-shot triggers
    // (optionally chained to a follow-up sound). The dive-launch is a fixed
    // linear sequence. Everything routes through _sceneBus → destination, so
    // the levels below are LITERAL (not scaled by masterGain), matching the
    // sound-design spec. Web Audio gives pan (StereoPanner) + pitch
    // (playbackRate), which HTML5 <audio> can't. Missing/undecodable files are
    // tolerated → that layer is silent, never throws. _sceneBus is muted by the
    // MUSIC toggle (these scenes replace the menu/game-over music).
    //
    // Tuning: `volume` 0–1 · `pan` −1..1 | 'hardLR' | [min,max] | 'random' ·
    // `minGap`/`maxGap` ms between random triggers · `chain` fires `delay` ms
    // after its parent (e.g. lights shorting out after a hull strike).
    // ============================================
    menuScenes: {
        // ── Scene 1 · Main Title: healthy but hunted — stable industrial bed,
        //    unsettling sounds outside the hull ──
        main: {
            loops: [
                { file: 'Deep_ocean_ambient_d_#1-1782846528547.wav', volume: 0.40, pan: 0 },
                { file: 'Electrical_hum_with__#1-1782846215337.wav',  volume: 0.25, pan: 0 },
            ],
            triggers: [
                { file: 'Slow_rhythmic_stress_#1-1782843552461.wav', volume: 0.30, pan: 0,           minGap: 15000, maxGap: 30000 },
                { file: 'Slow_scraping_sound__#2-1782846447090.wav', volume: 0.50, pan: 'hardLR',     minGap: 30000, maxGap: 60000 },
                { file: 'Wet,_guttural_underw_#3-1782862986124.wav', volume: 0.60, pan: [-0.8, 0.8],  minGap: 20000, maxGap: 45000 },
            ],
        },
        // ── Scene 2 · Game Over: the death rattle — flooding + damage + alarms,
        //    each hull strike shorts the lights (chained buzz) ──
        gameOver: {
            loops: [
                { file: 'Deep_ocean_ambient_d_#1-1782846528547.wav', volume: 0.60, pan: 0 },
                { file: 'Bubbling_pressure_re_#3-1782845221283.wav', volume: 0.80, pan: 0 },
                { file: 'Deep_underwater_hull_#1-1782839689638.wav', volume: 0.70, pan: 0 },
            ],
            triggers: [
                { file: 'Single_muffled_impac_#1-1782846398450.wav', volume: 1.00, pan: [-0.5, 0.5], minGap: 5000, maxGap: 12000,
                  chain: { file: 'Short_electrical_buz_#1-1782846287028.wav', volume: 0.50, pan: 0, delay: 500 } },
            ],
        },
    },

    // ── Scene 3 · Diver Launch: a FIXED linear mechanical sequence (no randomness) ──
    _launchFiles: [
        'Hydraulic_valve_hiss_#1-1782845163426.wav',  // chamber pressurization
        'Single_distant_metal_#1-1782843501796.wav',  // airlock doors disengage
        'Steam_pipe_releasing_#1-1782843953902.wav',  // compressed-air ejection (pitched down)
        'Bubbling_pressure_re_#3-1782845221283.wav',  // drop into the ocean (fades out)
    ],

    _sceneBus: null,           // GainNode → destination; the MUSIC-toggle chokepoint
    _sceneBuffers: {},         // decoded AudioBuffer cache keyed by filename
    _sceneSources: [],         // active looping nodes {src,g} (torn down on stop)
    _sceneTimers: [],          // active trigger/chain setTimeout handles
    _seqTimers: [],            // dive-launch sequence timers
    _sceneActive: null,        // playing scene id (idempotency guard)
    _sceneGen: 0,              // bumped on every stop — invalidates in-flight async starts + schedulers

    // assets/SFX path, encoding # , and spaces the library names contain
    _sceneUrl(file) { return 'assets/SFX/' + encodeURIComponent(file); },

    _ensureSceneBus() {
        if (this._sceneBus || !this.ctx) return;
        this._sceneBus = this.ctx.createGain();
        this._sceneBus.gain.value = this._musicMuted ? 0 : 1;
        this._sceneBus.connect(this.ctx.destination);
    },

    // Fetch + decode any not-yet-cached files (safe to call repeatedly)
    async _ensureSceneBuffers(files) {
        if (!this.ctx) return;
        await Promise.all([...new Set(files)].map(async (file) => {
            if (this._sceneBuffers[file]) return;
            try {
                const res = await fetch(this._sceneUrl(file));
                if (!res.ok) return;                          // 404 → layer stays silent
                const data = await res.arrayBuffer();
                this._sceneBuffers[file] = await this.ctx.decodeAudioData(data);
            } catch (e) { /* missing/undecodable → skip */ }
        }));
    },

    // Warm the cache on first gesture so the menu bed starts without delay
    _preloadScenes() {
        if (!this.ctx) return;
        const files = new Set(this._launchFiles);
        Object.values(this.menuScenes).forEach((sc) => {
            (sc.loops || []).forEach((l) => files.add(l.file));
            (sc.triggers || []).forEach((t) => { files.add(t.file); if (t.chain) files.add(t.chain.file); });
        });
        this._ensureSceneBuffers([...files]);
    },

    // Resolve a pan spec → a concrete −1..1 value (re-rolled per trigger fire)
    _scenePan(spec) {
        if (typeof spec === 'number') return spec;
        if (Array.isArray(spec)) return spec[0] + Math.random() * (spec[1] - spec[0]);
        if (spec === 'hardLR') return Math.random() < 0.5 ? -1 : 1;
        if (spec === 'random') return -0.8 + Math.random() * 1.6;
        return 0;
    },

    // Play one cached buffer through gain(→pan)→bus. opts: {volume,pan,loop,rate,fadeOut}
    // Returns {src,g} (or null if the buffer isn't loaded).
    _scenePlayBuffer(file, opts = {}) {
        const buf = this._sceneBuffers[file];
        if (!buf || !this.ctx || !this._sceneBus) return null;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = !!opts.loop;
        if (opts.rate) src.playbackRate.value = opts.rate;
        const g = this.ctx.createGain();
        src.connect(g);
        let tail = g;
        if (this.ctx.createStereoPanner) {
            const p = this.ctx.createStereoPanner();
            p.pan.value = opts.pan || 0;
            g.connect(p); tail = p;
        }
        tail.connect(this._sceneBus);
        const t = this.ctx.currentTime;
        const vol = opts.volume != null ? opts.volume : 1;
        if (opts.fadeOut) {
            g.gain.setValueAtTime(vol, t);
            g.gain.linearRampToValueAtTime(0.0001, t + opts.fadeOut);
            src.start(t);
            try { src.stop(t + opts.fadeOut + 0.05); } catch (e) {}
        } else {
            g.gain.value = vol;
            src.start(t);
        }
        return { src, g };
    },

    _scheduleTrigger(id, gen, trig) {
        const gap = trig.minGap + Math.random() * (trig.maxGap - trig.minGap);
        const handle = setTimeout(() => {
            if (this._sceneGen !== gen || this._sceneActive !== id) return;   // scene changed
            this._scenePlayBuffer(trig.file, { volume: trig.volume, pan: this._scenePan(trig.pan) });
            if (trig.chain) {
                const ch = trig.chain;
                const chHandle = setTimeout(() => {
                    if (this._sceneGen !== gen) return;
                    this._scenePlayBuffer(ch.file, { volume: ch.volume, pan: this._scenePan(ch.pan) });
                }, ch.delay || 0);
                this._sceneTimers.push(chHandle);
            }
            this._scheduleTrigger(id, gen, trig);   // re-arm
        }, gap);
        this._sceneTimers.push(handle);
    },

    // Start (or switch to) a scene. Idempotent: re-entering the active scene is
    // a no-op (menu navigation won't restart the bed). Async because it loads
    // buffers on demand; a generation guard drops stale starts if the scene
    // changed while loading.
    async playScene(id) {
        const cfg = this.menuScenes[id];
        if (!cfg) return;
        this.init();
        if (!this.ctx) return;
        if (this._sceneActive === id) return;
        this.stopScene();
        const gen = this._sceneGen;
        this._sceneActive = id;
        this._ensureSceneBus();
        if (this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) {} }

        const files = [];
        (cfg.loops || []).forEach((l) => files.push(l.file));
        (cfg.triggers || []).forEach((t) => { files.push(t.file); if (t.chain) files.push(t.chain.file); });
        await this._ensureSceneBuffers(files);
        if (this._sceneGen !== gen || this._sceneActive !== id) return;   // switched during load

        (cfg.loops || []).forEach((l) => {
            const node = this._scenePlayBuffer(l.file, { volume: l.volume, pan: this._scenePan(l.pan), loop: true });
            if (node) this._sceneSources.push(node);
        });
        (cfg.triggers || []).forEach((t) => this._scheduleTrigger(id, gen, t));
    },

    // Stop the active scene: bump the generation (kills pending starts +
    // schedulers), clear timers, fade + stop the loops. Transient one-shots
    // (≤ a couple seconds) are left to finish on their own.
    stopScene() {
        this._sceneGen++;
        this._sceneActive = null;
        this._sceneTimers.forEach(clearTimeout);
        this._sceneTimers = [];
        const sources = this._sceneSources;
        this._sceneSources = [];
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        sources.forEach(({ src, g }) => {
            try {
                g.gain.cancelScheduledValues(t);
                g.gain.setValueAtTime(g.gain.value, t);
                g.gain.linearRampToValueAtTime(0.0001, t + 0.25);   // click-free fade
                src.stop(t + 0.3);
            } catch (e) { /* already stopped */ }
        });
    },

    // Scene 3 — fixed linear dive-launch sequence (see spec order/timing)
    playLaunchSequence() {
        this.init();
        if (!this.ctx) return;
        this._ensureSceneBus();
        if (this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) {} }
        this._seqTimers.forEach(clearTimeout);
        this._seqTimers = [];
        const [hissF, metalF, steamF, bubbleF] = this._launchFiles;
        this._ensureSceneBuffers(this._launchFiles).then(() => {
            const B = this._sceneBuffers;
            // Step 1 — chamber pressurization (80%); wait for it to finish
            this._scenePlayBuffer(hissF, { volume: 0.80, pan: 0 });
            const hissMs = B[hissF] ? B[hissF].duration * 1000 : 1000;
            // Step 2 — airlock doors disengage (100%)
            this._seqTimers.push(setTimeout(() => {
                this._scenePlayBuffer(metalF, { volume: 1.00, pan: 0 });
                // Steps 3 & 4 — 0.5s later: compressed-air ejection (90%, pitched
                // down 15% ≈ rate 0.85) overlapped with bubbling drop-in (70%),
                // the bubbles fading out over 3s as the diver falls into the sea.
                this._seqTimers.push(setTimeout(() => {
                    this._scenePlayBuffer(steamF,  { volume: 0.90, pan: 0, rate: 0.85 });
                    this._scenePlayBuffer(bubbleF, { volume: 0.70, pan: 0, loop: true, fadeOut: 3.0 });
                }, 500));
            }, hissMs));
        });
    },

    // Re-apply the MUSIC mute state to the scene bus (call on toggle)
    refreshSceneVolume() {
        if (!this._sceneBus || !this.ctx) return;
        this._sceneBus.gain.setTargetAtTime(this._musicMuted ? 0 : 1, this.ctx.currentTime, 0.05);
    }
};

// Pause/resume music when the tab is hidden/visible
document.addEventListener('visibilitychange', () => {
    const el = AudioManager._musicEl;
    if (!el) return;
    if (document.hidden) {
        el.pause();
    } else if (!AudioManager._musicMuted) {
        el.play().catch(() => {});
    }
});
