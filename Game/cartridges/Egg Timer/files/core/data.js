/* ===========================================================================
   EGG TIMER — DATA
   Two sources, both real:
   - the CAV type table, datasets/cav_types.csv (Andrew's durations, packet §3),
     kept as data so real OOS reasons can be added without touching code;
   - the transport units, from the shared Data Sheet at
     Game/datasets/AP_ENP_BSE/2. Units_Transports.csv (packet §4: transports only).
   Developer Mode swaps the type table for the Blank Dataset Module
   (datasets/cav_types_blank.csv). By ruling D1 it holds a Developer-Mode-only
   copy of the seven real types, with the same values. A change to the real
   table doesn't reach it: edit both.
   Needs http:// (or Fang Rock's arcade:// scheme): a file:// page can't fetch.
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});

  var PATHS = {
    types: "datasets/cav_types.csv",
    blank: "datasets/cav_types_blank.csv",
    units: "../../../datasets/AP_ENP_BSE/2. Units_Transports.csv"
  };

  function rows(text) {
    return String(text)
      .replace(/^﻿/, "")
      .split(/\r?\n/)
      .map(function (l) { return l.trim(); })
      .filter(function (l) { return l.length > 0; })
      .map(function (l) { return l.split(",").map(function (c) { return c.trim(); }); });
  }

  function yes(v) { return /^(yes|true|1)$/i.test(String(v)); }

  /* A problem with a sheet's contents, not with fetching it: the title says what's wrong with which sheet
     (`sheet` is "units" or "types"), without the http:// hint a failed fetch gets. */
  function sheetError(sheet, message) {
    var e = new Error(message);
    e.sheet = sheet;
    return e;
  }

  ET.data = {
    PATHS: PATHS,

    parseTypes: function (text) {
      var r = rows(text);
      if (!r.length) return [];
      var head = r[0].map(function (h) { return h.toLowerCase(); });
      var col = function (name) { return head.indexOf(name); };
      var need = ["code", "meaning", "min_minutes", "max_minutes", "two_phase_only", "hidden_until_trigger"];
      need.forEach(function (n) {
        if (col(n) < 0) throw sheetError("types", "The CAV type table has no \"" + n + "\" column.");
      });
      return r.slice(1).map(function (c) {
        return {
          code: c[col("code")].toUpperCase(),
          meaning: c[col("meaning")],
          min: Number(c[col("min_minutes")]),
          max: Number(c[col("max_minutes")]),
          twoPhaseOnly: yes(c[col("two_phase_only")]),
          hiddenUntilTrigger: yes(c[col("hidden_until_trigger")])
        };
      }).filter(function (t) {
        return t.code && isFinite(t.min) && isFinite(t.max) && t.min > 0 && t.max >= t.min;
      });
    },

    /* The transport units, from the sheet's "Units" column, found by its header rather than by position
       (Andrew, 2026-09-24). D2 never puts a unit on two nests at once, so the game needs at least one different
       unit for every nest: a sheet that can't give that refuses to start, saying why, rather than doubling units up. */
    parseUnits: function (text) {
      var r = rows(text);
      if (!r.length) throw sheetError("units", "The transport unit sheet is empty.");
      var col = r[0].map(function (h) { return h.toLowerCase(); }).findIndex(function (h) { return h === "units" || h === "unit"; });
      if (col < 0) throw sheetError("units", "The transport unit sheet has no \"Units\" column.");
      var units = r.slice(1).map(function (c) { return c[col]; }).filter(function (u) { return /^\d{4}$/.test(u); });
      var distinct = units.filter(function (u, i) { return units.indexOf(u) === i; }).length;
      var need = ET.CONFIG.nestsCap;
      if (!distinct) throw sheetError("units", "The transport unit sheet lists no four-digit unit numbers.");
      if (distinct < need) {
        throw sheetError("units", "The transport unit sheet lists only " + distinct + " different unit" + (distinct === 1 ? "" : "s") +
          "; the game needs at least " + need + ", one for every nest.");
      }
      return units;
    },

    fetchText: function (path) {
      return fetch(encodeURI(path), { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error(path + " → HTTP " + r.status);
        return r.text();
      });
    },

    load: function () {
      var d = ET.data;
      return Promise.all([d.fetchText(PATHS.types), d.fetchText(PATHS.blank), d.fetchText(PATHS.units)])
        .then(function (t) {
          var types = d.parseTypes(t[0]), blankTypes;
          try { blankTypes = d.parseTypes(t[1]); } catch (e) { if (e.sheet) e.sheet = "blank"; throw e; }   // name the right file
          return { types: types, blankTypes: blankTypes, units: d.parseUnits(t[2]) };
        });
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
