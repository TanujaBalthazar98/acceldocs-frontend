import DOMPurify from "dompurify";
import { isLikelyMarkdown, renderMarkdownToHtml } from "./markdown";

/**
 * Normalizes and cleans HTML content for consistent display.
 * Handles both Google Docs exported HTML and markdown-converted HTML.
 */
export function normalizeHtml(html: string): string {
  if (!html) return "";

  const sanitizeOptions = {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "strike",
      "del",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "a",
      "img",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "td",
      "th",
      "caption",
      "colgroup",
      "col",
      "div",
      "span",
      "section",
      "article",
      "aside",
      "header",
      "footer",
      "nav",
      "main",
      "blockquote",
      "pre",
      "code",
      "kbd",
      "samp",
      "var",
      "hr",
      "sup",
      "sub",
      "mark",
      "small",
      "abbr",
      "time",
      "address",
      "dl",
      "dt",
      "dd",
      "figure",
      "figcaption",
      "details",
      "summary",
    ],
    ALLOWED_ATTR: [
      "href",
      "src",
      "srcset",
      "alt",
      "title",
      "target",
      "rel",
      "colspan",
      "rowspan",
      "start",
      "class",
      "id",
      "name",
      "datetime",
      "lang",
      "dir",
      "open",
      "data-language",
    ],
    FORBID_ATTR: ["style", "onclick", "onerror", "onload"],
    ALLOW_DATA_ATTR: false,
  };

  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(html);
  if (!looksLikeHtml && isLikelyMarkdown(html)) {
    const rendered = renderMarkdownToHtml(html);
    return DOMPurify.sanitize(rendered, sanitizeOptions).trim();
  }

  // Extract body content if present
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let content = bodyMatch ? bodyMatch[1] : html;

  // Extract Google Docs CSS so we can infer semantics (headings/code) from class-based styling.
  const cssText = extractCssFromHtml(html);
  const classStyles = parseCssClassStyles(cssText);

  // Convert Google Docs styled text to semantic elements BEFORE stripping classes/styles.
  content = convertGoogleDocsHeadings(content, classStyles);
  content = convertGoogleDocsCodeBlocks(content, classStyles);

  // Remove Google Docs specific elements and styles
  content = removeGoogleDocsStyles(content);

  // Clean up structural issues
  content = cleanupStructure(content);

  content = convertMarkdownTablesInHtml(content);

  const markdownText = extractMarkdownText(content);
  if (!/<(table|ul|ol|pre|code)\b/i.test(content) && isLikelyMarkdown(markdownText)) {
    content = renderMarkdownToHtml(markdownText);
  }

  // Sanitize to prevent XSS while preserving markdown/Docs HTML structure
  content = DOMPurify.sanitize(content, sanitizeOptions);

  return content.trim();
}

function extractMarkdownText(html: string): string {
  const text = html
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return decodeHtmlEntities(text);
}

function decodeHtmlEntities(text: string): string {
  if (typeof document === "undefined") return text;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

function convertMarkdownTablesInHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const container = doc.body.firstElementChild as HTMLElement | null;
  if (!container) return html;

  const paragraphs = Array.from(container.querySelectorAll("p"));

  for (let i = 0; i < paragraphs.length; i += 1) {
    const headerRow = paragraphs[i];
    const parent = headerRow.parentElement;
    const separatorRow = paragraphs[i + 1];

    if (!parent || !separatorRow || separatorRow.parentElement !== parent) continue;

    const headerCells = parseMarkdownRowFromHtml(headerRow.innerHTML);
    if (!headerCells) continue;

    if (!isSeparatorRow(separatorRow.textContent || "")) continue;

    const dataRows: string[][] = [];
    const rowsToRemove: HTMLElement[] = [headerRow, separatorRow];

    let j = i + 2;
    while (j < paragraphs.length && paragraphs[j].parentElement === parent) {
      const rowCells = parseMarkdownRowFromHtml(paragraphs[j].innerHTML);
      if (!rowCells) break;
      dataRows.push(rowCells);
      rowsToRemove.push(paragraphs[j]);
      j += 1;
    }

    if (dataRows.length === 0) continue;

    const table = doc.createElement("table");
    const thead = doc.createElement("thead");
    const headRow = doc.createElement("tr");
    headerCells.forEach((cell) => {
      const th = doc.createElement("th");
      th.innerHTML = cell;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = doc.createElement("tbody");
    dataRows.forEach((row) => {
      const tr = doc.createElement("tr");
      row.forEach((cell) => {
        const td = doc.createElement("td");
        td.innerHTML = cell;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    parent.insertBefore(table, headerRow);
    rowsToRemove.forEach((rowEl) => rowEl.remove());

    i = j - 1;
  }

  return container.innerHTML;
}

function parseMarkdownRowFromHtml(html: string): string[] | null {
  const row = decodeHtmlEntities(html.replace(/&nbsp;/g, " ")).trim();
  if (!row.includes("|")) return null;

  let trimmed = row;
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);

  const cells = trimmed.split("|").map((cell) => cell.trim());
  if (cells.length < 2) return null;

  return cells;
}

function isSeparatorRow(text: string): boolean {
  const row = decodeHtmlEntities(text).trim();
  let trimmed = row;
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);

  const cells = trimmed
    .split("|")
    .map((cell) => cell.trim().replace(/\s+/g, ""));

  if (cells.length === 0) return false;

  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}


/**
 * Extracts CSS text from <style> blocks in an HTML document.
 * Google Docs exports rely heavily on class-based CSS.
 */
function extractCssFromHtml(html: string): string {
  const styles: string[] = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match: RegExpExecArray | null;
  while ((match = styleRegex.exec(html))) {
    styles.push(match[1]);
  }
  return styles.join("\n");
}

type CssDecls = Record<string, string>;
type CssClassStyles = Record<string, CssDecls>;

function parseCssClassStyles(cssText: string): CssClassStyles {
  const map: CssClassStyles = {};
  if (!cssText) return map;

  const ruleRegex = /\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = ruleRegex.exec(cssText))) {
    const className = match[1];
    const declsRaw = match[2];
    const decls: CssDecls = {};

    for (const part of declsRaw.split(";")) {
      const [prop, val] = part.split(":");
      if (!prop || !val) continue;
      decls[prop.trim().toLowerCase()] = val.trim();
    }

    map[className] = { ...(map[className] || {}), ...decls };
  }

  return map;
}

function getDecl(el: Element, classStyles: CssClassStyles, prop: string): string {
  // Inline style first
  const inline = el.getAttribute("style") || "";
  const inlineMatch = inline.match(new RegExp(`${prop}\\s*:\\s*([^;]+)`, "i"));
  if (inlineMatch?.[1]) return inlineMatch[1].trim();

  const classAttr = el.getAttribute("class") || "";
  const classNames = classAttr.split(/\s+/).filter(Boolean);
  for (const cn of classNames) {
    const decls = classStyles[cn];
    if (decls?.[prop]) return decls[prop];
  }

  return "";
}

function hasMonospace(el: Element, classStyles: CssClassStyles): boolean {
  const fontFamily = getDecl(el, classStyles, "font-family").toLowerCase();
  return (
    fontFamily.includes("monospace") ||
    fontFamily.includes("courier") ||
    fontFamily.includes("consolas") ||
    fontFamily.includes("menlo") ||
    fontFamily.includes("source code")
  );
}

/**
 * Converts Google Docs styled paragraphs to semantic heading tags.
 * Google Docs uses class-based CSS to denote heading levels.
 */
function convertGoogleDocsHeadings(html: string, classStyles: CssClassStyles): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const container = doc.body.firstElementChild as HTMLElement | null;

  if (!container) return html;

  const elements = container.querySelectorAll("p, div");

  elements.forEach((el) => {
    const text = el.textContent?.trim() || "";
    if (!text || text.length > 200) return;
    if (el.closest("li, td, th, pre, code, blockquote")) return;
    if (el.querySelector("pre, code, table, ul, ol, li")) return;

    const fontSize = getDecl(el, classStyles, "font-size");
    const fontWeight = getDecl(el, classStyles, "font-weight");

    let headingLevel = 0;

    if (fontSize) {
      const fontSizeMatch = fontSize.match(/(\d+(?:\.\d+)?)(pt|px)/i);
      if (fontSizeMatch) {
        const size = parseFloat(fontSizeMatch[1]);
        const unit = fontSizeMatch[2].toLowerCase();
        const sizeInPt = unit === "px" ? size * 0.75 : size;

        // Google Docs typical sizes: Title ~26pt, H1 ~20pt, H2 ~16pt, H3 ~14pt
        if (sizeInPt >= 24) headingLevel = 1;
        else if (sizeInPt >= 18) headingLevel = 2;
        else if (sizeInPt >= 14) headingLevel = 3;
        else if (sizeInPt >= 12 && fontWeight) headingLevel = 4;
      }
    }

    if (headingLevel > 0 && headingLevel <= 6) {
      const heading = doc.createElement(`h${headingLevel}`);
      heading.innerHTML = (el as HTMLElement).innerHTML;
      el.parentNode?.replaceChild(heading, el);
    }
  });

  return container.innerHTML;
}

/**
 * Converts Google Docs class-styled code blocks into semantic <pre><code> blocks.
 */
function convertGoogleDocsCodeBlocks(html: string, classStyles: CssClassStyles): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const container = doc.body.firstElementChild as HTMLElement | null;

  if (!container) return html;

  const paragraphs = Array.from(container.querySelectorAll("p"));

  const isCodeParagraph = (p: HTMLParagraphElement) => {
    if (hasMonospace(p, classStyles)) return true;
    const span = p.querySelector("span");
    return !!span && hasMonospace(span, classStyles);
  };

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (!isCodeParagraph(p)) continue;

    const codeLines: string[] = [];
    let j = i;

    while (j < paragraphs.length && isCodeParagraph(paragraphs[j])) {
      const line = (paragraphs[j].textContent || "").replace(/\u00a0/g, " ");
      codeLines.push(line);
      j++;
    }

    const pre = doc.createElement("pre");
    const code = doc.createElement("code");
    code.textContent = codeLines.join("\n").trimEnd();
    pre.appendChild(code);

    // Replace first paragraph in the group with <pre>, remove the rest.
    p.parentNode?.replaceChild(pre, p);
    for (let k = i + 1; k < j; k++) {
      paragraphs[k].remove();
    }

    i = j - 1;
  }

  return container.innerHTML;
}

/**
 * Removes Google Docs specific inline styles and class names
 */
function removeGoogleDocsStyles(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const container = doc.body.firstElementChild as HTMLElement | null;
  if (!container) return html;

  const shouldKeepClass = (className: string) => {
    const value = className.trim().toLowerCase();
    if (!value) return false;
    if (value.startsWith("language-")) return true;
    if (value.startsWith("hljs")) return true;
    if (value.startsWith("token")) return true;
    if (value.startsWith("admonition")) return true;
    if (value.startsWith("callout")) return true;
    if (value === "table-wrapper") return true;
    if (value === "task-list" || value === "task-list-item") return true;
    return false;
  };

  container.querySelectorAll("*").forEach((el) => {
    el.removeAttribute("style");
    ["onclick", "onerror", "onload"].forEach((name) => el.removeAttribute(name));

    const classAttr = el.getAttribute("class");
    if (classAttr) {
      const kept = classAttr
        .split(/\s+/)
        .map((value) => value.trim())
        .filter(Boolean)
        .filter(shouldKeepClass);
      if (kept.length > 0) {
        el.setAttribute("class", Array.from(new Set(kept)).join(" "));
      } else {
        el.removeAttribute("class");
      }
    }
  });

  container.querySelectorAll("style, link, meta, title, script").forEach((el) => el.remove());

  container.querySelectorAll("span").forEach((span) => {
    if (span.attributes.length > 0) return;
    if (span.children.length > 0) return;
    const text = span.textContent || "";
    if (text.trim()) {
      span.replaceWith(doc.createTextNode(text));
    } else {
      span.remove();
    }
  });

  container.querySelectorAll("p, div").forEach((el) => {
    const content = (el.textContent || "").replace(/\u00a0/g, " ").trim();
    if (!content && el.children.length === 0) {
      el.remove();
    }
  });

  return container.innerHTML.replace(/&nbsp;/g, " ").replace(/\s{2,}/g, " ").trim();
}

/**
 * Cleans up structural issues in HTML
 */
function cleanupStructure(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const container = doc.body.firstElementChild as HTMLElement | null;

  if (!container) return html;

  convertMarkdownHeadingsInParagraphs(container);
  convertFencedCodeBlocks(container);
  convertMarkdownListsInParagraphs(container);
  convertStandaloneCodeParagraphs(container);

  // Wrap orphaned <li> elements in <ul> tags
  wrapOrphanedListItems(container);
  
  // Convert lines starting with ">" to blockquotes
  convertBlockquotes(container);

  wrapTablesForMobile(container);

  let cleaned = container.innerHTML;
  
  // Ensure proper list structure
  cleaned = cleaned.replace(/<\/li>\s*<li>/gi, '</li><li>');
  
  // Remove empty list items
  cleaned = cleaned.replace(/<li[^>]*>\s*<\/li>/gi, '');
  
  // Ensure table cells have content
  cleaned = cleaned.replace(/<td[^>]*>\s*<\/td>/gi, '<td>&nbsp;</td>');
  cleaned = cleaned.replace(/<th[^>]*>\s*<\/th>/gi, '<th>&nbsp;</th>');
  
  // Ensure code blocks preserve whitespace
  cleaned = cleaned.replace(/<pre><code>/gi, '<pre><code>');
  
  // Clean up nested divs that don't add value
  cleaned = cleaned.replace(/<div[^>]*><div[^>]*>/gi, '<div>');
  cleaned = cleaned.replace(/<\/div><\/div>/gi, '</div>');
  
  // Remove br tags at the start of paragraphs
  cleaned = cleaned.replace(/<p[^>]*>\s*<br\s*\/?>\s*/gi, '<p>');
  
  // Remove br tags at the end of paragraphs
  cleaned = cleaned.replace(/\s*<br\s*\/?>\s*<\/p>/gi, '</p>');
  
  return cleaned;
}

function convertMarkdownHeadingsInParagraphs(container: HTMLElement): void {
  const paragraphs = Array.from(container.querySelectorAll("p"));

  for (const p of paragraphs) {
    if (p.closest("pre, code, li, blockquote, td, th")) continue;
    const text = (p.textContent || "").trim();
    const match = text.match(/^(#{1,6})\s+(.+)$/);
    if (!match) continue;

    const headingLevel = Math.min(6, match[1].length);
    const heading = container.ownerDocument.createElement(`h${headingLevel}`);
    heading.innerHTML = p.innerHTML.replace(/^#{1,6}\s+/, "");
    p.replaceWith(heading);
  }
}

function convertFencedCodeBlocks(container: HTMLElement): void {
  const paragraphs = Array.from(container.querySelectorAll("p"));
  const isFence = (text: string) => /^```/.test(text.trim());

  for (let i = 0; i < paragraphs.length; i += 1) {
    const startParagraph = paragraphs[i];
    if (startParagraph.closest("pre, code, li, blockquote, td, th")) continue;
    const startText = (startParagraph.textContent || "").trim();
    if (!isFence(startText)) continue;

    const language = startText.replace(/^```/, "").trim().toLowerCase();
    const lines: string[] = [];
    const toRemove: HTMLParagraphElement[] = [startParagraph];
    let closed = false;

    for (let j = i + 1; j < paragraphs.length; j += 1) {
      const current = paragraphs[j];
      if (current.closest("pre, code, li, blockquote, td, th")) break;
      const currentText = (current.textContent || "").trim();
      toRemove.push(current);
      if (isFence(currentText)) {
        closed = true;
        i = j;
        break;
      }
      lines.push((current.textContent || "").replace(/\u00a0/g, " "));
    }

    if (!closed) continue;

    const pre = container.ownerDocument.createElement("pre");
    const code = container.ownerDocument.createElement("code");
    if (language) {
      code.className = `language-${language}`;
      pre.setAttribute("data-language", language);
    }
    code.textContent = lines.join("\n").replace(/\n+$/g, "");
    pre.appendChild(code);

    startParagraph.parentNode?.insertBefore(pre, startParagraph);
    toRemove.forEach((element) => element.remove());
  }
}

function convertMarkdownListsInParagraphs(container: HTMLElement): void {
  const paragraphs = Array.from(container.querySelectorAll("p"));

  const asListItem = (paragraph: HTMLParagraphElement) => {
    const text = (paragraph.textContent || "").trim();
    const orderedMatch = text.match(/^(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      return { type: "ol" as const, index: Number(orderedMatch[1]), markerPattern: /^\d+\.\s+/ };
    }
    const unorderedMatch = text.match(/^[-*+]\s+(.+)$/);
    if (unorderedMatch) {
      return { type: "ul" as const, index: 1, markerPattern: /^[-*+]\s+/ };
    }
    return null;
  };

  for (let i = 0; i < paragraphs.length; i += 1) {
    const first = paragraphs[i];
    if (first.closest("pre, code, li, blockquote, td, th")) continue;

    const firstItem = asListItem(first);
    if (!firstItem) continue;

    const list = container.ownerDocument.createElement(firstItem.type);
    if (firstItem.type === "ol" && firstItem.index > 1) {
      list.setAttribute("start", String(firstItem.index));
    }

    let j = i;
    while (j < paragraphs.length) {
      const paragraph = paragraphs[j];
      if (paragraph.closest("pre, code, li, blockquote, td, th")) break;
      const item = asListItem(paragraph);
      if (!item || item.type !== firstItem.type) break;

      const li = container.ownerDocument.createElement("li");
      li.innerHTML = paragraph.innerHTML.replace(item.markerPattern, "");
      list.appendChild(li);
      j += 1;
    }

    if (!list.children.length) continue;

    first.parentNode?.insertBefore(list, first);
    for (let k = i; k < j; k += 1) {
      paragraphs[k].remove();
    }
    i = j - 1;
  }
}

function convertStandaloneCodeParagraphs(container: HTMLElement): void {
  const paragraphs = Array.from(container.querySelectorAll("p"));
  for (const paragraph of paragraphs) {
    if (paragraph.closest("pre, li, blockquote, td, th")) continue;
    if (paragraph.children.length !== 1) continue;
    const child = paragraph.children[0];
    if (child.tagName !== "CODE") continue;
    const codeText = child.textContent?.trim();
    if (!codeText) continue;

    const pre = container.ownerDocument.createElement("pre");
    const code = container.ownerDocument.createElement("code");
    code.textContent = codeText;
    pre.appendChild(code);
    paragraph.replaceWith(pre);
  }
}

function wrapTablesForMobile(container: HTMLElement): void {
  const tables = Array.from(container.querySelectorAll("table"));
  for (const table of tables) {
    const parent = table.parentElement;
    if (!parent || parent.classList.contains("table-wrapper")) continue;
    const wrapper = container.ownerDocument.createElement("div");
    wrapper.className = "table-wrapper";
    parent.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  }
}

/**
 * Wraps orphaned <li> elements (not inside ul/ol) with <ul> tags
 */
function wrapOrphanedListItems(container: HTMLElement): void {
  const allLis = Array.from(container.querySelectorAll('li'));
  
  for (const li of allLis) {
    const parent = li.parentElement;
    if (parent && parent.tagName !== 'UL' && parent.tagName !== 'OL') {
      // This li is orphaned - find consecutive orphaned lis
      const siblings: Element[] = [li];
      let next = li.nextElementSibling;
      
      while (next && next.tagName === 'LI') {
        siblings.push(next);
        next = next.nextElementSibling;
      }
      
      // Create a ul wrapper
      const ul = container.ownerDocument.createElement('ul');
      li.parentNode?.insertBefore(ul, li);
      
      for (const sibling of siblings) {
        ul.appendChild(sibling);
      }
    }
  }
}

/**
 * Converts paragraphs starting with ">" to blockquotes
 */
function convertBlockquotes(container: HTMLElement): void {
  const paragraphs = Array.from(container.querySelectorAll('p'));
  
  for (const p of paragraphs) {
    const text = p.textContent?.trim() || '';
    if (text.startsWith('>') || text.startsWith('&gt;')) {
      const blockquote = container.ownerDocument.createElement('blockquote');
      const newP = container.ownerDocument.createElement('p');
      // Remove the leading ">" and any following space
      newP.innerHTML = p.innerHTML.replace(/^(&gt;|>)\s*/, '');
      blockquote.appendChild(newP);
      p.parentNode?.replaceChild(blockquote, p);
    }
  }
}

/**
 * Legacy function for backwards compatibility
 * @deprecated Use normalizeHtml instead
 */
export function cleanGoogleDocsHtml(html: string): string {
  return normalizeHtml(html);
}
