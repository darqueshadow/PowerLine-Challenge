/* ============================================================================
 * PITSTOP (NEMS 500) — core/audio.js
 * PowerLine Challenge cartridge · Phase 0 Scaffold · v0.1.0
 * ----------------------------------------------------------------------------
 * THEME-AGNOSTIC AUDIO. Per Build Procedure §3.6 + handoff §7 ("stub audio
 * hooks"). A single global AudioManager: lazy Web Audio init on first gesture,
 * a play(event) dispatch, and music controls. Matches the established PLC
 * AudioManager surface so themed SFX/music drop in later.
 *
 *   Phase 0 wires only neutral UI cues (typing, menu, boot). Gameplay events
 *   (throttle, gate, sputter, pit, tireBlow, finish) are registered as no-op
 *   placeholders — [PHASE 1+ — GATED]; the race loop will trigger them later.
 * ========================================================================= */

(function (global) {
  'use strict';

  const AudioManager = {
    ctx: null,
    masterGain: null,
    initialized: false,
    _musicEl: null,
    _sfxMuted: false,
    _musicMuted: false,
    _lastTyping: 0,

    init: function () {
      if (this.initialized) return;
      try {
        const AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.35;
        this.masterGain.connect(this.ctx.destination);
        this.initialized = true;
      } catch (e) { /* audio optional */ }
    },

    resume: function () {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    _beep: function (freq, dur, type) {
      if (!this.initialized || this._sfxMuted || !this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.25, this.ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
      o.connect(g); g.connect(this.masterGain);
      o.start(); o.stop(this.ctx.currentTime + dur);
    },

    // SFX dispatch. Event recipes kept tiny; gated events are intentional no-ops.
    play: function (event) {
      if (!this.initialized) this.init();
      switch (event) {
        /* --- Neutral UI cues (Phase 0 safe) --- */
        case 'typing': {
          const now = global.performance ? performance.now() : 0;
          if (now - this._lastTyping < 50) return;        // throttle
          this._lastTyping = now;
          this._beep(220, 0.03, 'square'); break;
        }
        case 'menu':   this._beep(440, 0.06, 'square'); break;
        case 'select': this._beep(660, 0.08, 'square'); break;
        case 'back':   this._beep(180, 0.08, 'square'); break;
        case 'boot':   this._beep(120, 0.12, 'sawtooth'); break;
        /* --- [PHASE 1+ — GATED] gameplay SFX: registered, no-op for now --- */
        case 'throttle': case 'shift': case 'gate': case 'sputter':
        case 'pit': case 'tireBlow': case 'fuelLow': case 'countdown':
        case 'go': case 'finish': case 'gameOver':
          break;  // intentionally silent until the race loop is built
        default: break;
      }
    },

    /* --- Music (HTML5 Audio; deferred assets per handoff §7) --- */
    playMusic: function (src, opts) {
      opts = opts || {};
      if (this._musicMuted || !src) return;
      try {
        this.stopMusic();
        this._musicEl = new Audio(src);
        this._musicEl.loop = opts.loop !== false;
        this._musicEl.volume = opts.volume != null ? opts.volume : 0.4;
        this._musicEl.play().catch(function () { /* autoplay blocked; retry on gesture */ });
      } catch (e) { /* no music asset yet */ }
    },
    stopMusic: function () {
      if (this._musicEl) { try { this._musicEl.pause(); } catch (e) {} this._musicEl = null; }
    },
    setSfxMuted:   function (m) { this._sfxMuted = !!m; },
    setMusicMuted: function (m) { this._musicMuted = !!m; if (m) this.stopMusic(); }
  };

  global.AudioManager = AudioManager;
})(window);
