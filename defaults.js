// defaults.js — shared between popup and content script.
// Loaded as a plain script (no module system) so both contexts can use it.

const DEFAULT_PROMPT = `I'll paste a YouTube transcript or article. Convert it into a readable HTML document optimized for reading instead of watching/scrolling the original. Requirements:
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
    Output the HTML as a file I can save, not inline in chat`;

// Ordered map of AI chat destinations. Keys are stored in settings;
// labels + urls are shared by the popup (dropdown) and content script (tab open).
const CHAT_TARGETS = {
  chatgpt: { label: "ChatGPT", url: "https://chatgpt.com" },
  claude:  { label: "Claude",  url: "https://claude.ai" },
  gemini:  { label: "Gemini",  url: "https://gemini.google.com" },
};

const DEFAULT_SETTINGS = {
  prependPrompt: true,
  promptText: DEFAULT_PROMPT,
  openChatAfterCopy: false,
  chatTarget: "chatgpt",
};

const SETTINGS_KEY = "transcribedSettings";

// Expose on globalThis so both content-script and popup contexts can read them
// without an ES module loader.
globalThis.TranscribedDefaults = { DEFAULT_PROMPT, DEFAULT_SETTINGS, SETTINGS_KEY, CHAT_TARGETS };
