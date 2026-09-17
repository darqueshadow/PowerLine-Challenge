/* ===========================================================================
   EGG TIMER — COMMAND BOXES (packet §12)
   1–4 boxes inside the page, one active at a time, each with its own colour.
   Keys, all bound here, in-page (no Fang Rock involvement):
     Tab / Shift+Tab   open the switcher (does nothing with only 1 box)
       in the switcher: Tab / Shift+Tab / arrows move, Enter confirms, Esc closes
     Enter             submit the active box
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
  var hooks = {};

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
    for (var i = 0; i < count; i++) {
      var li = document.createElement("li");
      li.style.setProperty("--box", COLORS[i]);
      li.classList.toggle("hl", i === highlight);
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
    highlight = (active + dir + count) % count;
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
    if (confirm) active = highlight;
    open = false;
    switcherEl.hidden = true;
    paint();
    ET.boxes.focus();
  }

  function submit() {
    var b = boxes[active];
    var text = b.input.value;
    if (!text.trim()) return;
    var r = hooks.submit ? hooks.submit(text) : { ok: false };
    if (r.ok || !ET.CONFIG.keepTextOnReject) b.input.value = "";   // D6 (ruled): rejected text stays
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
        el.innerHTML = '<span class="num">' + (i + 1) + '</span><input type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="60">';
        consoleEl.appendChild(el);
        var input = el.querySelector("input");
        input.setAttribute("aria-label", "Command Box " + (i + 1));
        input.addEventListener("mousedown", function (ev) { ev.preventDefault(); ET.boxes.focus(); });
        boxes.push({ el: el, input: input });
      }
      paint();
    },

    setup: function (n) {
      count = Math.max(ET.CONFIG.boxesMin, Math.min(ET.CONFIG.boxesMax, n));
      active = 0;
      open = false;
      switcherEl.hidden = true;
      boxes.forEach(function (b) { b.input.value = ""; });
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

    close: function () { if (open) closeSwitcher(false); },

    /* The play screen's keyboard. Returns true when it handled the key. */
    key: function (ev) {
      var k = ev.key;
      if (k === "F12") {
        ev.preventDefault();
        boxes[active].input.value = "";
        if (open) renderSwitcher();
        return true;
      }
      if (open) {
        if (k === "Tab") { ev.preventDefault(); move(ev.shiftKey ? -1 : 1); return true; }
        if (k === "ArrowDown" || k === "ArrowRight") { ev.preventDefault(); move(1); return true; }
        if (k === "ArrowUp" || k === "ArrowLeft") { ev.preventDefault(); move(-1); return true; }
        if (k === "Enter") { ev.preventDefault(); closeSwitcher(true); return true; }
        if (k === "Escape") { ev.preventDefault(); closeSwitcher(false); return true; }
        if (k.length === 1 || k === "Backspace" || k === "Delete") { ev.preventDefault(); return true; }
        return false;
      }
      if (k === "Tab") { ev.preventDefault(); openSwitcher(ev.shiftKey ? -1 : 1); return true; }
      if (k === "Enter") { ev.preventDefault(); submit(); return true; }
      return false;
    },

    /* For rigs. */
    state: function () {
      return {
        count: count, active: active, open: open, highlight: highlight,
        values: boxes.slice(0, count).map(function (b) { return b.input.value; }),
        focused: document.activeElement === (boxes[active] && boxes[active].input)
      };
    }
  };
})(window);
