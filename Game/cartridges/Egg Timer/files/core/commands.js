/* ===========================================================================
   EGG TIMER — COMMANDS
   Real PowerLine syntax only (packet §2):
     CAV #### TYPE            place a CAV (optional trailing ", comment")
     RCAV ####                clear a CAV
   Parsing only decides WHAT was typed. Whether it does anything is the game's
   call, and a command that does nothing is rejected silently.
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});

  var CAV = /^CAV\s+(\d{4})\s+([A-Z]+)\s*(?:,(.*))?$/;
  var RCAV = /^RCAV\s+(\d{4})$/;

  ET.commands = {
    normalize: function (text) {
      return String(text || "").trim().replace(/\s+/g, " ").toUpperCase();
    },

    parse: function (text) {
      var s = ET.commands.normalize(text);
      var m = CAV.exec(s);
      if (m) return { kind: "cav", unit: m[1], type: m[2], comment: (m[3] || "").trim() };
      m = RCAV.exec(s);
      if (m) return { kind: "rcav", unit: m[1] };
      return null;
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
