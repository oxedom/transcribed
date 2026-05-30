<p align="center">
  <img src="banner.svg" alt="transcribed" height="120" />
</p>

<p align="center">
  <img src="store-assets/screenshots/03-popup.png" alt="transcribed settings popup" width="600" />
</p>

<p align="center">
  <img src="store-assets/screenshots/02-copied.png" alt="transcribed copy confirmation" width="600" />
</p>

A tiny Chrome extension that adds a one-click **Copy transcript** button to every YouTube video — full transcript with timestamps to your clipboard.

<p align="center">
  Made with ❤️ by <a href="https://brinked.ai">brinked.ai</a>
</p>

## The problem

YouTube's built-in transcript flow is annoying:

1. Click `...more` to expand the description.
2. Scroll down and click **Show transcript**.
3. Scroll the side panel manually.
4. Select all the text by hand and `Ctrl+C`.

That's four steps and a hand-selection every time you want to feed a video into an LLM, search a quote, or save a reference.

## The fix

transcribed injects a teal **Copy transcript** button right next to Like / Share. One click and the entire transcript — timestamps included — is on your clipboard.

```
[0:00] Never gonna give you up
[0:04] Never gonna let you down
[0:08] Never gonna run around and desert you
...
```

## How it works 🛠️

It's pure client-side DOM automation — no servers, no API keys, no tracking.

1. Detects when you're on a `/watch` page and injects the button into the action row.
2. On click, programmatically opens YouTube's native transcript panel (clicking "Show transcript" for you, expanding the description first if needed).
3. Waits for the `<ytd-transcript-segment-renderer>` elements to hydrate.
4. Reads each segment's `.segment-timestamp` and `.segment-text`, joins them as `[mm:ss] text` lines, and writes the result via `navigator.clipboard.writeText`.
5. The button briefly flips to `Copied N lines` so you know it worked.

It also listens for YouTube's `yt-navigate-finish` SPA event so the button reappears when you switch videos without a full reload.

## Install 🚀

transcribed isn't on the Chrome Web Store yet, so you'll load it as an unpacked extension. Takes about a minute.

### 1. Get the code

Either clone the repo:

```bash
git clone https://github.com/oxedom/transcribed.git
```

…or download it as a ZIP from GitHub (**Code → Download ZIP**) and unzip it somewhere you'll remember (e.g. `~/Documents/transcribed`).

### 2. Open the extensions page

In your browser, paste this into the address bar and press Enter:

```
chrome://extensions
```

(In Edge use `edge://extensions`, in Brave `brave://extensions`, in Arc `arc://extensions`.)

### 3. Turn on Developer mode

Flip the **Developer mode** toggle in the top-right corner of the page. You'll see three new buttons appear: **Load unpacked**, **Pack extension**, **Update**.

### 4. Load the extension

1. Click **Load unpacked**.
2. In the file picker, select the `transcribed` folder (the one containing `manifest.json` — not its parent).
3. The extension card should appear with the name **transcribed** and status **On**.

### 5. Try it out

Open or refresh any YouTube watch page (e.g. `youtube.com/watch?v=...`). The teal **Copy transcript** button shows up next to Like / Share. Click it, then paste anywhere.

### Updating later

When you `git pull` (or download a new ZIP), go back to `chrome://extensions` and click the circular **Reload** icon on the transcribed card. No need to remove and reinstall.

Works in any Chromium-based browser (Chrome, Edge, Brave, Arc). Firefox is not currently supported.

## Limitations

- Only works on videos that actually have a transcript (manual or auto-generated captions).
- If a video has no captions in any language, the button will say `No transcript available`.
- Tested on the standard YouTube watch page; YouTube Music and Shorts are out of scope.

## Settings

Click the transcribed icon in the Chrome toolbar to open the settings popup:

- **Copy only up to current time** — when on, copy stops at the video's current playback position. Default: off.
- **Prepend prompt to clipboard** — when on, the editable prompt is placed at the top of the clipboard (followed by a blank line, then the transcript). Default: on.
- **Prompt** — editable textarea. "Reset to default" restores the shipped prompt after a confirmation dialog.
- **Open AI chat after copy** — when on, a successful copy also opens a new tab to your chosen AI chat — ChatGPT, Claude, or Gemini — and focuses it, leaving the YouTube tab open so you can paste right away. A dropdown to pick the destination appears when the switch is on. Default: off.

Settings auto-save and sync across your Chrome installs via `chrome.storage.sync`.

## Development

The popup uses precompiled Tailwind. After editing `src/input.css`, `popup.html`, or `popup.js`:

```bash
npm install      # one-time
npm run build    # rebuild popup.css
npm run watch    # rebuild on save during development
```

`popup.css` is committed so the extension loads from a fresh checkout without `npm install`.

### Tests

```bash
npm install
npx playwright install chromium
npm test
```

## Files

- `manifest.json` — Manifest V3 config, single `clipboardWrite` permission.
- `content.js` — the entire extension, ~190 lines, no build step, no dependencies.
- `icon.svg` — the extension icon (teal/gold brand mark).
- `icons/icon-{16,32,48,128}.png` — PNG exports referenced by `manifest.json` (Chromium requires PNG for `icons`).

That's it. Keep it simple. ✨