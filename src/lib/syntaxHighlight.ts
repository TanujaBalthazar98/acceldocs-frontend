/**
 * Shiki-based syntax highlighting for published documentation.
 *
 * Lazily initializes a Shiki highlighter and processes HTML strings,
 * replacing code blocks that have `class="language-*"` with
 * syntax-highlighted versions.
 */

import type { HighlighterGeneric } from "shiki";

let highlighterPromise: Promise<HighlighterGeneric<string, string>> | null = null;

const THEME_MAP = {
  dark: "github-dark",
  light: "github-light",
} as const;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then((mod) =>
      mod.createHighlighter({
        themes: [THEME_MAP.dark, THEME_MAP.light],
        langs: [],
      }),
    );
  }
  return highlighterPromise;
}

async function ensureThemeLoaded(
  highlighter: HighlighterGeneric<string, string>,
  themeName: string,
): Promise<string> {
  const loadedThemes = highlighter.getLoadedThemes();
  if (!loadedThemes.includes(themeName)) {
    await highlighter.loadTheme(themeName as Parameters<typeof highlighter.loadTheme>[0]);
  }
  return themeName;
}

const LANG_CLASS_RE = /\blanguage-(\S+)/;

/**
 * Walk every `<pre><code class="language-*">` block in the HTML string
 * and replace its contents with Shiki-highlighted markup.
 *
 * Returns the original HTML unchanged if no code blocks are found.
 */
export async function highlightCodeBlocks(
  html: string,
  mode: "dark" | "light" = "light",
  themeOverride?: string,
): Promise<string> {
  if (!html || !html.includes("language-")) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const codeEls = doc.querySelectorAll("pre code[class*='language-']");
  if (codeEls.length === 0) return html;

  const highlighter = await getHighlighter();
  const fallbackTheme = THEME_MAP[mode];
  let theme = fallbackTheme;
  const candidateTheme = themeOverride?.trim();
  if (candidateTheme) {
    try {
      theme = await ensureThemeLoaded(highlighter, candidateTheme);
    } catch {
      theme = fallbackTheme;
    }
  }
  let changed = false;

  for (const codeEl of codeEls) {
    const match = codeEl.className.match(LANG_CLASS_RE);
    if (!match) continue;

    const lang = match[1].toLowerCase();
    const rawText = codeEl.textContent || "";
    if (!rawText.trim()) continue;

    try {
      // Load the language grammar on demand
      const loaded = highlighter.getLoadedLanguages();
      if (!loaded.includes(lang)) {
        await highlighter.loadLanguage(lang as Parameters<typeof highlighter.loadLanguage>[0]);
      }

      const highlighted = highlighter.codeToHtml(rawText, { lang, theme });

      // Shiki wraps output in <pre><code>…</code></pre>.
      // Extract inner <code> content and merge into the existing DOM structure
      // so the parent <pre data-language="…"> and its CSS badge stay intact.
      const tmp = parser.parseFromString(highlighted, "text/html");
      const shikiCode = tmp.querySelector("code");
      if (shikiCode) {
        codeEl.innerHTML = shikiCode.innerHTML;
        // Copy Shiki's inline styles (background, color) to the parent <pre>
        const shikiPre = tmp.querySelector("pre");
        if (shikiPre) {
          const pre = codeEl.parentElement;
          if (pre && pre.tagName === "PRE") {
            pre.style.cssText = shikiPre.style.cssText;
            pre.classList.add("shiki-highlighted");
          }
        }
        changed = true;
      }
    } catch {
      // Unknown language or load error — leave as plain text
    }
  }

  if (!changed) return html;

  // Serialize back. Use body.innerHTML to avoid <html><head> wrapper.
  return doc.body.innerHTML;
}
