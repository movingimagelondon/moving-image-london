// Site settings shared by the admin page and the public site.
// Settings are colours (light + dark), text size, column width, the film background, two lines of wording,
// and how many days count as "closing soon". Anything missing or invalid falls back to the defaults.
var MIL_SETTINGS = (function () {
  var DEFAULTS = {
    light: { paper: "#ffffff", ink: "#111111", dim: "#6b6b6b", link: "#0000ee", alert: "#b3261e" },
    dark: { paper: "#0b0b0b", ink: "#dcdcd6", dim: "#8a8a84", link: "#8fa8ff", alert: "#ff8a7a" },
    textSize: 14, width: 72,
    film: true, filmLight: 0.2, filmDark: 0.26,
    tagline: "artists' film + video in london: exhibitions and screenings",
    footer: "venue pages checked weekly. confirm dates with the venue before you go.",
    closingDays: 14
  };
  var COLOURS = ["paper", "ink", "dim", "link", "alert"];
  function hex(v, d) { return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d; }
  function num(v, d, lo, hi) { var n = Number(v); return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; }
  function str(v, d, max) { return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : d; }
  function clean(s) {
    s = s || {}; var o = { light: {}, dark: {} };
    COLOURS.forEach(function (k) {
      o.light[k] = hex(s.light && s.light[k], DEFAULTS.light[k]);
      o.dark[k] = hex(s.dark && s.dark[k], DEFAULTS.dark[k]);
    });
    o.textSize = num(s.textSize, DEFAULTS.textSize, 12, 18);
    o.width = num(s.width, DEFAULTS.width, 56, 96);
    o.film = s.film === undefined ? DEFAULTS.film : !!s.film;
    o.filmLight = num(s.filmLight, DEFAULTS.filmLight, 0, 0.6);
    o.filmDark = num(s.filmDark, DEFAULTS.filmDark, 0, 0.6);
    o.tagline = str(s.tagline, DEFAULTS.tagline, 160);
    o.footer = str(s.footer, DEFAULTS.footer, 240);
    o.closingDays = Math.round(num(s.closingDays, DEFAULTS.closingDays, 1, 60));
    return o;
  }
  function vars(c, op) {
    return "--paper:" + c.paper + ";--ink:" + c.ink + ";--dim:" + c.dim + ";--link:" + c.link + ";--alert:" + c.alert + ";--film-opacity:" + op + ";";
  }
  function css(s) {
    return ":root{" + vars(s.light, s.filmLight) + "}" +
      "@media (prefers-color-scheme: dark){:root:not([data-theme=\"light\"]){" + vars(s.dark, s.filmDark) + "}}" +
      ":root[data-theme=\"dark\"]{" + vars(s.dark, s.filmDark) + "}" +
      "body{font-size:" + s.textSize + "px}h1,h2{font-size:1em}.wrap{max-width:" + s.width + "ch}" +
      (s.film ? "" : "#bg{display:none!important}");
  }
  function apply(s) {
    s = clean(s);
    var tag = document.getElementById("site-settings");
    if (!tag) { tag = document.createElement("style"); tag.id = "site-settings"; document.head.appendChild(tag); }
    tag.textContent = css(s);
    var t = document.getElementById("tagline"); if (t) t.textContent = s.tagline;
    var f = document.getElementById("footnote"); if (f) f.textContent = s.footer;
    var v = document.getElementById("bg");
    if (v) { if (!s.film && v.pause) v.pause(); else if (s.film && v.paused && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) { var p = v.play && v.play(); if (p && p.catch) p.catch(function () {}); } }
    return s;
  }
  return { DEFAULTS: DEFAULTS, COLOURS: COLOURS, clean: clean, apply: apply };
})();
