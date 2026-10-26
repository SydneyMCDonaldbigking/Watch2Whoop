/* Opt-in, device-local accessibility preferences. This plugin changes presentation only: no health data, account
   roles or sharing grants are stored here. Speech uses an explicitly local voice; it never falls back to a cloud voice. */
(() => {
  "use strict";
  const KEY = "be.elder-mode";
  const root = document.documentElement;
  const tr = (key) => window.I18N.t(key);
  const $ = (selector) => document.querySelector(selector);
  let ctx = null, reading = false, utterance = null, speechRun = 0;
  let ownSheet = false, sheetReturnFocus = null;
  let enabled = false;
  try { enabled = localStorage.getItem(KEY) === "1"; } catch (e) { /* Device storage can be unavailable. */ }

  function update() {
    root.classList.toggle("elder-mode", enabled);
    for (const button of document.querySelectorAll("[data-elder-toggle]")) {
      button.setAttribute("aria-pressed", String(enabled));
    }
    const toolbar = $("#elder-toolbar");
    if (toolbar) toolbar.hidden = !enabled;
    const value = $("#me-elder-value");
    if (value) {
      value.dataset.i18n = enabled ? "elder.on" : "elder.off";
      value.textContent = tr(value.dataset.i18n);
    }
    const read = $("#elder-read");
    if (read) {
      read.dataset.i18n = reading ? "elder.stopReading" : "elder.readPage";
      read.textContent = tr(read.dataset.i18n);
    }
  }

  function stopReading() {
    speechRun++;
    if (utterance) { utterance.onend = null; utterance.onerror = null; }
    utterance = null;
    if (reading) window.speechSynthesis?.cancel();
    reading = false;
    update();
  }

  function setEnabled(value) {
    stopReading();
    enabled = value;
    let saved = true;
    try { localStorage.setItem(KEY, enabled ? "1" : "0"); } catch (e) { saved = false; }
    update();
    ctx?.toast(tr(saved ? (enabled ? "elder.enabled" : "elder.disabled") : "elder.notSaved"));
  }

  function morePages() {
    if (!ctx) return;
    stopReading();
    // Food can live under Log when friends is on; the friends entry still follows the existing server flag.
    const pages = [["record", "tab.record"], ["food", "tab.food"]];
    const friends = $('.tab[data-tab="friends"]');
    if (friends && !friends.hidden) pages.push(["friends", "tab.friends"]);
    sheetReturnFocus = document.activeElement;
    ctx.openSheet(tr("elder.morePages"), `<p class="elder-note">${ctx.esc(tr("elder.moreHint"))}</p>
      <div class="group">${pages.map(([tab, key]) => `<button type="button" class="item" data-elder-page="${tab}">
        <span class="row-title">${ctx.esc(tr(key))}</span></button>`).join("")}</div>`, (view) => {
      ownSheet = true;
      view.querySelector("button")?.focus({ preventScroll: true });
      for (const button of view.querySelectorAll("[data-elder-page]")) button.onclick = () => {
        ctx.closeSheet();
        ctx.setTab(button.dataset.elderPage);
      };
    });
  }

  function readPage() {
    if (reading) { stopReading(); return; }
    const synth = window.speechSynthesis;
    const language = window.I18N.lang;
    const voice = synth?.getVoices().find((v) => v.localService === true && v.lang.toLowerCase().split(/[-_]/)[0] === language);
    if (!voice || !window.SpeechSynthesisUtterance) { ctx?.toast(tr("elder.noLocalVoice")); return; }
    // Read only visible text nodes, excluding form values and hidden descendants.
    const view = $("#view");
    if (!view || $("#app").hidden || !$("#sheet").hidden) return;
    const walker = document.createTreeWalker(view, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        return !parent || parent.closest("[hidden], [aria-hidden='true'], input, textarea, select, script, style")
          || !parent.getClientRects().length || getComputedStyle(parent).visibility !== "visible"
          ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    const lines = [];
    while (walker.nextNode()) if (walker.currentNode.textContent.trim()) lines.push(walker.currentNode.textContent.trim());
    const visible = lines.join("\n");
    if (!visible) { ctx?.toast(tr("elder.nothingToRead")); return; }
    const title = $("#hdr-title")?.textContent || "";
    const parts = `${title}\n${visible}`.split(/\n+|(?<=[\u3002\uff01\uff1f!?])\s*/u).filter((s) => s.trim())
      .flatMap((s) => s.match(/[\s\S]{1,180}/gu) || []);
    stopReading();
    reading = true;
    const run = speechRun;
    update();
    function next() {
      if (run !== speechRun) return;
      const text = parts.shift();
      if (!text) { stopReading(); return; }
      try {
        utterance = new window.SpeechSynthesisUtterance(text);
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.rate = 0.85;
        utterance.onend = next;
        utterance.onerror = () => { stopReading(); ctx?.toast(tr("elder.speechFailed")); };
        synth.speak(utterance);
      } catch (e) { stopReading(); ctx?.toast(tr("elder.speechFailed")); }
    }
    next();
  }

  function settings() {
    sheetReturnFocus = document.activeElement;
    ctx.openSheet(tr("elder.title"), `<p class="elder-note">${ctx.esc(tr("elder.description"))}</p>
      <button type="button" class="btn btn-primary btn-block" id="elder-settings-toggle">${ctx.esc(tr(enabled ? "elder.disable" : "elder.enable"))}</button>
      <p class="elder-note">${ctx.esc(tr("elder.deviceOnly"))}</p>`, (view) => {
      ownSheet = true;
      view.querySelector("button")?.focus({ preventScroll: true });
      view.querySelector("#elder-settings-toggle").onclick = () => { setEnabled(!enabled); ctx.closeSheet(); };
    });
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-elder-toggle]")) setEnabled(!enabled);
  });
  document.addEventListener("keydown", (event) => {
    if (!ownSheet || event.key !== "Tab" || $("#sheet").hidden) return;
    const buttons = [...$("#sheet").querySelectorAll("button:not([disabled]), a[href], input, select, textarea")]
      .filter((element) => element.getClientRects().length);
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (!first) return;
    if (event.shiftKey && (document.activeElement === first || !$("#sheet").contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !$("#sheet").contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  });
  $("#elder-more")?.addEventListener("click", morePages);
  $("#elder-read")?.addEventListener("click", readPage);
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY && event.key !== null) return;
    stopReading();
    enabled = event.key === KEY && event.newValue === "1";
    update();
  });
  window.addEventListener("pagehide", stopReading);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopReading(); });
  // Also stop when the viewed person, refreshed data or login state changes, without retaining their spoken text.
  for (const id of ["view", "app", "login"]) {
    const element = $("#" + id);
    if (element) new MutationObserver(stopReading).observe(element, id === "view"
      ? { childList: true } : { attributes: true, attributeFilter: ["hidden"] });
  }

  (window.BodyPlugins ||= []).push({
    meGroup: "main",
    init(context) {
      if (!ctx) {
        window.BodyHooks?.on("page", stopReading);
        window.BodyHooks?.on("sheet", (event) => {
          if (event.open) { ownSheet = false; stopReading(); }
          else if (ownSheet) {
            ownSheet = false;
            if (sheetReturnFocus?.isConnected) sheetReturnFocus.focus({ preventScroll: true });
            sheetReturnFocus = null;
          }
        });
      }
      ctx = context;
      update();
    },
    meItem: (chevron) => `<button type="button" class="item" id="me-elder"><span class="row-title">${tr("elder.title")}</span>
      <span class="val" id="me-elder-value" data-i18n="${enabled ? "elder.on" : "elder.off"}">${tr(enabled ? "elder.on" : "elder.off")}</span>${chevron || ""}</button>`,
    bindMe(view) { view.querySelector("#me-elder")?.addEventListener("click", settings); },
    onTab() { stopReading(); },
  });
  update();
})();
