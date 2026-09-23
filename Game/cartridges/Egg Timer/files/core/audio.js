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

    /* ⏳ placeholder: the egg popping off its cord (Refinement 3 §7). */
    pop: function () { tone("sine", 320, 900, 0.09, 0.22); tone("triangle", 1200, 700, 0.06, 0.08, 0.02); },

    buzz: function () { tone("sawtooth", 140, 120, 0.22, 0.18); },

    /* For rigs: whether a context exists, and its state. */
    state: function () { return ctx ? ctx.state : "none"; }
  };
})(window);
