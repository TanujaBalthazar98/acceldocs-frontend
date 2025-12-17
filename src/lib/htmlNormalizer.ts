import DOMPurify from "dompurify";

/**
 * Normalizes and cleans HTML content for consistent display.
 * Handles both Google Docs exported HTML and markdown-converted HTML.
 */
export function normalizeHtml(html: string): string {
  if (!html) return '';
  
  // Extract body content if present
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let content = bodyMatch ? bodyMatch[1] : html;
  
  // FIRST: Convert Google Docs styled text to semantic headings BEFORE removing styles
  content = convertGoogleDocsHeadings(content);
  
  // Remove Google Docs specific elements and styles
  content = removeGoogleDocsStyles(content);
  
  // Clean up structural issues
  content = cleanupStructure(content);
  
  // Sanitize to prevent XSS while preserving markdown HTML structure
  content = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'a', 'img',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
      'div', 'span', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main',
      'blockquote', 'pre', 'code', 'kbd', 'samp', 'var',
      'hr', 'sup', 'sub', 'mark', 'small', 'abbr', 'time', 'address',
      'dl', 'dt', 'dd', 'figure', 'figcaption', 'details', 'summary'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'colspan', 'rowspan', 'class', 'id', 'name', 'datetime', 'lang', 'dir'],
    FORBID_ATTR: ['style', 'onclick', 'onerror', 'onload'],
    ALLOW_DATA_ATTR: false,
  });
  
  return content.trim();
}

/**
 * Converts Google Docs styled paragraphs to semantic heading tags.
 * Google Docs uses font-size in styles to denote heading levels.
 */
function convertGoogleDocsHeadings(html: string): string {
  // Parse HTML to work with DOM
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.body.firstChild as HTMLElement;
  
  if (!container) return html;
  
  // Find all paragraphs and spans that might be headings based on font-size
  const elements = container.querySelectorAll('p, span, div');
  
  elements.forEach((el) => {
    const style = el.getAttribute('style') || '';
    const text = el.textContent?.trim() || '';
    
    // Skip empty elements or those with too much text (likely not headings)
    if (!text || text.length > 200) return;
    
    // Check for font-size in style (Google Docs heading indicator)
    const fontSizeMatch = style.match(/font-size:\s*(\d+(?:\.\d+)?)(pt|px)/i);
    const fontWeightMatch = style.match(/font-weight:\s*(\d+|bold)/i);
    
    let headingLevel = 0;
    
    if (fontSizeMatch) {
      const size = parseFloat(fontSizeMatch[1]);
      const unit = fontSizeMatch[2].toLowerCase();
      
      // Convert to pt for comparison (1px ≈ 0.75pt)
      const sizeInPt = unit === 'px' ? size * 0.75 : size;
      
      // Google Docs typical heading sizes:
      // Title: 26pt, H1: 20pt, H2: 16pt, H3: 14pt, H4: 12pt (bold), Normal: 11pt
      if (sizeInPt >= 24) headingLevel = 1;
      else if (sizeInPt >= 18) headingLevel = 2;
      else if (sizeInPt >= 14) headingLevel = 3;
      else if (sizeInPt >= 12 && fontWeightMatch) headingLevel = 4;
    }
    
    // Also check for Google Docs heading classes
    const className = el.getAttribute('class') || '';
    if (className.includes('title')) headingLevel = 1;
    else if (className.includes('subtitle')) headingLevel = 2;
    else if (className.match(/heading[_-]?1/i)) headingLevel = 1;
    else if (className.match(/heading[_-]?2/i)) headingLevel = 2;
    else if (className.match(/heading[_-]?3/i)) headingLevel = 3;
    else if (className.match(/heading[_-]?4/i)) headingLevel = 4;
    
    if (headingLevel > 0 && headingLevel <= 6) {
      // Create a new heading element
      const heading = doc.createElement(`h${headingLevel}`);
      heading.textContent = text;
      
      // Replace the element with the heading
      if (el.parentNode) {
        el.parentNode.replaceChild(heading, el);
      }
    }
  });
  
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
