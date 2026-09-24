/* ===========================================================================
   EGG TIMER — COMMAND LINES (packet §12). Players see "Command Line" (E7); the
   code still calls them boxes.
   1–4 boxes inside the page, one active at a time, each with its own colour.
   Keys, all bound here, in-page (Refinement 3 §1, as in real CAD5):
     Tab         the NEXT Command Line; the text in every line is kept
     Shift+Tab   the PREVIOUS Command Line, text kept
     F12         the NEXT Command Line, and clear it (with 1 line: just clear it)
     Enter       submit the active box. Any rejected Enter clears it and shows a
                 red ERROR under it, with a buzz (Refinement 2 §6).
   All of them wrap at the ends; with 1 line Tab does nothing. Ctrl+Tab, Alt and
   the arrows are left alone (Left/Right move the text cursor as normal).
   Esc (pause) is script.js's. Text staged in an inactive box clears when a new
   wave starts.
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});

  // ⏳ Placeholder colours — the look of the boxes is still undesigned.
  var COLORS = ["#22e3ff", "#ff3df2", "#ffe23d", "#7dff3d"];

  var consoleEl;
  var boxes = [];       // { el, input }
  var count = 1, active = 0;
  var hooks = {};

  function paint() {
    boxes.forEach(function (b, i) {
      b.el.hidden = i >= count;
      b.el.classList.toggle("active", i === active);
      b.input.readOnly = i !== active;
      b.input.tabIndex = -1;
    });
  }

  /* One quick bright flash on the line just switched to (the resting pulse is CSS). */
  function flash() {
    var el = boxes[active].el;
    el.classList.remove("switched");
    void el.offsetWidth;
    el.classList.add("switched");
  }

  function switchTo(i) {
    active = (i + count) % count;
    paint();
    flash();
    ET.boxes.focus();
  }

  function submit() {
    var b = boxes[active];
    var text = b.input.value;
    if (!text.trim() && !ET.CONFIG.errorOnEmpty) return;   // E6: an empty Enter does nothing
    var r = hooks.submit ? hooks.submit(text) : { ok: false };
    if (r.ok || !ET.CONFIG.keepTextOnReject) b.input.value = "";
    if (!r.ok && !r.blocked) showError(b);
  }

  /* Refinement 2 §6: a red ERROR under the Command Line for about a second, and a buzz. */
  function showError(b) {
    b.el.classList.remove("rejected");
    void b.el.offsetWidth;
    b.el.style.setProperty("--error", ET.CONFIG.errorSeconds + "s");
    b.el.classList.add("rejected");
    clearTimeout(b.errorTimer);
    b.errorTimer = setTimeout(function () { b.el.classList.remove("rejected"); }, ET.CONFIG.errorSeconds * 1000);
    if (ET.audio) ET.audio.buzz();
  }

  ET.boxes = {
    COLORS: COLORS,

    build: function (h) {
      hooks = h || {};
      consoleEl = document.querySelector("#console");
      consoleEl.style.setProperty("--pulse", ET.CONFIG.pulseSeconds + "s");
      consoleEl.style.setProperty("--flash", ET.CONFIG.switchFlashSeconds + "s");
      for (var i = 0; i < ET.CONFIG.boxesMax; i++) {
        var el = document.createElement("div");
        el.className = "box";
        el.style.setProperty("--box", COLORS[i]);
        // E28: a grey "RCAV + unit" in an empty line, gone as soon as the player types
        el.innerHTML = '<span class="num">' + (i + 1) + '</span><input type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="60" placeholder="RCAV + unit">' +
          '<span class="err" aria-live="assertive">ERROR</span>';
        consoleEl.insertBefore(el, document.querySelector("#line-hints"));
        var input = el.querySelector("input");
        input.setAttribute("aria-label", "Command Line " + (i + 1));
        input.addEventListener("mousedown", function (ev) { ev.preventDefault(); ET.boxes.focus(); });
        boxes.push({ el: el, input: input });
      }
      paint();
    },

    setup: function (n) {
      count = Math.max(ET.CONFIG.boxesMin, Math.min(ET.CONFIG.boxesMax, n));
      active = 0;
      boxes.forEach(function (b) { b.input.value = ""; b.el.classList.remove("rejected", "switched"); });
      paint();
    },

    focus: function () {
      var b = boxes[active];
      if (b) b.input.focus({ preventScroll: true });
    },

    /* A new wave clears what's staged in the inactive boxes. */
    clearInactive: function () {
      boxes.forEach(function (b, i) { if (i !== active) b.input.value = ""; });
    },

    /* The play screen's keyboard. Returns true when it handled the key. */
    key: function (ev) {
      var k = ev.key;
      // Ctrl+Tab (retired, Refinement 3) and Alt+Tab stay the browser's and the system's
      if ((k === "Tab" || k === "F12") && (ev.ctrlKey || ev.metaKey || ev.altKey)) return false;
      if (k === "Tab") {
        ev.preventDefault();
        if (count > 1) switchTo(active + (ev.shiftKey ? -1 : 1));
        return true;
      }
      if (k === "F12") {
        ev.preventDefault();
        if (ev.shiftKey) return true;                              // no Shift+F12
        // ⏳ E13: which line F12 clears, the one it lands on or the one it leaves
        if (count > 1 && ET.CONFIG.f12Clears === "left") boxes[active].input.value = "";
        if (count > 1) switchTo(active + 1);
        if (count === 1 || ET.CONFIG.f12Clears !== "left") boxes[active].input.value = "";
        return true;
      }
      if (k === "Enter") { ev.preventDefault(); submit(); return true; }
      return false;
    },

    /* For rigs. */
    state: function () {
      return {
        count: count, active: active,
        error: boxes.slice(0, count).map(function (b) { return b.el.classList.contains("rejected"); }),
        values: boxes.slice(0, count).map(function (b) { return b.input.value; }),
        focused: document.activeElement === (boxes[active] && boxes[active].input)
      };
    }
  };
})(window);
