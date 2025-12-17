import DOMPurify from "dompurify";

/**
 * Normalizes and cleans HTML content for consistent display.
 * Handles both Google Docs exported HTML and markdown-converted HTML.
 */
export function normalizeHtml(html: string): string {
  if (!html) return "";

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

  // Sanitize to prevent XSS while preserving markdown/Docs HTML structure
  content = DOMPurify.sanitize(content, {
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
      "alt",
      "title",
      "target",
      "rel",
      "colspan",
      "rowspan",
      "class",
      "id",
      "name",
      "datetime",
      "lang",
      "dir",
    ],
    FORBID_ATTR: ["style", "onclick", "onerror", "onload"],
    ALLOW_DATA_ATTR: false,
  });

  return content.trim();
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

  const elements = container.querySelectorAll("p, span, div");

  elements.forEach((el) => {
    const text = el.textContent?.trim() || "";
    if (!text || text.length > 200) return;

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
  let cleaned = html;
  
  // Remove all inline styles
  cleaned = cleaned.replace(/\s*style="[^"]*"/gi, '');
  
  // Remove Google Docs specific classes
  cleaned = cleaned.replace(/\s*class="[^"]*"/gi, '');
  
  // Remove empty spans
  cleaned = cleaned.replace(/<span[^>]*>\s*<\/span>/gi, '');
  
  // Unwrap unnecessary span wrappers (spans that just wrap text without semantic meaning)
  cleaned = cleaned.replace(/<span[^>]*>([^<]*)<\/span>/gi, '$1');
  
  // Remove Google Docs specific elements
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<link[^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta[^>]*>/gi, '');
  cleaned = cleaned.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '');
  
  // Remove empty paragraphs and divs
  cleaned = cleaned.replace(/<p[^>]*>\s*(&nbsp;)?\s*<\/p>/gi, '');
  cleaned = cleaned.replace(/<div[^>]*>\s*<\/div>/gi, '');
  
  // Clean up whitespace
  cleaned = cleaned.replace(/&nbsp;/g, ' ');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  
  return cleaned;
}

/**
 * Cleans up structural issues in HTML
 */
function cleanupStructure(html: string): string {
  let cleaned = html;
  
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

/**
 * Legacy function for backwards compatibility
 * @deprecated Use normalizeHtml instead
 */
export function cleanGoogleDocsHtml(html: string): string {
  return normalizeHtml(html);
}
