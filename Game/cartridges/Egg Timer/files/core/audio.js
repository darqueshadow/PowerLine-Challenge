/* ===========================================================================
   EGG TIMER — SOUND (placeholders)
   ⏳ Every sound here is a stand-in, synthesised with Web Audio so it needs no
   files. The real sounds are Gemini's once art and audio direction start.
   The browser keeps audio locked until the player presses a key or clicks, so
   the context is made on the first one (unlock()) and anything before is silent.

   E24 (Andrew, 2026-09-24): every sound goes through ONE master chain: a master
   level, then a soft ceiling, then the speakers. Below the ceiling's knee a
   sound passes untouched; above it the peaks are rounded off, and nothing ever
   leaves louder than CEILING, however many sounds overlap, so it can't clip.
   Mute takes the master level to 0 and is remembered per browser. In a
   background tab the title tune stops and every sound is held; the tune starts
   again from the top when the tab comes back.
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});
  var ctx = null;

  var LEVEL = 0.8;        // the master level [T]: the loudest single sound passes well under the knee
  var KNEE = 0.75;        // up to here the ceiling changes nothing…
  var CEILING = 0.95;     // …and nothing ever leaves louder than this (full scale, where clipping starts, is 1)
  var MUTE_KEY = "eggtimer.muted";
  var muted = readMuted();
  var out = null;         // the live context's master chain, made with the first sound

  function readMuted() { try { return root.localStorage.getItem(MUTE_KEY) === "1"; } catch (e) { return false; } }
  function saveMuted() { try { root.localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch (e) { /* no storage (a private window): this visit only */ } }
  function hidden() { return typeof document !== "undefined" && document.hidden; }

  /* Egg-laying sounds: at most layMaxOverlap of each kind sounding at once (Chat ruling, 2026-09-25). */
  var sounding = { squeeze: [], pop: [] };
  function capped(kind, now, seconds) {
    var live = sounding[kind].filter(function (end) { return end > now; });
    if (live.length >= ET.CONFIG.layMaxOverlap) { sounding[kind] = live; return true; }
    live.push(now + seconds);
    sounding[kind] = live;
    return false;
  }

  /* The soft ceiling: straight through up to KNEE, then rounded off towards CEILING. A WaveShaper holds anything past
     its ends at the end value, so no input, however loud, gets out above CEILING. */
  function ceilingCurve(n) {
    var curve = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1, a = Math.abs(x);
      var y = a <= KNEE ? a : KNEE + (CEILING - KNEE) * Math.tanh((a - KNEE) / (CEILING - KNEE));
      curve[i] = x < 0 ? -y : y;
    }
    return curve;
  }

  /* The master chain on context `a`, at master level `level`. `input` is where every sound connects; `meter` reads
     what actually leaves (for rigs). */
  function chain(a, level) {
    var gain = a.createGain(), shaper = a.createWaveShaper(), meter = a.createAnalyser();
    gain.gain.value = level;
    shaper.curve = ceilingCurve(2049);
    gain.connect(shaper);
    shaper.connect(a.destination);
    shaper.connect(meter);
    return { input: gain, level: gain, meter: meter };
  }

  /* Where a sound on the live context connects: the master chain, made the first time. */
  function bus() {
    if (!out) out = chain(ctx, muted ? 0 : LEVEL);
    return out.input;
  }

  function ready() {
    if (!ET.CONFIG.sound || !ctx) return null;
    if (ctx.state === "suspended" && !hidden()) { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); }   // a refused resume is fine: it waits for the next
    return ctx;
  }

  /* One voice: an oscillator through a quick attack and an exponential decay. */
  function tone(type, freq, endFreq, seconds, gain, delay) {
    var a = ready();
    if (!a) return;
    var t = a.currentTime + (delay || 0);
    var o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + seconds);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    o.connect(g).connect(bus());
    o.start(t);
    o.stop(t + seconds + 0.02);
  }

  /* A short burst of noise, for the clunk's thud. */
  function noise(seconds, gain, cutoff, delay) {
    var a = ready();
    if (!a) return;
    var t = a.currentTime + (delay || 0);
    var n = Math.floor(a.sampleRate * seconds);
    var buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf;
    f.type = "lowpass";
    f.frequency.value = cutoff;
    g.gain.value = gain;
    src.connect(f).connect(g).connect(bus());
    src.start(t);
  }

  /* Refinement 4 §6: the title tune. An ORIGINAL melody, written for Egg Timer (a lullaby-ish
     chiptune in C major, 3/4), not borrowed from any existing song. The twist: its last bar hides one
     sour, low note under the sweet ending. MIDI note numbers; 0 is a rest. */
  var MELODY = [76, 79, 81, 79, 76, 74, 72, 74, 76, 79, 84, 83, 81, 79, 76, 0,
                77, 81, 83, 81, 79, 76, 74, 76, 77, 76, 74, 71, 72, 0, 72, 0];
  var BASS = [48, 43, 45, 40, 41, 43, 41, 48];      // one per four melody notes
  var BEAT = 0.26;                                  // [T] seconds per melody note
  var tune = { on: false, timer: null, bus: null, held: false };
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function note(type, m, at, len, gain) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(hz(m), at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(g).connect(tune.bus);
    o.start(at);
    o.stop(at + len + 0.02);
  }
  function phrase() {
    if (!tune.on) return;
    if (hidden()) { tune.held = true; return; }      // a background tab: wait for it to come back
    if (!ctx || ctx.state !== "running") {           // not allowed to sound yet: keep asking, quietly
      if (ctx) ctx.resume();
      tune.timer = setTimeout(phrase, 300);
      return;
    }
    if (!tune.bus) { tune.bus = ctx.createGain(); tune.bus.gain.value = 1; tune.bus.connect(bus()); }
    var t0 = ctx.currentTime + 0.05;
    MELODY.forEach(function (m, i) { if (m) note("square", m, t0 + i * BEAT, BEAT * 0.9, 0.045); });
    BASS.forEach(function (m, i) { note("triangle", m, t0 + i * 4 * BEAT, BEAT * 3.6, 0.07); });
    note("sawtooth", 49, t0 + 28 * BEAT, BEAT * 2.5, 0.018);   // the sour note, under the sweet ending
    tune.timer = setTimeout(phrase, MELODY.length * BEAT * 1000);
  }
  /* Cut the tune off where it is: its notes are already scheduled, so they go with the tune's own bus. */
  function silenceTune() {
    clearTimeout(tune.timer);
    tune.timer = null;
    if (tune.bus) { tune.bus.gain.setValueAtTime(0, ctx.currentTime); tune.bus.disconnect(); tune.bus = null; }
  }

  /* E24: a background tab stops the title tune and holds every other sound; coming back resumes them, and the tune
     starts again from the top (only if it had been cut off, so it never plays twice over). */
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        if (tune.on && (tune.bus || tune.timer)) { silenceTune(); tune.held = true; }
        if (ctx && ctx.state === "running") ctx.suspend();
      } else {
        if (ctx && ET.CONFIG.sound) ctx.resume();
        if (tune.on && tune.held) { tune.held = false; phrase(); }
      }
    });
  }

  ET.audio = {
    unlock: function () {
      if (ctx || !ET.CONFIG.sound) return;
      var AC = root.AudioContext || root.webkitAudioContext;
      if (AC) { try { ctx = new AC(); } catch (e) { ctx = null; } }
    },

    /* The pan on the egg: a bright metallic ring, its pitch nudged each time. */
    thong: function () {
      var j = 1 + (Math.random() * 2 - 1) * ET.CONFIG.thongPitchJitter;
      tone("triangle", 660 * j, 520 * j, 0.45, 0.35);
      tone("sine", 1720 * j, 1500 * j, 0.3, 0.12);
      noise(0.05, 0.25, 3000);
    },

    ding: function () { tone("sine", 1568, 0, 0.35, 0.18, 0.08); tone("sine", 2093, 0, 0.3, 0.1, 0.14); },

    /* The pan on an empty nest after a hatch: dull, low, no ring. */
    clunk: function (delay) { tone("square", 110, 60, 0.18, 0.2, delay); noise(0.12, 0.5, 500, delay); },

    /* Egg-laying (Chat ruling, 2026-09-25; ⏳ synthesized until recorded sounds replace them). The squeeze: a short
       wet, rubbery squelch as the bulge travels the cord's last stretch. The pop: a cartoon "finger out of the mouth"
       pop as the egg drops into the nest. Each lay nudges the pitch; at most layMaxOverlap of each sound at once, so a
       burst of lays can't pile up. Both sit clearly under THONG, the buzz and the hiss. They return the pitch used, or
       false when they didn't sound. */
    squeeze: function () {
      var a = ready();
      if (!a || capped("squeeze", a.currentTime, 0.26)) return false;
      var j = 1 + (Math.random() * 2 - 1) * ET.CONFIG.layPitchJitter, t = a.currentTime, n = Math.floor(a.sampleRate * 0.24);
      var buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      var src = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
      src.buffer = buf;
      bp.type = "bandpass"; bp.Q.value = 3;
      bp.frequency.setValueAtTime(320 * j, t); bp.frequency.exponentialRampToValueAtTime(950 * j, t + 0.22);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      src.connect(bp).connect(g).connect(bus());
      src.start(t);
      // the rubber: a low tone that wobbles as it squeezes
      var o = a.createOscillator(), lfo = a.createOscillator(), depth = a.createGain(), og = a.createGain();
      o.type = "triangle"; o.frequency.setValueAtTime(150 * j, t); o.frequency.exponentialRampToValueAtTime(260 * j, t + 0.22);
      lfo.type = "sine"; lfo.frequency.value = 23; depth.gain.value = 18 * j;
      lfo.connect(depth).connect(o.frequency);
      og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.05, t + 0.04); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      o.connect(og).connect(bus());
      o.start(t); lfo.start(t); o.stop(t + 0.26); lfo.stop(t + 0.26);
      return j;
    },
    pop: function () {
      var a = ready();
      if (!a || capped("pop", a.currentTime, 0.12)) return false;
      var j = 1 + (Math.random() * 2 - 1) * ET.CONFIG.layPitchJitter;
      tone("sine", 240 * j, 1100 * j, 0.09, 0.09);   // the cheek's pop: a quick upward sweep
      noise(0.012, 0.06, 2400);                         // the lips' tiny click
      return j;
    },

    /* ⏳ placeholder: the scary mom face's creepy hiss and wet gurgle, not a scream (Refinement 5 §5). */
    hiss: function (seconds, volume) {
      var a = ready();
      if (!a) return;
      var t = a.currentTime, n = Math.floor(a.sampleRate * seconds);
      var buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      var src = a.createBufferSource(), bp = a.createBiquadFilter(), hg = a.createGain();
      src.buffer = buf;
      bp.type = "bandpass"; bp.frequency.setValueAtTime(2600, t); bp.frequency.linearRampToValueAtTime(4200, t + seconds); bp.Q.value = 1.2;
      hg.gain.setValueAtTime(0.0001, t);
      hg.gain.exponentialRampToValueAtTime(volume, t + seconds * 0.3);
      hg.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
      src.connect(bp).connect(hg).connect(bus());
      src.start(t);
      // the gurgle: a low tone, its pitch wobbled fast and unevenly
      var o = a.createOscillator(), lfo = a.createOscillator(), depth = a.createGain(), og = a.createGain();
      o.type = "sine"; o.frequency.value = 85;
      lfo.type = "square"; lfo.frequency.setValueAtTime(11, t); lfo.frequency.linearRampToValueAtTime(17, t + seconds);
      depth.gain.value = 28;
      lfo.connect(depth).connect(o.frequency);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(volume * 1.4, t + seconds * 0.25);
      og.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
      o.connect(og).connect(bus());
      o.start(t); lfo.start(t);
      o.stop(t + seconds + 0.05); lfo.stop(t + seconds + 0.05);
    },

    buzz: function () { tone("sawtooth", 140, 120, 0.22, 0.18); },

    /* The title tune, on or off. Browsers only let a page make sound after a key press or click, so in a
       plain tab it waits until then; where sound is allowed straight away it starts at once. E21 (ruled):
       it keeps playing through the mode-selection screen, so the first key press still gets it heard. */
    titleTune: function (on) {
      if (!ET.CONFIG.sound) return;
      if (!on) {
        tune.on = false;
        tune.held = false;
        silenceTune();
        return;
      }
      if (tune.on) return;
      tune.on = true;
      if (!ctx) ET.audio.unlock();
      phrase();
    },
    tunePlaying: function () { return tune.on && !!tune.bus; },

    /* E24: mute, remembered per browser. The master level fades to 0 (or back) over a few milliseconds, so it
       doesn't click. */
    muted: function () { return muted; },
    setMuted: function (on) {
      muted = !!on;
      saveMuted();
      if (out) {
        var g = out.level.gain, t = ctx.currentTime;
        g.cancelScheduledValues(t);
        g.setTargetAtTime(muted ? 0 : LEVEL, t, 0.01);
      }
      return muted;
    },

    /* For rigs: whether a context exists, and its state; the master level right now (0 when muted); the loudest
       sample leaving the master chain just now; and the chain itself with its ceiling, to measure on a context of
       the rig's own. */
    state: function () { return ctx ? ctx.state : "none"; },
    level: function () { return out ? out.level.gain.value : null; },
    peak: function () {
      if (!out) return 0;
      var d = new Float32Array(out.meter.fftSize), m = 0;
      out.meter.getFloatTimeDomainData(d);
      for (var i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
      return m;
    },
    chain: function (a, level) { return chain(a, level === undefined ? LEVEL : level); },

    /* For rigs: play one sound (`name`, with `args`) alone into a silent offline context, through its own master chain at
       level 1, and measure its peak and loudness (RMS) over the first `seconds`. The live context is untouched. */
    measure: function (name, args, seconds) {
      var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
      var off = new OAC(1, Math.ceil(44100 * (seconds || 1)), 44100);
      var live = { ctx: ctx, out: out, sounding: sounding, muted: muted };
      ctx = off; out = chain(off, 1); sounding = { squeeze: [], pop: [] }; muted = false;
      try { ET.audio[name].apply(null, args || []); } finally { ctx = live.ctx; out = live.out; sounding = live.sounding; muted = live.muted; }
      return off.startRendering().then(function (buf) {
        var d = buf.getChannelData(0), peak = 0, sum = 0;
        for (var i = 0; i < d.length; i++) { var v = Math.abs(d[i]); if (v > peak) peak = v; sum += d[i] * d[i]; }
        return { peak: peak, rms: Math.sqrt(sum / d.length) };
      });
    },
    CEILING: CEILING,
    LEVEL: LEVEL
  };
})(window);
