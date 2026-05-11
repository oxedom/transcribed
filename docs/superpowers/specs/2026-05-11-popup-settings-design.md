# Popup Settings — Design Spec

**Date:** 2026-05-11
**Status:** Approved, pending implementation plan

## Summary

Add a toolbar popup to the transcribe-it Chrome extension that lets users configure two behaviors:

1. **Copy up to current playback time** — when on, only segments at or before the video's current `currentTime` are copied.
2. **Prepend a prompt** — when on, a user-editable prompt is prepended to the clipboard payload (followed by a blank line, then the transcript).

Settings persist via `chrome.storage.sync`. The popup is styled with precompiled Tailwind using a shadcn-style design-token system.

## Goals

- Settings UI reachable from the Chrome toolbar icon.
- Defaults that match expected first-run behavior: prepend ON (with the default prompt), timestamp-filter OFF.
- User can edit the prompt and reset it to the shipped default (with confirmation).
- No regression to the existing one-click copy flow on a fresh install.

## Non-Goals

- Internationalization of the popup.
- Multiple prompt presets / preset picker.
- Per-video setting overrides.
- Telemetry or analytics.
- Migration of an existing settings format (none exists).

## Architecture

| File | Status | Role |
|---|---|---|
| `manifest.json` | edit | Add `storage` permission, `action.default_popup`, prepend `defaults.js` to content_scripts. |
| `content.js` | edit | Read settings on click; apply timestamp filter; assemble prepend + transcript. |
| `defaults.js` | new | Export `DEFAULT_PROMPT` and `DEFAULT_SETTINGS`. Loaded by both content script and popup. |
| `popup.html` | new | Settings UI markup. |
| `popup.js` | new | Load/save settings, wire form, reset-confirm dialog, dark-mode class toggle. |
| `popup.css` | new (generated, committed) | Compiled Tailwind output. |
| `src/input.css` | new | Tailwind directives + shadcn design tokens (light + dark). |
| `tailwind.config.js` | new | Content globs (`popup.html`, `popup.js`), `darkMode: 'class'`. |
| `package.json` | new | devDependency: `tailwindcss`. Scripts: `build`, `watch`. |
| `.gitignore` | edit | Add `node_modules/`. |
| `README.md` | edit | Document popup, settings, build steps. |

**Rationale: single shared `defaults.js`** — the long default prompt lives in exactly one place so the popup's "Reset to default" button and the content script's storage-fallback cannot drift apart.

**Rationale: precompiled Tailwind, no runtime CDN** — Manifest V3 popups have a default CSP that blocks remote scripts, ruling out the Tailwind Play CDN. A one-time `npm run build` step produces `popup.css` which is committed so the extension loads from a fresh checkout without `npm install`.

## Settings Schema

Stored under a single key `transcribeItSettings` in `chrome.storage.sync`:

```js
{
  copyUpToCurrentTime: false,   // boolean toggle
  prependPrompt: true,          // boolean toggle (default ON)
  promptText: DEFAULT_PROMPT    // string, defaults to the shipped prompt
}
```

`DEFAULT_PROMPT` is the verbatim text:

```
I'll paste a YouTube transcript or article. Convert it into a readable HTML document optimized for reading instead of watching/scrolling the original. Requirements:
Content:

    Lead with a TL;DR (3–5 bullets — actual takeaways, not "the author discusses X")
    Then a structured breakdown with descriptive section headers organized logically, not chronologically
    Summarize, but don't lose information density. Preserve specific claims, numbers, names, examples, and any concrete prompts/code/commands verbatim — those are usually the highest-signal parts and summarization tends to flatten them
    English by default
    Cut filler, false starts, ads, sponsor reads, repetition, and throat-clearing
    End with a "Notable" section: counterintuitive points, hot takes, surprising data, or memorable quotes

    If the source has an FAQ or Q&A, preserve it as its own section — don't fold it into prose
    Format — single HTML file using Tailwind via CDN:
    <script src="https://cdn.tailwindcss.com"></script> in the head
    Readable typography: serif or well-chosen sans for body, generous line-height (leading-relaxed or leading-7), max-w-3xl centered, prose-like spacing
    Clear visual hierarchy: distinct heading sizes, subtle dividers between sections, callout boxes for TL;DR and Notable
    Code blocks and example prompts in monospace with proper background and padding — these need to look quotable, not buried
    Mobile responsive

    No external images, no JS frameworks, no build step — pure HTML + Tailwind CDN + minimal vanilla JS only if the toggle needs it
    Behavior:
    Ask before starting if the source is unusually long, low-signal, or ambiguous in scope
    Output the HTML as a file I can save, not inline in chat
```

## Popup UI

Target width ~360px. Single column. Styled with Tailwind classes mapped to the shadcn design tokens (`bg-background`, `text-foreground`, `bg-card`, `border-border`, `bg-primary`, etc.). Light/dark switched by toggling `.dark` on `<html>` based on `prefers-color-scheme`.

**Sections, top to bottom:**

1. **Header:** "transcribe-it" title, small subtitle "Settings".
2. **Toggle row:** "Copy only up to current time" — switch + one-line help text "Stops at the video's current playback position."
3. **Toggle row:** "Prepend prompt to clipboard" — switch.
4. **Prompt block:**
   - Label "Prompt" + a small "Reset to default" button (right-aligned).
   - Multi-line textarea, always editable regardless of the prepend toggle state.
5. **Save indicator:** subtle "Saved" text that flashes briefly when storage writes succeed.

**Reset-to-default dialog:** clicking "Reset to default" opens a shadcn-style modal:

> **Reset prompt to default?**
> This will replace the current prompt text. This action cannot be undone.
>
> [Cancel] [Reset]

Implemented as a plain `<dialog>` element with shadcn-token styling. Cancel keeps current text; Reset overwrites the textarea and saves.

**Auto-save:** every input change (`input`/`change` events) writes the updated settings object to `chrome.storage.sync`. No explicit save button.

**Empty-prompt behavior:** if `prependPrompt` is on but `promptText.trim()` is empty, the content script skips the prepend entirely (no leading blank line). This matches user intent: "prepend nothing" = "don't prepend".

## Content Script Changes

At click time (not page load), `copyTranscript` reads settings via `chrome.storage.sync.get('transcribeItSettings')`, falling back to `DEFAULT_SETTINGS` if missing.

### Timestamp filter

```js
function parseTs(ts) {
  const parts = ts.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}
```

- Read `document.querySelector('video')?.currentTime`.
- If no video element, `currentTime` is 0, or `currentTime` is NaN: treat the toggle as a no-op (copy everything). This covers Shorts, pre-roll, and other edge cases.
- Otherwise: keep segments where `parseTs(ts) <= currentTime`. The boundary segment (currently being spoken) is included.

### Clipboard assembly

```js
const body = formatTranscript(filteredSegs);
const trimmed = settings.promptText.trim();
const out = (settings.prependPrompt && trimmed)
  ? `${trimmed}\n\n${body}`
  : body;
await navigator.clipboard.writeText(out);
```

### Button label feedback

After a successful copy, the in-page button briefly shows a label reflecting what happened:

| Timestamp filter | Prepend | Label |
|---|---|---|
| off | off | `Copied N lines` |
| off | on | `Copied N lines + prompt` |
| on | off | `Copied N lines (up to M:SS)` |
| on | on | `Copied N lines + prompt (up to M:SS)` |

The timestamp shown is the timestamp string of the last included segment (e.g. `1:23` or `1:23:45`) — already in YouTube's native format, no separate formatting needed.

## Manifest

```json
{
  "manifest_version": 3,
  "name": "transcribe-it",
  "version": "1.1.0",
  "description": "Adds a one-click button to copy a YouTube video's transcript with timestamps.",
  "icons": { ... },
  "permissions": ["clipboardWrite", "storage"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": { "16": "icons/icon-16.png", "32": "icons/icon-32.png", "48": "icons/icon-48.png", "128": "icons/icon-128.png" }
  },
  "content_scripts": [{
    "matches": ["https://www.youtube.com/*"],
    "js": ["defaults.js", "content.js"],
    "run_at": "document_idle"
  }]
}
```

Two additions: `storage` permission and `action.default_popup`. `defaults.js` is loaded before `content.js` so the fallback constants are in scope.

## Build & Tooling

**`package.json`:**

```json
{
  "name": "transcribe-it",
  "version": "1.1.0",
  "private": true,
  "scripts": {
    "build": "tailwindcss -i src/input.css -o popup.css --minify",
    "watch": "tailwindcss -i src/input.css -o popup.css --watch"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0"
  }
}
```

**`tailwind.config.js`:**

```js
module.exports = {
  content: ['./popup.html', './popup.js'],
  darkMode: 'class',
  theme: { extend: {} },
  plugins: []
};
```

`popup.css` is committed so the extension can be loaded unpacked without `npm install`. `node_modules/` is gitignored.

## Testing Plan

This is a manifest + content-script extension with no existing test harness. Adding a full unit-test setup is out of scope; verification is a combination of manual checks and Playwright CLI happy-path automation.

### Playwright CLI verification (happy paths)

Load the unpacked extension into Chromium:

```
chromium --disable-extensions-except=<abs_path> --load-extension=<abs_path>
```

For each of the 4 toggle combinations:
1. Open a known YouTube video URL with a transcript.
2. (For timestamp-on cases) seek the video to a known time via `video.currentTime = T`.
3. Click the in-page copy button.
4. Read clipboard, assert:
   - Prompt prefix present/absent as configured.
   - Last segment's timestamp is <= seek target when timestamp filter on; otherwise full transcript present.

Also: open `chrome-extension://<id>/popup.html` directly and verify the form reflects stored values.

### Manual edge cases

- Video with no transcript → existing "No transcript available" path still surfaces.
- Shorts / page without a `<video>` with valid `currentTime` → timestamp toggle is a no-op, full transcript copied.
- Prepend ON + textarea cleared to whitespace → no leading blank line, no extra newline.
- Reset-to-default dialog: Cancel leaves text untouched; Reset replaces it and triggers Save indicator.
- Dark mode: toggle OS theme, popup re-themes on next open.
- Fresh install (storage empty): popup shows prepend ON and the default prompt; first copy includes the prompt.

## Open Questions

None. All defaults, copy direction, prompt format, UI surface, and styling approach are confirmed.

## Rollout

Single bump to `version: "1.1.0"` in the manifest. No migration required — fresh installs and existing users (who have no stored settings yet) both fall back to `DEFAULT_SETTINGS` on first read.
