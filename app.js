// Labeling page. Plain JavaScript, no build step.
// Flow: pick rater -> load data/<rater>.js -> one screen at a time -> answers
// saved in the browser and sent to the Google Sheet (if configured).
(function () {
  "use strict";

  var CFG = window.CONFIG || {};
  var app = document.getElementById("app");
  var params = new URLSearchParams(location.search);
  var raterId = params.get("rater");

  // ------------------------------------------------------------ storage
  // Browser storage can be blocked (private windows); the page still works,
  // it just can't resume after a reload in that case.
  function storeKey() { return "label44:" + raterId; }
  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(storeKey())) || null; } catch (e) { return null; }
  }
  function saveLocal() {
    try { localStorage.setItem(storeKey(), JSON.stringify(state.saved)); } catch (e) { /* ignore */ }
  }

  var state = {
    data: null,             // window.SCREENS for this rater
    saved: { answers: {}, queue: [] },  // answers by screen_id; records not yet sent
    index: 0,               // current screen
    current: {},            // selections on the current screen
    shownAt: 0,             // when the current screen appeared
    syncing: false,
    breakShown: {},         // sessions whose break screen was already shown
  };

  // ------------------------------------------------------------ helpers
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") node.textContent = attrs[k];
      else if (k === "class") node.className = attrs[k];
      else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }
  // Replace the page content, skipping null/false pieces.
  function render() {
    var nodes = Array.prototype.slice.call(arguments).filter(Boolean);
    app.replaceChildren.apply(app, nodes);
  }
  function pretty(option) { return option.replace(/_/g, " "); }
  function answeredCount() { return Object.keys(state.saved.answers).length; }
  function firstUnanswered() {
    var s = state.data.screens;
    for (var i = 0; i < s.length; i++) if (!state.saved.answers[s[i].screen_id]) return i;
    return s.length;
  }

  // "[1] u/name:\nbody\n\n[FINAL] u/name:\nbody" -> [{who, body, final}]
  function parseConversation(text) {
    var turns = [], cur = null;
    text.split("\n").forEach(function (line) {
      var m = line.match(/^\[(\d+|FINAL)\] (u\/.*):$/);
      if (m) {
        if (cur) turns.push(cur);
        cur = { who: m[2], final: m[1] === "FINAL", lines: [] };
      } else if (cur) {
        cur.lines.push(line);
      }
    });
    if (cur) turns.push(cur);
    return turns.map(function (t) {
      return { who: t.who, final: t.final, body: t.lines.join("\n").trim() };
    });
  }

  // ------------------------------------------------------------ syncing
  function setStatus() {
    var node = document.getElementById("sync");
    if (!node) return;
    if (!CFG.APPS_SCRIPT_URL) {
      node.className = "status warn";
      node.textContent = "Offline mode: answers are only in this browser";
    } else if (state.saved.queue.length) {
      node.className = "status warn";
      node.textContent = state.saved.queue.length + " answer(s) waiting to upload…";
    } else {
      node.className = "status ok";
      node.textContent = "All answers uploaded ✓";
    }
  }

  function flush() {
    if (!CFG.APPS_SCRIPT_URL || state.syncing || !state.saved.queue.length) { setStatus(); return; }
    state.syncing = true;
    var record = state.saved.queue[0];
    // text/plain avoids a CORS preflight, which Apps Script doesn't answer.
    fetch(CFG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ token: CFG.SHARED_TOKEN }, record)),
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (!res || !res.ok) throw new Error((res && res.error) || "upload failed");
      state.saved.queue.shift();
      saveLocal();
      state.syncing = false;
      flush();
    }).catch(function () {
      state.syncing = false;
      setStatus();
      setTimeout(flush, 15000);  // retry later; answers stay queued
    });
  }

  // Resume on another device: ask the sheet which screens this rater finished.
  function pullDone() {
    if (!CFG.APPS_SCRIPT_URL) return Promise.resolve();
    var url = CFG.APPS_SCRIPT_URL + "?rater=" + encodeURIComponent(raterId) +
              "&token=" + encodeURIComponent(CFG.SHARED_TOKEN || "");
    return fetch(url).then(function (r) { return r.json(); }).then(function (res) {
      (res.done || []).forEach(function (id) {
        if (!state.saved.answers[id]) state.saved.answers[id] = { from_sheet: true };
      });
      saveLocal();
    }).catch(function () { /* offline is fine */ });
  }

  // ------------------------------------------------------------ CSV backup
  function downloadCsv() {
    var cols = ["rater", "screen_id", "session", "order", "toxicity", "sarcasm",
                "stance", "emotion", "seconds_on_screen", "answered_at"];
    var lines = [cols.join(",")];
    state.data.screens.forEach(function (s) {
      var a = state.saved.answers[s.screen_id];
      if (!a || a.from_sheet) return;
      var row = [raterId, s.screen_id, s.session, s.order, a.toxicity, a.sarcasm,
                 a.stance, a.emotion, a.seconds_on_screen, a.answered_at];
      lines.push(row.map(function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }).join(","));
    });
    var blob = new Blob([lines.join("\n") + "\n"], { type: "text/csv" });
    var a = el("a", { href: URL.createObjectURL(blob), download: raterId + "_answers.csv" });
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ------------------------------------------------------------ views
  function footer() {
    return el("div", { class: "actions" }, [
      el("span", { id: "sync", class: "status" }),
      el("a", { href: "#", text: "Download my answers (backup)", onclick: function (e) { e.preventDefault(); downloadCsv(); } }),
    ]);
  }

  function viewPicker() {
    var list = el("ul", { class: "raters" }, (window.RATERS || []).map(function (r) {
      return el("li", {}, [el("a", { href: "?rater=" + encodeURIComponent(r), text: r })]);
    }));
    render(
      el("h1", { text: CFG.STUDY_TITLE || "Comment labeling" }),
      el("p", { class: "muted", text: "Choose your rater id. Use the same one every time; it's how your answers are matched to you." }),
      list
    );
  }

  function viewIntro() {
    var done = answeredCount(), total = state.data.screens.length;
    render(
      el("h1", { text: CFG.STUDY_TITLE || "Comment labeling" }),
      el("p", { class: "muted", text: "Rater: " + raterId }),
      CFG.APPS_SCRIPT_URL ? null : el("p", { class: "banner", text: "Not connected to the results sheet. Answers stay in this browser; use “Download my answers” when you finish and send the file to the project lead." }),
      el("div", { class: "card" }, [
        el("h2", { text: "How this works" }),
        el("p", { text: "Each screen shows a short Reddit conversation. Answer four questions about the FINAL comment only (highlighted). Earlier comments, if any, are there as context." }),
        el("p", { text: "There are " + total + " screens in 4 sessions of " + (CFG.SCREENS_PER_SESSION || 50) + ". Do one session at a time, ideally on different days. Some comments come back later with different context; that's intended. Answer each screen on its own, without trying to match earlier answers." }),
        el("p", { text: "Go with your own judgment. There are no right answers, and you can't go back to change earlier screens." }),
      ]),
      el("div", { class: "actions" }, [
        el("span", { class: "muted", text: done ? (done + " of " + total + " done") : "" }),
        el("button", { class: "primary", text: done ? "Continue" : "Start", onclick: function () { state.index = firstUnanswered(); next(); } }),
      ]),
      footer()
    );
    setStatus();
  }

  function viewBreak(session) {
    render(
      el("h1", { text: "Session " + (session - 1) + " complete" }),
      el("div", { class: "card" }, [
        el("p", { text: "Nice work. Take a break here; ideally come back another day for session " + session + "." }),
        el("p", { class: "muted", text: "Your progress is saved. Opening this same link later picks up here." }),
      ]),
      el("div", { class: "actions" }, [
        el("span"),
        el("button", { class: "primary", text: "Start session " + session, onclick: function () { state.breakShown[session] = true; next(); } }),
      ]),
      footer()
    );
    setStatus();
  }

  function viewDone() {
    render(
      el("h1", { text: "All done. Thank you!" }),
      el("div", { class: "card" }, [
        el("p", { text: "You've finished all " + state.data.screens.length + " screens." }),
        el("p", { class: "muted", text: CFG.APPS_SCRIPT_URL ? "Make sure the status below says everything is uploaded before closing this page." : "Download your answers below and send the file to the project lead." }),
      ]),
      footer()
    );
    setStatus();
  }

  function viewScreen() {
    var screens = state.data.screens, s = screens[state.index];
    var per = CFG.SCREENS_PER_SESSION || 50;
    var inSession = s.order - (s.session - 1) * per;
    state.current = {};
    state.shownAt = Date.now();

    var turns = parseConversation(s.conversation).map(function (t) {
      return el("div", { class: "turn" + (t.final ? " final" : "") }, [
        el("div", { class: "who", text: (t.final ? "FINAL · " : "") + t.who }),
        el("div", { class: "body", text: t.body }),
      ]);
    });

    var nextBtn = el("button", { class: "primary", text: "Next →", disabled: "disabled", onclick: submit });
    var questions = state.data.tasks.map(function (task) {
      var buttons = task.options.map(function (opt) {
        return el("button", {
          type: "button", role: "radio", "aria-checked": "false", text: pretty(opt),
          onclick: function () {
            state.current[task.key] = opt;
            buttons.forEach(function (b) { b.setAttribute("aria-checked", b === this ? "true" : "false"); }, this);
            var complete = state.data.tasks.every(function (t) { return state.current[t.key]; });
            if (complete) nextBtn.removeAttribute("disabled");
          },
        });
      });
      return el("div", { class: "q" }, [
        el("div", { class: "label", text: task.question }),
        el("div", { class: "opts", role: "radiogroup", "aria-label": task.question }, buttons),
      ]);
    });

    var pct = Math.round(100 * answeredCount() / screens.length);
    render(
      el("header", { class: "bar" }, [
        el("strong", { text: "Session " + s.session + " of 4 · " + inSession + " / " + per }),
        el("span", { class: "muted", text: raterId + " · " + answeredCount() + " / " + screens.length + " overall" }),
      ]),
      el("div", { class: "progress" }, [el("div", { style: "width:" + pct + "%" })]),
      el("div", { class: "card scroll" }, turns),
      el("div", { class: "card" }, questions.concat([
        el("div", { class: "actions" }, [el("span", { class: "muted", text: "Answer all four to continue." }), nextBtn]),
      ])),
      footer()
    );
    setStatus();
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------ flow
  function submit() {
    var s = state.data.screens[state.index];
    var answer = Object.assign({}, state.current, {
      seconds_on_screen: Math.round((Date.now() - state.shownAt) / 1000),
      answered_at: new Date().toISOString(),
    });
    state.saved.answers[s.screen_id] = answer;
    state.saved.queue.push(Object.assign({
      rater: raterId, screen_id: s.screen_id, session: s.session, order: s.order,
    }, answer));
    saveLocal();
    flush();
    state.index = firstUnanswered();
    next();
  }

  function next() {
    var screens = state.data.screens;
    if (state.index >= screens.length) return viewDone();
    var s = screens[state.index];
    // Break screen at the start of sessions 2-4 (once per visit).
    if (s.session > 1 && !state.breakShown[s.session]) {
      var prev = screens[state.index - 1];
      if (prev && state.saved.answers[prev.screen_id] && prev.session < s.session) return viewBreak(s.session);
    }
    viewScreen();
  }

  // ------------------------------------------------------------ start
  if (!raterId) return viewPicker();
  if ((window.RATERS || []).indexOf(raterId) < 0) {
    render(el("h1", { text: "Unknown rater id" }),
      el("p", { text: "“" + raterId + "” isn't on the list. Check your link, or pick your id below." }));
    var back = el("p", {}, [el("a", { href: location.pathname, text: "Choose rater id" })]);
    app.appendChild(back);
    return;
  }
  var script = document.createElement("script");
  script.src = "data/" + encodeURIComponent(raterId) + ".js";
  script.onload = function () {
    state.data = window.SCREENS;
    state.saved = loadLocal() || state.saved;
    state.saved.answers = state.saved.answers || {};
    state.saved.queue = state.saved.queue || [];
    pullDone().then(function () { viewIntro(); flush(); });
  };
  script.onerror = function () {
    render(el("h1", { text: "Couldn't load your screens" }),
      el("p", { text: "data/" + raterId + ".js is missing. Ask the project lead." }));
  };
  document.head.appendChild(script);
})();
