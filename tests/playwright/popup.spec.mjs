import { test, expect, chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT_PATH = path.resolve(__dirname, "..", "..");

// A YouTube talk with a stable English transcript.
// Replace if it ever becomes unavailable.
const TEST_VIDEO_URL = "https://www.youtube.com/watch?v=arj7oStGLkU";

// Must stay in sync with SETTINGS_KEY in defaults.js
const SETTINGS_KEY = "transcribedSettings";

async function launchWithExtension() {
  const userDataDir = path.resolve(__dirname, ".user-data");
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      "--no-first-run",
    ],
  });
  const [serviceWorker] = context.serviceWorkers();
  const sw = serviceWorker ?? (await context.waitForEvent("serviceworker"));
  const extensionId = new URL(sw.url()).host;
  return { context, extensionId };
}

async function setSettings(context, extensionId, settings) {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.evaluate(async ({ key, value }) => {
    await chrome.storage.sync.set({ [key]: value });
  }, { key: SETTINGS_KEY, value: settings });
  await popup.close();
}

async function readClipboard(page) {
  return page.evaluate(() => navigator.clipboard.readText());
}

test("transcript copy honours prependPrompt setting", async () => {
  const { context, extensionId } = await launchWithExtension();
  try {
    const page = await context.newPage();
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "https://www.youtube.com",
    });

    await page.goto(TEST_VIDEO_URL);
    await page.locator("#yt-transcribe-copy-btn").waitFor({ timeout: 15000 });

    const combos = [
      { prependPrompt: false, promptText: "TEST_PROMPT" },
      { prependPrompt: true, promptText: "TEST_PROMPT" },
    ];

    for (const s of combos) {
      await setSettings(context, extensionId, s);
      await page.bringToFront();
      await page.click("#yt-transcribe-copy-btn");

      // Wait for the success label to appear (label contains "Copied")
      await expect(page.locator("#yt-transcribe-copy-btn")).toContainText(/Copied/i, {
        timeout: 15000,
      });

      const text = await readClipboard(page);

      if (s.prependPrompt) {
        expect(text.startsWith("TEST_PROMPT\n\n")).toBe(true);
      } else {
        expect(text.startsWith("TEST_PROMPT")).toBe(false);
      }

      // First content line after any prompt should be a "[timestamp] text" line.
      const body = s.prependPrompt ? text.slice("TEST_PROMPT\n\n".length) : text;
      expect(body).toMatch(/^\[\d+:\d{2}(?::\d{2})?\] /m);
    }
  } finally {
    await context.close();
  }
});

test("opens AI chat tab after copy when enabled", async () => {
  const { context, extensionId } = await launchWithExtension();
  try {
    const page = await context.newPage();
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "https://www.youtube.com",
    });

    await page.goto(TEST_VIDEO_URL);
    await page.locator("#yt-transcribe-copy-btn").waitFor({ timeout: 15000 });

    await setSettings(context, extensionId, {
      prependPrompt: false,
      promptText: "TEST_PROMPT",
      openChatAfterCopy: true,
      chatTarget: "claude",
    });
    await page.bringToFront();

    const newPagePromise = context.waitForEvent("page", { timeout: 15000 });
    await page.click("#yt-transcribe-copy-btn");
    await expect(page.locator("#yt-transcribe-copy-btn")).toContainText(/Copied/i, {
      timeout: 15000,
    });

    const newPage = await newPagePromise;
    await newPage.waitForLoadState("domcontentloaded").catch(() => {});
    expect(newPage.url()).toContain("claude.ai");
  } finally {
    await context.close();
  }
});
