/* ===========================================================================
   EGG TIMER — DEVELOPER MODE
   Laws: Ctrl+Shift+B (lowercase b too) → a timed password prompt → toggles
   Developer Mode. In Egg Timer, Developer Mode swaps the CAV type table for the
   Blank Dataset Module, from the next game on. Hidden from players: nothing on
   screen mentions it until the gate opens.
   ⏳ D3: this cartridge's phrase is Andrew's to set. Until
   CONFIG.devModePasswordHash is filled in, every entry is denied.
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});

  var promptEl, input, bar, msg, badge;
  var timer = null, openAt = 0, raf = null;
  var hooks = {};

  function close() {
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    promptEl.hidden = true;
    input.value = "";
    msg.textContent = "";
    if (hooks.closed) hooks.closed();
  }

  function tick() {
    var left = 1 - (Date.now() - openAt) / ET.CONFIG.devModeTimeout;
    bar.style.transform = "scaleX(" + Math.max(0, left) + ")";
    if (left > 0 && !promptEl.hidden) raf = requestAnimationFrame(tick);
  }

  ET.devmode = {
    on: false,

    build: function (h) {
      hooks = h || {};
      promptEl = document.querySelector("#dev-prompt");
      input = promptEl.querySelector("input");
      bar = promptEl.querySelector(".bar i");
      msg = promptEl.querySelector(".msg");
      badge = document.querySelector("#dev-badge");
      input.addEventListener("keydown", function (ev) {
        ev.stopPropagation();
        if (ev.key === "Enter") {
          ev.preventDefault();
          var hash = ET.CONFIG.devModePasswordHash;
          if (hash && ET.plcDigest(input.value) === hash) {
            ET.devmode.on = !ET.devmode.on;
            badge.hidden = !ET.devmode.on;
            close();
            if (hooks.toggled) hooks.toggled(ET.devmode.on);
          } else {
            msg.textContent = "ACCESS DENIED";
            input.value = "";
          }
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          close();
        }
      });
    },

    isOpen: function () { return promptEl && !promptEl.hidden; },

    /* Ctrl+Shift+B from anywhere. Returns true when it handled the key. */
    key: function (ev) {
      if (!(ev.ctrlKey && ev.shiftKey && (ev.key === "B" || ev.key === "b"))) return false;
      ev.preventDefault();
      if (ET.devmode.isOpen()) return true;
      promptEl.hidden = false;
      msg.textContent = "";
      input.value = "";
      input.focus();
      openAt = Date.now();
      tick();
      timer = setTimeout(close, ET.CONFIG.devModeTimeout);
      if (hooks.opened) hooks.opened();
      return true;
    }
  };
})(window);
