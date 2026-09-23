/* ===========================================================================
   EGG TIMER — COMMAND LINES (packet §12). Players see "Command Line" (E7); the
   code still calls them boxes.
   1–4 boxes inside the page, one active at a time, each with its own colour.
   Keys, all bound here, in-page:
     Tab / Shift+Tab   open the switcher (does nothing with only 1 box). Refinement 2 §4:
                       the list is most-recently-used first, and it opens on the LAST-USED
                       box; a quick tap-and-release of Tab flips straight to it.
       in the switcher: Tab / Shift+Tab / arrows move, Enter confirms, Esc closes
     Ctrl+Tab          the same as Tab, but only inside Fang Rock (a browser keeps Ctrl+Tab)
     Enter             submit the active box. Any rejected Enter clears it and shows a
                       red ERROR under it, with a buzz (Refinement 2 §6).
     F12               clear the active box, no penalty (the arcade-wide meaning)
     Esc               close the switcher if it's open; otherwise pause / resume
   Text staged in an inactive box clears when a new wave starts.
   The game keeps running while the switcher is open.
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});

  // ⏳ Placeholder colours — the look of the boxes and switcher is still undesigned.
  var COLORS = ["#22e3ff", "#ff3df2", "#ffe23d", "#7dff3d"];

  var consoleEl, switcherEl, listEl;
  var boxes = [];       // { el, input }
  var count = 1, active = 0, highlight = 0, open = false;
  var order = [0];      // box numbers, most recently used first; order[0] is the active box
  var tap = null;       // { at, clean }: the Tab press that opened the switcher, for a quick flip
  var hooks = {};

  /* Inside Fang Rock? The shell flags only its own top page, and the game runs in the
     hub's frame, so look there too, and at the shell's own arcade: scheme. */
  function inFangRock() {
    try {
      if (root.fangRockShell === true) return true;
      if (root.parent && root.parent !== root && root.parent.fangRockShell === true) return true;
    } catch (e) { /* a cross-origin parent: not the shell */ }
    return root.location.protocol === "arcade:";
  }

  function paint() {
    boxes.forEach(function (b, i) {
      var on = i < count;
      b.el.hidden = !on;
      b.el.classList.toggle("active", i === active);
      b.input.readOnly = i !== active || open;   // nothing types into a box behind the switcher
      b.input.tabIndex = -1;
    });
  }

  function renderSwitcher() {
    listEl.innerHTML = "";
    for (var k = 0; k < count; k++) {
      var i = order[k];
      var li = document.createElement("li");
      li.style.setProperty("--box", COLORS[i]);
      li.classList.toggle("hl", k === highlight);
      li.classList.toggle("current", i === active);
      var num = document.createElement("span");
      num.className = "num";
      num.textContent = i + 1;
      var prev = document.createElement("span");
      prev.className = "preview";
      prev.textContent = boxes[i].input.value || "(empty)";
      li.appendChild(num);
      li.appendChild(prev);
      listEl.appendChild(li);
    }
  }

  function openSwitcher(dir) {
    if (count < 2) return;               // one box: Tab is a no-op
    open = true;
    // the list is most-recent first, so the last-used box is next; Shift+Tab starts from the far end
    highlight = dir > 0 ? 1 : count - 1;
    // take the caret out of the box and lock it, so nothing (keys, paste, IME) types into it behind the switcher
    boxes[active].input.blur();
    paint();
    switcherEl.hidden = false;
    renderSwitcher();
  }

  function move(dir) {
    highlight = (highlight + dir + count) % count;
    renderSwitcher();
  }

  function closeSwitcher(confirm) {
    if (confirm) {
      var chosen = order[highlight];
      order.splice(highlight, 1);
      order.unshift(chosen);
      active = chosen;
    }
    open = false;
    tap = null;
    switcherEl.hidden = true;
    paint();
    ET.boxes.focus();
  }

  function submit() {
    var b = boxes[active];
    var text = b.input.value;
    if (!text.trim() && !ET.CONFIG.errorOnEmpty) return;   // ⏳ E6: an empty Enter does nothing
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
      switcherEl = document.querySelector("#switcher");
      listEl = switcherEl.querySelector("ol");
      for (var i = 0; i < ET.CONFIG.boxesMax; i++) {
        var el = document.createElement("div");
        el.className = "box";
        el.style.setProperty("--box", COLORS[i]);
        el.innerHTML = '<span class="num">' + (i + 1) + '</span><input type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="60">' +
          '<span class="err" aria-live="assertive">ERROR</span>';
        consoleEl.appendChild(el);
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
      order = [];
      for (var i = 0; i < count; i++) order.push(i);
      open = false;
      tap = null;
      switcherEl.hidden = true;
      boxes.forEach(function (b) { b.input.value = ""; b.el.classList.remove("rejected"); });
      paint();
    },

    focus: function () {
      var b = boxes[active];
      if (b && !open) b.input.focus({ preventScroll: true });
    },

    /* A new wave clears what's staged in the inactive boxes. */
    clearInactive: function () {
      boxes.forEach(function (b, i) { if (i !== active) b.input.value = ""; });
      if (open) renderSwitcher();
    },

    isOpen: function () { return open; },

    inFangRock: inFangRock,

    close: function () { if (open) closeSwitcher(false); },

    /* The play screen's keyboard. Returns true when it handled the key. */
    key: function (ev) {
      var k = ev.key;
      // Ctrl+Tab is a switch key only inside Fang Rock; in a browser it's the browser's
      if (k === "Tab" && (ev.ctrlKey || ev.metaKey) && !inFangRock()) return false;
      if (open && tap && k !== "Tab") tap.clean = false;   // anything else pressed: not a quick tap
      if (k === "F12") {
        ev.preventDefault();
        boxes[active].input.value = "";
        if (open) renderSwitcher();
        return true;
      }
      if (open) {
        if (k === "Tab") {
          ev.preventDefault();
          if (!ev.repeat) { if (tap) tap.clean = false; move(ev.shiftKey ? -1 : 1); }   // a held Tab doesn't spin the list
          return true;
        }
        if (k === "ArrowDown" || k === "ArrowRight") { ev.preventDefault(); move(1); return true; }
        if (k === "ArrowUp" || k === "ArrowLeft") { ev.preventDefault(); move(-1); return true; }
        if (k === "Enter") { ev.preventDefault(); closeSwitcher(true); return true; }
        if (k === "Escape") { ev.preventDefault(); closeSwitcher(false); return true; }
        if (k.length === 1 || k === "Backspace" || k === "Delete") { ev.preventDefault(); return true; }
        return false;
      }
      if (k === "Tab") {
        ev.preventDefault();
        if (ev.repeat) return true;
        openSwitcher(ev.shiftKey ? -1 : 1);
        if (open) tap = { at: performance.now(), clean: true };
        return true;
      }
      if (k === "Enter") { ev.preventDefault(); submit(); return true; }
      return false;
    },

    /* A Tab released quickly, with nothing else pressed, flips to the highlighted
       (last-used) box without waiting for Enter. Held longer, the switcher stays open. */
    keyUp: function (ev) {
      if (ev.key !== "Tab" || !open || !tap) return false;
      var quick = tap.clean && performance.now() - tap.at <= ET.CONFIG.tapSeconds * 1000;
      tap = null;
      if (quick) closeSwitcher(true);
      return quick;
    },

    /* For rigs. */
    state: function () {
      return {
        count: count, active: active, open: open, highlight: highlight, order: order.slice(),
        highlighted: open ? order[highlight] : null,
        error: boxes.slice(0, count).map(function (b) { return b.el.classList.contains("rejected"); }),
        values: boxes.slice(0, count).map(function (b) { return b.input.value; }),
        focused: document.activeElement === (boxes[active] && boxes[active].input)
      };
    }
  };
})(window);
