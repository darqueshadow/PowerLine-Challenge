/* ========================================================
   ASTEROID COMMAND — AUDIO MODULE
   Web Audio API synthesizer — dual-mode (Standard / Holodeck)
   Extracted per Build Procedure v1.6
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
        } catch (e) {
            console.warn('[AudioManager] Web Audio not available:', e.message);
        }
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
    // STANDARD MODE — mechanical / industrial
    // ============================================

    _playStandard(event) {
        const t = this.ctx.currentTime;
        switch (event) {
            case 'typing':    this._stdTyping(t); break;
            case 'fire':      this._stdFire(t); break;
            case 'hit':       this._stdHit(t); break;
            case 'misfire':   this._stdMisfire(t); break;
            case 'targetImpact': this._stdTargetImpact(t); break;
            case 'shieldHit': this._stdShieldHit(t); break;
            case 'shieldDown': this._stdShieldDown(t); break;
            case 'towerDown': this._stdTowerDown(t); break;
            case 'spawn':     this._stdSpawn(t); break;
            case 'gameOver':  this._stdGameOver(t); break;
        }
    },

    // ── Typing: short noise click ──
    _stdTyping(t) {
        const now = performance.now();
        if (now - this.lastTypingTime < this.typingThrottle) return;
        this.lastTypingTime = now;
        if (!this._track(60)) return;

        const g = this._gain(0.08);
        const n = this._noise(g);
        n.start(t);
        n.stop(t + 0.03);
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    },

    // ── Fire: rising sawtooth 200→600Hz ──
    _stdFire(t) {
        if (!this._track(200)) return;
        const g = this._gain(0.12);
        const o = this._osc('sawtooth', 200, g);
        o.frequency.exponentialRampToValueAtTime(600, t + 0.15);
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        o.start(t);
        o.stop(t + 0.2);
    },

    // ── Hit: metallic noise + low square ──
    _stdHit(t) {
        if (!this._track(300)) return;
        const g1 = this._gain(0.1);
        const n = this._noise(g1);
        n.start(t);
        n.stop(t + 0.08);
        g1.gain.setValueAtTime(0.1, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

        const g2 = this._gain(0.08);
        const o = this._osc('square', 120, g2);
        g2.gain.setValueAtTime(0.08, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o.start(t);
        o.stop(t + 0.3);
    },

    // ── Misfire: static buzz 80Hz ──
    _stdMisfire(t) {
        if (!this._track(400)) return;
        const g = this._gain(0.1);
        const o = this._osc('sawtooth', 80, g);
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        o.start(t);
        o.stop(t + 0.4);
    },

    // ── Target Impact: heavy thud 60Hz + noise ──
    _stdTargetImpact(t) {
        if (!this._track(500)) return;
        const g1 = this._gain(0.2);
        const o = this._osc('sine', 60, g1);
        o.frequency.exponentialRampToValueAtTime(30, t + 0.4);
        g1.gain.setValueAtTime(0.2, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        o.start(t);
        o.stop(t + 0.5);

        const g2 = this._gain(0.12);
        const n = this._noise(g2);
        g2.gain.setValueAtTime(0.12, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        n.start(t);
        n.stop(t + 0.2);
    },

    // ── Shield Hit: electric zap ──
    _stdShieldHit(t) {
        if (!this._track(250)) return;
        const g = this._gain(0.1);
        const o = this._osc('sawtooth', 800, g);
        o.frequency.exponentialRampToValueAtTime(200, t + 0.1);
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o.start(t);
        o.stop(t + 0.25);
    },

    // ── Shield Down: two-tone alarm ──
    _stdShieldDown(t) {
        if (!this._track(600)) return;
        const g = this._gain(0.12);
        const o = this._osc('square', 440, g);
        o.frequency.setValueAtTime(440, t);
        o.frequency.setValueAtTime(330, t + 0.15);
        o.frequency.setValueAtTime(440, t + 0.3);
        o.frequency.setValueAtTime(330, t + 0.45);
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        o.start(t);
        o.stop(t + 0.6);
    },

    // ── Tower Down: deep boom 40Hz ──
    _stdTowerDown(t) {
        if (!this._track(800)) return;
        const g1 = this._gain(0.25);
        const o = this._osc('sine', 40, g1);
        o.frequency.exponentialRampToValueAtTime(20, t + 0.6);
        g1.gain.setValueAtTime(0.25, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
        o.start(t);
        o.stop(t + 0.8);

        const g2 = this._gain(0.15);
        const n = this._noise(g2);
        g2.gain.setValueAtTime(0.15, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        n.start(t);
        n.stop(t + 0.5);
    },

    // ── Spawn: low rumble 100Hz ──
    _stdSpawn(t) {
        if (!this._track(400)) return;
        const g = this._gain(0.06);
        const o = this._osc('sine', 100, g);
        o.frequency.exponentialRampToValueAtTime(60, t + 0.3);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.06, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        o.start(t);
        o.stop(t + 0.4);
    },

    // ── Game Over: descending sequence ──
    _stdGameOver(t) {
        if (!this._track(1500)) return;
        const notes = [440, 370, 311, 261, 220];
        notes.forEach((freq, i) => {
            const g = this._gain(0.1);
            const o = this._osc('square', freq, g);
            const start = t + i * 0.25;
            g.gain.setValueAtTime(0.1, start);
            g.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
            o.start(start);
            o.stop(start + 0.25);
        });
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
            case 'shieldHit':    this._holoShieldHit(t); break;
            case 'shieldDown':   this._holoShieldDown(t); break;
            case 'towerDown':    this._holoTowerDown(t); break;
            case 'spawn':        this._holoSpawn(t); break;
            case 'lcarsButton':  this._holoLcarsButton(t); break;
            case 'gameOver':     this._holoGameOver(t); break;
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
     * @param {Object} opts - { loop, volume, onEnded }
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
     * @param {number}   volume - playback volume (0–1)
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
    // RADIO STATIC EFFECT (tower destroyed)
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
            noiseGain.connect(this.ctx.destination);
            noiseSource.start();

            this._staticNoiseSource = noiseSource;
            this._staticNoiseGain = noiseGain;
        }

        // Start flicker loop — randomly mute/unmute music
        const flicker = () => {
            if (!this._staticActive || !this._musicEl) return;

            const muted = this._musicEl.volume < 0.01;
            if (muted) {
                // Restore volume for a random duration (80–400ms)
                this._musicEl.volume = this._savedVolume;
                this._flickerTimeout = setTimeout(flicker, 80 + Math.random() * 320);
            } else {
                // Mute for a random duration (40–250ms)
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

        // Restore music volume
        if (this._musicEl) {
            this._musicEl.volume = this._savedVolume;
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
