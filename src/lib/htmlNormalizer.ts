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
  
  // Remove Google Docs specific elements and styles
  content = removeGoogleDocsStyles(content);
  
  // Clean up structural issues
  content = cleanupStructure(content);
  
  // Sanitize to prevent XSS
  content = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'div', 'span',
      'blockquote', 'pre', 'code',
      'hr', 'sup', 'sub'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'target', 'rel', 'colspan', 'rowspan', 'class'],
    FORBID_ATTR: ['style'],
  });
  
  return content.trim();
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
  
  // Convert Google Docs specific tags
  // Google uses <span style="font-weight:bold"> instead of <strong>
  // This is handled by style removal above, but we can try to preserve semantic meaning
  
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
