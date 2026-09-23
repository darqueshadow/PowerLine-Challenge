/* ===========================================================================
   EGG TIMER — SOUND (placeholders)
   ⏳ Every sound here is a stand-in, synthesised with Web Audio so it needs no
   files. The real sounds are Gemini's once art and audio direction start.
   The browser keeps audio locked until the player presses a key or clicks, so
   the context is made on the first one (unlock()) and anything before is silent.
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});
  var ctx = null;

  function ready() {
    if (!ET.CONFIG.sound || !ctx) return null;
    if (ctx.state === "suspended") ctx.resume();
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
    o.connect(g).connect(a.destination);
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
    src.connect(f).connect(g).connect(a.destination);
    src.start(t);
  }

  /* Refinement 4 §6: the title tune. An ORIGINAL melody, written for Egg Timer (a lullaby-ish
     chiptune in C major, 3/4), not borrowed from any existing song. The twist: its last bar hides one
     sour, low note under the sweet ending. MIDI note numbers; 0 is a rest. */
  var MELODY = [76, 79, 81, 79, 76, 74, 72, 74, 76, 79, 84, 83, 81, 79, 76, 0,
                77, 81, 83, 81, 79, 76, 74, 76, 77, 76, 74, 71, 72, 0, 72, 0];
  var BASS = [48, 43, 45, 40, 41, 43, 41, 48];      // one per four melody notes
  var BEAT = 0.26;                                  // [T] seconds per melody note
  var tune = { on: false, timer: null, bus: null };
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
    if (!ctx || ctx.state !== "running") {           // not allowed to sound yet: keep asking, quietly
      if (ctx) ctx.resume();
      tune.timer = setTimeout(phrase, 300);
      return;
    }
    if (!tune.bus) { tune.bus = ctx.createGain(); tune.bus.gain.value = 1; tune.bus.connect(ctx.destination); }
    var t0 = ctx.currentTime + 0.05;
    MELODY.forEach(function (m, i) { if (m) note("square", m, t0 + i * BEAT, BEAT * 0.9, 0.045); });
    BASS.forEach(function (m, i) { note("triangle", m, t0 + i * 4 * BEAT, BEAT * 3.6, 0.07); });
    note("sawtooth", 49, t0 + 28 * BEAT, BEAT * 2.5, 0.018);   // the sour note, under the sweet ending
    tune.timer = setTimeout(phrase, MELODY.length * BEAT * 1000);
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

    /* ⏳ placeholder: the wet squelch as the egg pops out of its cord (Refinement 4 §1). */
    squelch: function () {
      noise(0.16, 0.45, 700);
      tone("sine", 260, 70, 0.22, 0.28);
      tone("triangle", 520, 180, 0.12, 0.1, 0.05);
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
      src.connect(bp).connect(hg).connect(a.destination);
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
      o.connect(og).connect(a.destination);
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
        clearTimeout(tune.timer);
        if (tune.bus) { tune.bus.gain.setValueAtTime(0, ctx.currentTime); tune.bus.disconnect(); tune.bus = null; }
        return;
      }
      if (tune.on) return;
      tune.on = true;
      if (!ctx) ET.audio.unlock();
      phrase();
    },
    tunePlaying: function () { return tune.on && !!tune.bus; },

    /* For rigs: whether a context exists, and its state. */
    state: function () { return ctx ? ctx.state : "none"; }
  };
})(window);
