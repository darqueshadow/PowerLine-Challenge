/* ===========================================================================
   EGG TIMER — SOUND (placeholders)
   ⏳ Every sound here is a stand-in, synthesised with Web Audio so it needs no
   files. The real sounds are Gemini's once art and audio direction start.
   A browser may keep audio locked until the player presses a key or clicks: the
   context is made as the page opens (autoplay(), E35) and runs as soon as it's
   allowed, at once in Fang Rock, else on the first key or click (unlock()).

   E24 (Andrew, 2026-09-24): every sound goes through ONE master chain: a master
   level, then a soft ceiling, then the speakers. Below the ceiling's knee a
   sound passes untouched; above it the peaks are rounded off, and nothing ever
   leaves louder than CEILING, however many sounds overlap, so it can't clip.
   Mute takes the master level to 0 and is remembered per browser. In a
   background tab every sound is held, the music included, and carries on where
   it was when the tab comes back.
   Music (Chat ruling, 2026-09-25): Andrew's three Suno tracks, from files/audio/
   (see music.json and make-music.py), replace the old synthesized title tune.
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
  var mout = null;        // E36: the music's own gain on the way into the chain, which dips under the loud cues
  var stateFn = null;     // E40: told when the context starts or stops running

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

  /* E36: every track goes through this one gain into the master chain, so a loud cue can dip the music (duck()). */
  function musicBus() {
    if (!mout) { mout = ctx.createGain(); mout.connect(bus()); }
    return mout;
  }
  /* E36: dip the music for `seconds` (a loud cue's length), then bring it back. Nothing to dip before any music, and
     never on a rig's offline render. */
  function duck(seconds) {
    if (!mout || mout.context !== ctx) return;
    var D = ET.CONFIG.musicDuck, g = mout.gain, t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(D.depth, t + D.attack);
    g.setValueAtTime(D.depth, t + seconds);
    g.linearRampToValueAtTime(1, t + seconds + D.release);
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

  /* A short burst of noise (THONG's scrape, the pop's click). */
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

  /* Music (Chat ruling, 2026-09-25): Andrew's three tracks, one at a time. Each file plays from its start once, then
     loops between its loop points (sample-exact: the join's crossfade is baked into the file); the game-over track
     plays once. A change of track fades out and in; the menus share one track, so moving between them doesn't restart
     it. Esc pauses and resumes where it stopped. Every note goes through bus(), so mute covers it, and a background
     tab suspends the context (below), which holds the music where it is. The files load when the page does; they
     decode once sound is allowed (the first key or click). */
  var music = { raw: {}, buf: {}, cur: null, want: null, paused: false, ended: null, log: [] };
  function loadMusic() {
    var M = ET.CONFIG.music;
    Object.keys(M).forEach(function (k) {
      if (music.raw[k] || !root.fetch) return;
      music.raw[k] = fetch(M[k].file).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).catch(function () { return null; });
    });
  }
  function decodeMusic(k) {
    if (music.buf[k] || !ctx) return music.buf[k];
    music.buf[k] = music.raw[k].then(function (ab) {
      if (!ab) return null;
      return new Promise(function (ok) { ctx.decodeAudioData(ab.slice(0), ok, function () { ok(null); }); });
    });
    return music.buf[k];
  }
  function stopTrack(t, fade) {
    if (!t) return;
    t.stopped = true;
    var now = ctx.currentTime;
    t.gain.gain.cancelScheduledValues(now);
    t.gain.gain.setValueAtTime(t.gain.gain.value, now);
    t.gain.gain.linearRampToValueAtTime(0, now + fade);
    try { t.src.stop(now + fade + 0.02); } catch (e) { /* already stopped */ }
  }
  /* Where a track is, in seconds into its file: past the loop's end it wraps back into the loop. */
  function position(t) {
    var p = t.from + (ctx.currentTime - t.at), L = ET.CONFIG.music[t.name].loop;
    if (L && p > L[1]) p = L[0] + ((p - L[0]) % (L[1] - L[0]));
    return p;
  }
  function startTrack(k, from, fade) {
    var a = ready(), M = ET.CONFIG.music[k];
    if (!a) return;
    decodeMusic(k).then(function (b) {
      if (!b || music.want !== k || music.paused || (music.cur && music.cur.name === k)) return;
      var src = a.createBufferSource(), g = a.createGain(), now = a.currentTime;
      src.buffer = b;
      if (M.loop) { src.loop = true; src.loopStart = M.loop[0]; src.loopEnd = M.loop[1]; }
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(M.level, now + fade);
      src.connect(g).connect(musicBus());
      var t = { name: k, src: src, gain: g, at: now, from: from || 0, stopped: false };
      src.onended = function () {
        if (t.stopped || music.cur !== t) return;
        music.cur = null;
        music.log.push({ ended: k, t: a.currentTime });
        if (music.ended) music.ended(k);   // the game-over track, played to its end
      };
      src.start(now, from || 0);
      music.cur = t;
      music.log.push({ started: k, from: from || 0, t: now });
    });
  }
  /* A background tab holds every sound (E24): suspending the context holds the music where it is, and coming back
     resumes it. */
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", function () {
      if (!ctx) return;
      if (document.hidden) { if (ctx.state === "running") ctx.suspend(); }
      else if (ET.CONFIG.sound) ctx.resume();
    });
  }
  if (typeof document !== "undefined") loadMusic();

  ET.audio = {
    /* E35: make the context as the page opens. Where autoplay is allowed (Fang Rock's Electron allows it by default)
       it runs at once and the waiting track plays; elsewhere it stays suspended, the track waits at its start, and the
       first key or click (unlock) lets it play. */
    autoplay: function () {
      if (ctx || !ET.CONFIG.sound) return;
      var AC = root.AudioContext || root.webkitAudioContext;
      if (AC) { try { ctx = new AC(); } catch (e) { ctx = null; } }
      if (ctx) ctx.onstatechange = function () { if (stateFn) stateFn(ctx.state); };
      if (ctx && music.want) startTrack(music.want, 0, ET.CONFIG.musicFade);   // the track waiting for sound to be allowed
    },
    /* E40: told whenever the context starts or stops running (the title's prompt follows it). */
    onState: function (fn) { stateFn = fn; },
    unlock: function () {
      if (!ET.CONFIG.sound) return;
      if (!ctx) { ET.audio.autoplay(); return; }
      if (ctx.state === "suspended" && !hidden()) { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); }
    },
    /* E35: true while the browser still holds sound back (no key or click yet, and no autoplay). */
    locked: function () { return !ctx || ctx.state !== "running"; },

    /* The pan on the egg: a bright metallic ring, its pitch nudged each time. */
    thong: function () {
      var j = 1 + (Math.random() * 2 - 1) * ET.CONFIG.thongPitchJitter;
      duck(0.45);   // E36
      tone("triangle", 660 * j, 520 * j, 0.45, 0.35);
      tone("sine", 1720 * j, 1500 * j, 0.3, 0.12);
      noise(0.05, 0.25, 3000);
    },

    ding: function () { tone("sine", 1568, 0, 0.35, 0.18, 0.08); tone("sine", 2093, 0, 0.3, 0.1, 0.14); },

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
      noise(0.012, 0.04, 2400);                         // the lips' tiny click (0.06 could peak it past its limit)
      return j;
    },

    /* ⏳ placeholder: the scary mom face's creepy hiss and wet gurgle, not a scream (Refinement 5 §5). */
    hiss: function (seconds, volume) {
      var a = ready();
      if (!a) return;
      duck(seconds);   // E36
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

    buzz: function () { duck(0.22); tone("sawtooth", 140, 120, 0.22, 0.18); },   // E36: the music dips under it

    /* Music: which track should play (null for none). The same track carries on; another fades the current one out and
       itself in. Before sound is allowed it waits, and starts on the first key or click. */
    music: function (k) {
      if (!ET.CONFIG.sound || music.want === k) return;
      music.want = k;
      music.paused = false;
      if (!ctx) return;
      if (music.cur && music.cur.name !== k) { stopTrack(music.cur, ET.CONFIG.musicFade); music.cur = null; }
      if (k) startTrack(k, 0, ET.CONFIG.musicFade);
    },
    /* Esc: the track pauses where it is, and resumes from there. */
    musicPause: function (on) {
      if (!ctx || music.paused === on) return;
      if (on) {
        if (!music.cur) return;
        music.paused = true;
        music.at = position(music.cur);
        stopTrack(music.cur, ET.CONFIG.musicPauseFade);
        music.cur = null;
      } else {
        music.paused = false;
        if (music.want) startTrack(music.want, music.at || 0, ET.CONFIG.musicPauseFade);
      }
    },
    /* For rigs: end the playing track now, as if it had played out (its "ended" runs as for a real end). */
    endMusicForRig: function () { if (!music.cur) return false; try { music.cur.src.stop(); } catch (e) { return false; } return true; },
    /* Told when a track that plays once (the game-over track) reaches its end. */
    onMusicEnd: function (fn) { music.ended = fn; },
    /* For rigs: the music now: the track, where it is (seconds into its file), and the log of starts and ends. */
    musicState: function () {
      return { want: music.want, playing: music.cur ? music.cur.name : null, paused: music.paused,
               at: music.cur && ctx ? position(music.cur) : null, level: music.cur ? music.cur.gain.gain.value : null,
               duck: mout ? mout.gain.value : 1, log: music.log.slice() };
    },
    tunePlaying: function () { return !!music.cur && music.cur.name === "title"; },

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
        // `active`: the loudness while the sound sounds (from its first to its last sample above 1% of its peak)
        var a0 = 0, a1 = d.length - 1, q = 0;
        while (a0 < d.length && Math.abs(d[a0]) < peak * 0.01) a0++;
        while (a1 > a0 && Math.abs(d[a1]) < peak * 0.01) a1--;
        for (var j = a0; j <= a1; j++) q += d[j] * d[j];
        return { peak: peak, rms: Math.sqrt(sum / d.length), active: Math.sqrt(q / Math.max(1, a1 - a0 + 1)) };
      });
    },
    CEILING: CEILING,
    LEVEL: LEVEL
  };
})(window);
