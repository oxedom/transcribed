// popup.js — runs in the extension popup. defaults.js loaded before this script.

const { DEFAULT_SETTINGS, SETTINGS_KEY } = globalThis.TranscribeItDefaults;

const els = {
  toggleUpTo: document.getElementById("toggle-up-to"),
  togglePrepend: document.getElementById("toggle-prepend"),
  promptText: document.getElementById("prompt-text"),
  resetBtn: document.getElementById("reset-btn"),
  resetDialog: document.getElementById("reset-dialog"),
  saveBtn: document.getElementById("save-btn"),
  savedIndicator: document.getElementById("saved-indicator"),
};

let lastSaved = null;

function applyTheme() {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", dark);
}

function setSwitch(el, on) {
  el.dataset.state = on ? "checked" : "unchecked";
  el.setAttribute("aria-checked", on ? "true" : "false");
}

function readSwitch(el) {
  return el.dataset.state === "checked";
}

function render(settings) {
  setSwitch(els.toggleUpTo, settings.copyUpToCurrentTime);
  setSwitch(els.togglePrepend, settings.prependPrompt);
  els.promptText.value = settings.promptText;
}

function currentSettings() {
  return {
    copyUpToCurrentTime: readSwitch(els.toggleUpTo),
    prependPrompt: readSwitch(els.togglePrepend),
    promptText: els.promptText.value,
  };
}

function settingsEqual(a, b) {
  return (
    a.copyUpToCurrentTime === b.copyUpToCurrentTime &&
    a.prependPrompt === b.prependPrompt &&
    a.promptText === b.promptText
  );
}

function refreshSaveButton() {
  els.saveBtn.disabled = settingsEqual(currentSettings(), lastSaved);
}

let savedTimeout = null;
function flashSaved() {
  els.savedIndicator.style.opacity = "1";
  clearTimeout(savedTimeout);
  savedTimeout = setTimeout(() => {
    els.savedIndicator.style.opacity = "0";
  }, 1200);
}

async function save() {
  const next = currentSettings();
  await chrome.storage.sync.set({ [SETTINGS_KEY]: next });
  lastSaved = next;
  refreshSaveButton();
  flashSaved();
}

async function init() {
  applyTheme();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  const settings = { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] || {}) };
  render(settings);
  lastSaved = settings;
  refreshSaveButton();

  for (const sw of [els.toggleUpTo, els.togglePrepend]) {
    sw.addEventListener("click", () => {
      setSwitch(sw, !readSwitch(sw));
      refreshSaveButton();
    });
  }

  els.promptText.addEventListener("input", refreshSaveButton);

  els.resetBtn.addEventListener("click", () => els.resetDialog.showModal());
  els.resetDialog.addEventListener("close", () => {
    if (els.resetDialog.returnValue === "confirm") {
      els.promptText.value = DEFAULT_SETTINGS.promptText;
      refreshSaveButton();
    }
  });

  els.saveBtn.addEventListener("click", save);
}

init();
