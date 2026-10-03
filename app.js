// moving image london: public listings.
// Reads listings.json (exported from the editor page) and renders the exhibitions and screenings tabs.
// The submission form posts to Web3Forms, which emails each entry to the editor for review.
(function () {
  var state = { tab: "exhibitions", when: "all", free: false, listings: [], ready: false, failed: false };
  var DAY = 86400000;
  var settings = { closingDays: 14 };

  function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function parse(s) { if (!s) return null; var p = String(s).split("-"); if (p.length !== 3) return null; return new Date(+p[0], +p[1] - 1, +p[2]); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function dm(d) { return pad(d.getDate()) + "." + pad(d.getMonth() + 1); }
  function dmy(d) { return dm(d) + "." + String(d.getFullYear()).slice(2); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function safeUrl(u) { try { var x = new URL(u); return (x.protocol === "https:" || x.protocol === "http:") ? x.href : null; } catch (e) { return null; } }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u; } }
  function kindOf(x) { return x.kind === "screening" ? "screening" : "exhibition"; }
  function lastDay(item) { return parse(item.end) || parse(item.start); }

  function statusOf(item) {
    var t = today(), s = parse(item.start), e = lastDay(item);
    if (!e || e < t) return null;
    var left = Math.round((e - t) / DAY);
    if (kindOf(item) === "screening") {
      var single = !item.end || item.end === item.start;
      if (s && s > t) {
        var until = Math.round((s - t) / DAY);
        return { key: "soon", until: until, label: until === 1 ? "[tomorrow]" : until <= 6 ? "[in " + until + "d]" : "[" + dm(s) + "]" };
      }
      if (single || left === 0) return { key: "now", until: 0, label: "[today]" };
      return { key: "now", until: 0, label: "[on now]" };
    }
    if (s && s > t) return { key: "soon", label: "[opens " + dm(s) + "]" };
    if (left === 0) return { key: "closing", label: "[last day]", closing: true };
    if (left <= settings.closingDays) return { key: "closing", label: "[closes in " + left + "d]", closing: true };
    return { key: "now", label: "[on now]" };
  }

  var FILTERS = {
    exhibitions: [["all", "all"], ["now", "on now"], ["soon", "opening soon"], ["closing", "closing soon"]],
    screenings: [["all", "all"], ["week", "next 7 days"], ["month", "next 30 days"]]
  };
  function buildFilters() {
    var box = document.getElementById("f-when"); box.textContent = "";
    FILTERS[state.tab].forEach(function (f) {
      var b = el("button", "tog", f[1]); b.type = "button"; b.dataset.when = f[0];
      b.setAttribute("aria-pressed", String(state.when === f[0])); box.appendChild(b);
    });
    document.querySelectorAll("#tabs [data-tab]").forEach(function (t) {
      var on = t.dataset.tab === state.tab; t.setAttribute("aria-selected", String(on)); t.classList.toggle("on", on);
    });
  }
  function setTab(tab) {
    if (!FILTERS[tab]) tab = "exhibitions";
    state.tab = tab; state.when = "all"; buildFilters(); render();
    try { history.replaceState(null, "", "#" + tab); } catch (e) {}
  }
  document.getElementById("tabs").addEventListener("click", function (ev) { var t = ev.target.closest("[data-tab]"); if (t) setTab(t.dataset.tab); });
  document.getElementById("f-when").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-when]"); if (!b) return;
    state.when = b.dataset.when;
    this.querySelectorAll("[data-when]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    render();
  });
  document.getElementById("f-free").addEventListener("click", function () {
    state.free = !state.free; this.setAttribute("aria-pressed", String(state.free)); render();
  });

  function dateLine(item) {
    var s = parse(item.start), e = parse(item.end);
    if (kindOf(item) === "screening") {
      if (s && e && item.end !== item.start) return dmy(s) + " -> " + dmy(e);
      return (s ? dmy(s) : "") + (item.time ? "  " + item.time : "");
    }
    return (s ? dmy(s) + " -> " : "until ") + dmy(e);
  }
  function row(item) {
    var st = statusOf(item);
    var li = el("li", "item");
    var top = el("div", "top");
    top.appendChild(el("span", "when", dateLine(item)));
    var tags = el("span", "tags");
    if (item.free) tags.appendChild(el("span", "status", "[free]"));
    tags.appendChild(el("span", "status" + (st.closing ? " closing" : ""), st.label));
    top.appendChild(tags);
    li.appendChild(top);
    li.appendChild(el("p", "title", item.title));
    if (item.artists) li.appendChild(el("p", null, item.artists));
    li.appendChild(el("p", "venue", item.venue));
    if (item.address) li.appendChild(el("p", "dim", item.address));
    if (item.medium) li.appendChild(el("p", "line", item.medium));
    var href = safeUrl(item.url);
    if (href) { var p = el("p", "line"); var l = el("a", null, host(href)); l.href = href; l.target = "_blank"; l.rel = "noopener"; p.appendChild(l); li.appendChild(p); }
    return li;
  }

  function render() {
    var list = document.getElementById("list"), tally = document.getElementById("tally");
    list.textContent = "";
    if (state.failed) { tally.textContent = "listings didn't load"; list.appendChild(el("li", "empty", "couldn't load the listings. reload the page to try again.")); return; }
    if (!state.ready) { tally.textContent = "loading…"; list.appendChild(el("li", "empty", "loading listings…")); return; }
    var live = state.listings.filter(function (i) { return i && i.title && statusOf(i); });
    var ex = live.filter(function (i) { return kindOf(i) === "exhibition"; }), sc = live.filter(function (i) { return kindOf(i) === "screening"; });
    var exSoon = ex.filter(function (i) { return statusOf(i).key === "soon"; }).length;
    var scWeek = sc.filter(function (i) { return statusOf(i).until <= 6; }).length;
    tally.textContent = state.tab === "screenings"
      ? sc.length + " screenings / " + scWeek + " in the next 7 days / " + dmy(today())
      : (ex.length - exSoon) + " on now / " + exSoon + " opening soon / " + dmy(today());
    document.getElementById("count-ex").textContent = " (" + ex.length + ")";
    document.getElementById("count-sc").textContent = " (" + sc.length + ")";

    var items = state.tab === "screenings" ? sc : ex;
    var shown = items.filter(function (i) {
      var st = statusOf(i);
      if (state.free && !i.free) return false;
      if (state.when === "now") return st.key !== "soon";
      if (state.when === "soon") return st.key === "soon";
      if (state.when === "closing") return !!st.closing;
      if (state.when === "week") return st.until <= 6;
      if (state.when === "month") return st.until <= 29;
      return true;
    });
    if (state.tab === "screenings") {
      shown.sort(function (a, b) { return (parse(a.start) - parse(b.start)) || String(a.time).localeCompare(String(b.time)); });
    } else {
      shown.sort(function (a, b) {
        var ra = statusOf(a).key === "soon" ? 1 : 0, rb = statusOf(b).key === "soon" ? 1 : 0;
        if (ra !== rb) return ra - rb;
        return ra ? parse(a.start) - parse(b.start) : lastDay(a) - lastDay(b);
      });
    }
    if (!items.length) { list.appendChild(el("li", "empty", state.tab === "screenings" ? "no screenings listed right now." : "no exhibitions listed right now.")); return; }
    if (!shown.length) { list.appendChild(el("li", "empty", "nothing matches.")); return; }
    shown.forEach(function (i) { list.appendChild(row(i)); });
  }

  // ---- submission form (Web3Forms) ----
  var form = document.getElementById("form"), msg = document.getElementById("msg");
  var EVENT_FIELDS = ["f-title", "f-artists", "f-start", "f-end", "f-medium", "fld-free"];
  function syncKind() {
    var kind = document.getElementById("s-kind").value, sc = kind === "screening", vn = kind === "venue";
    EVENT_FIELDS.forEach(function (id) { document.getElementById(id).hidden = vn; });
    document.getElementById("f-time").hidden = !sc;
    document.getElementById("venue-hint").hidden = !vn;
    document.getElementById("add-intro").hidden = vn;
    document.getElementById("l-start").textContent = sc ? "date" : "opens";
    document.getElementById("l-end").textContent = sc ? "until (series)" : "closes";
    document.getElementById("l-venue").textContent = vn ? "venue name" : "venue";
    document.getElementById("l-url").textContent = vn ? "programme page" : "website";
    document.getElementById("s-url").placeholder = vn ? "https:// the page where they list what's on" : "https://";
    document.getElementById("s-medium").placeholder = sc ? "e.g. 16mm programme, live performance" : "e.g. video installation";
  }
  document.getElementById("s-kind").addEventListener("change", function () { syncKind(); say(""); });
  function say(text, cls) { msg.className = "msg" + (cls ? " " + cls : ""); msg.textContent = text; }
  function v(id) { return document.getElementById(id).value.trim(); }
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var kind = v("s-kind"), start = v("s-start"), end = v("s-end"), url = v("s-url"), vn = kind === "venue";
    if (vn) {
      if (!v("s-venue") || !url) return say("needs the venue name and the page where they list what's on.", "error");
    } else {
      if (!v("s-title") || !v("s-artists") || !v("s-venue")) return say("needs a title, artist and venue.", "error");
      if (kind === "screening" && !start) return say("needs the screening date.", "error");
      if (kind === "exhibition" && !end) return say("needs a closing date.", "error");
      if (start && end && end < start) return say("end date is before start date.", "error");
    }
    if (url && !safeUrl(url)) return say("links must start with https://", "error");
    var btn = document.getElementById("submit"); btn.disabled = true; say("sending…");
    var fd = new FormData(form), data = {};
    fd.forEach(function (val, k) { data[k] = val; });
    if (vn) {
      ["title", "artists", "start", "end", "time", "medium", "free"].forEach(function (k) { delete data[k]; });
      data.subject = "moving image london: venue suggestion: " + data.venue;
    } else {
      data.free = document.getElementById("s-free").checked ? "yes" : "no";
      data.subject = "moving image london: " + data.title + " (" + (data.venue || "?") + ")";
    }
    if (data.email) data.replyto = data.email;
    fetch("https://api.web3forms.com/submit", { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.success) { var e = new Error(j.message || ("http " + r.status)); e.status = r.status; throw e; } }); })
      .then(function () {
        form.reset(); syncKind();
        say(vn ? "received. we'll take a look and add it to the weekly check." : "received. it'll be checked before it goes live.", "ok");
      })
      .catch(function (e) {
        if (e && e.status) say("didn't send (error " + e.status + "). try again in a moment.", "error");
        else say("didn't send. check your connection and try again.", "error");
      })
      .finally(function () { btn.disabled = false; });
  });

  // ---- load ----
  var startTab = (location.hash || "").replace("#", "");
  state.tab = FILTERS[startTab] ? startTab : "exhibitions";
  buildFilters(); syncKind(); render();
  function getJson(u) { return fetch(u, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  // live listings from the publish function; listings.json in the repo is the fallback
  getJson("/api/listings").then(function (d) { if (!d || !Array.isArray(d.listings)) throw new Error("shape"); return d; })
    .catch(function () { return getJson("listings.json"); })
    .then(function (data) {
      state.listings = (data && data.listings) || [];
      state.ready = true;
      if (data && data.updated) { var u = parse(data.updated); if (u) document.getElementById("updated").textContent = "listings updated " + dmy(u) + "."; }
      render();
    })
    .catch(function () { state.failed = true; render(); });
})();
