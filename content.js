(() => {
  const BTN_ID = "yt-transcribe-copy-btn";
  const { DEFAULT_SETTINGS, SETTINGS_KEY, CHAT_TARGETS } = globalThis.TranscribedDefaults;

  const STYLE = `
    #${BTN_ID} {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: #C2761F;
      color: #ffffff;
      border: 1px solid #0F4D49;
      border-radius: 18px;
      padding: 0 14px;
      height: 36px;
      min-width: 180px;
      font-family: "Roboto", "Arial", sans-serif;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      margin-left: 8px;
      transition: background 0.15s ease;
      white-space: nowrap;
    }
    #${BTN_ID}:hover { background: #D08731; }
    #${BTN_ID}:active { background: #A66419; }
    #${BTN_ID}[disabled] { opacity: 0.8; cursor: default; }
    #${BTN_ID} svg { width: 20px; height: 20px; display: block; }
    @keyframes yt-transcribe-spin { to { transform: rotate(360deg); } }
    #${BTN_ID} .yt-transcribe-spinner { animation: yt-transcribe-spin 0.9s linear infinite; }
  `;

  const ICON_SVG = `
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <g stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M 19 57 L 19 21 A 8 8 0 0 1 27 13 L 56 13"/>
        <rect x="31" y="22" width="50" height="70" rx="8"/>
      </g>
    </svg>
  `;

  const SPINNER_SVG = `
    <svg class="yt-transcribe-spinner" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="#ffffff" stroke-width="3" fill="none" stroke-dasharray="42 18" stroke-linecap="round"/>
    </svg>
  `;

  function injectStyle() {
    if (document.getElementById("yt-transcribe-style")) return;
    const s = document.createElement("style");
    s.id = "yt-transcribe-style";
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  async function waitFor(fn, { timeout = 8000, interval = 150 } = {}) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const v = fn();
      if (v) return v;
      await sleep(interval);
    }
    return null;
  }

  const PANEL_SELECTOR =
    'ytd-engagement-panel-section-list-renderer[target-id="PAmodern_transcript_view"], ' +
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]';

  function getTranscriptPanel() {
    const panels = document.querySelectorAll(PANEL_SELECTOR);
    const expanded = Array.from(panels).find(
      p => p.getAttribute("visibility") === "ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"
    );
    return expanded || panels[0] || null;
  }

  function getSegments() {
    return document.querySelectorAll(
      "transcript-segment-view-model, ytd-transcript-segment-renderer"
    );
  }

  async function ensureTranscriptOpen() {
    let panel = getTranscriptPanel();
    if (panel && panel.getAttribute("visibility") === "ENGAGEMENT_PANEL_VISIBILITY_EXPANDED") {
      return panel;
    }

    const descBtn = document.querySelector(
      "ytd-video-description-transcript-section-renderer button"
    );
    if (descBtn) {
      descBtn.click();
    } else {
      const expand = document.querySelector("tp-yt-paper-button#expand");
      if (expand) {
        expand.click();
        await sleep(400);
        const retry = document.querySelector(
          "ytd-video-description-transcript-section-renderer button"
        );
        if (retry) retry.click();
      }
    }

    panel = await waitFor(() => {
      const p = getTranscriptPanel();
      return p && p.getAttribute("visibility") === "ENGAGEMENT_PANEL_VISIBILITY_EXPANDED" ? p : null;
    });
    return panel;
  }

  function readSegment(seg) {
    if (seg.tagName === "TRANSCRIPT-SEGMENT-VIEW-MODEL") {
      const ts = seg.querySelector(".ytwTranscriptSegmentViewModelTimestamp")?.textContent?.trim() || "";
      const text = seg.querySelector('span[role="text"]')?.textContent?.trim() || "";
      return { ts, text };
    }
    const ts = seg.querySelector(".segment-timestamp")?.textContent?.trim() || "";
    const text = seg.querySelector(".segment-text")?.textContent?.trim() || "";
    return { ts, text };
  }

  function formatTranscript(items) {
    return items
      .map(({ ts, text }) => (ts ? `[${ts}] ${text}` : text))
      .join("\n");
  }

  async function loadSettings() {
    try {
      const stored = await chrome.storage.sync.get(SETTINGS_KEY);
      return { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] || {}) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async function copyTranscript(btn) {
    const original = btn.innerHTML;
    const setLabel = (html) => { btn.innerHTML = html; };
    btn.disabled = true;
    setLabel(`${SPINNER_SVG}<span>Copying…</span>`);

    try {
      const settings = await loadSettings();

      const panel = await ensureTranscriptOpen();
      if (!panel) throw new Error("No transcript available");

      const segs = await waitFor(() => {
        const s = getSegments();
        return s.length ? s : null;
      }, { timeout: 10000 });
      if (!segs) throw new Error("No transcript available");

      const items = Array.from(segs).map(readSegment).filter(s => s.text);
      if (!items.length) throw new Error("Transcript is empty");

      const body = formatTranscript(items);
      const trimmedPrompt = settings.promptText.trim();
      const out = settings.prependPrompt && trimmedPrompt
        ? `${trimmedPrompt}\n\n${body}`
        : body;

      await navigator.clipboard.writeText(out);

      if (settings.openChatAfterCopy) {
        const target = CHAT_TARGETS[settings.chatTarget];
        if (target) window.open(target.url, "_blank", "noopener");
      }

      setLabel(`${ICON_SVG}<span>Copied</span>`);
    } catch (e) {
      console.error("[transcribed]", e);
      setLabel(`${ICON_SVG}<span>${e.message || "Failed"}</span>`);
    } finally {
      setTimeout(() => {
        btn.disabled = false;
        setLabel(original);
      }, 2000);
    }
  }

  function buildButton() {
    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.title = "Copy transcript with timestamps";
    btn.innerHTML = `${ICON_SVG}<span>Copy transcript</span>`;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      copyTranscript(btn);
    });
    return btn;
  }

  function insertButton() {
    if (document.getElementById(BTN_ID)) return true;
    const target =
      document.querySelector("ytd-watch-metadata #top-level-buttons-computed") ||
      document.querySelector("#actions #top-level-buttons-computed") ||
      document.querySelector("ytd-watch-metadata #actions");
    if (!target) return false;
    target.appendChild(buildButton());
    return true;
  }

  function isWatchPage() {
    return location.pathname === "/watch";
  }

  function tick() {
    if (!isWatchPage()) return;
    injectStyle();
    insertButton();
  }

  tick();
  const obs = new MutationObserver(() => tick());
  obs.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("yt-navigate-finish", () => {
    setTimeout(tick, 300);
  });
})();
