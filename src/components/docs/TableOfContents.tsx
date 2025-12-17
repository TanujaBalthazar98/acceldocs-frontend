import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { List } from "lucide-react";

interface TocHeading {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  html: string | null;
  className?: string;
  contentContainerSelector?: string;
}

export function TableOfContents({ 
  html, 
  className,
  contentContainerSelector = ".prose, .doc-content, [data-doc-content]"
}: TableOfContentsProps) {
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const hasAppliedIds = useRef(false);

  // Extract headings from HTML content
  useEffect(() => {
    if (!html) {
      setHeadings([]);
      return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    
    // Look for standard heading tags
    const headingElements = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");
    
    const extracted: TocHeading[] = [];
    headingElements.forEach((el, index) => {
      const text = el.textContent?.trim() || "";
      if (text && text.length < 200) { // Skip unreasonably long "headings"
        const slug = text
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .substring(0, 50);
        const id = `toc-${index}-${slug}`;
        extracted.push({
          id,
          text,
          level: parseInt(el.tagName[1]),
        });
      }
    });
    
    // If no headings found with standard tags, try to find bold/large text patterns
    if (extracted.length === 0) {
      // Look for patterns that might indicate headings
      const allElements = doc.querySelectorAll("p, div, span");
      let headingIndex = 0;
      
      allElements.forEach((el) => {
        const text = el.textContent?.trim() || "";
        // Short text that's direct child content (not nested) could be a heading
        if (
          text && 
          text.length > 0 && 
          text.length < 100 &&
          el.children.length === 0 &&
          !el.closest('li') // Not inside a list
        ) {
          // Check if it looks like a heading (short, possibly starts paragraph)
          const parent = el.parentElement;
          const isFirstChild = parent && parent.firstElementChild === el;
          
          if (isFirstChild || el.tagName === 'P') {
            // Check if text is styled differently (would have been bold originally)
            const computedText = text;
            if (computedText.length < 60 && headingIndex < 20) {
              // Heuristic: short paragraphs at start of sections might be headings
              // This is a fallback for poorly structured content
            }
          }
        }
      });
    }
    
    setHeadings(extracted);
    hasAppliedIds.current = false;
  }, [html]);

  // Add IDs to headings in the rendered content
  useEffect(() => {
    if (headings.length === 0 || hasAppliedIds.current) return;

    // Wait for DOM to be ready
    const applyIds = () => {
      const container = document.querySelector(contentContainerSelector);
      if (!container) {
        // Retry after a short delay if container not found
        setTimeout(applyIds, 100);
        return;
      }

      const headingElements = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
      let appliedCount = 0;
      
      headingElements.forEach((el, index) => {
        const heading = headings[index];
        if (heading && !el.id) {
          el.id = heading.id;
          appliedCount++;
        }
      });
      
      if (appliedCount > 0) {
        hasAppliedIds.current = true;
      }
    };

    // Small delay to ensure content is rendered
    const timeoutId = setTimeout(applyIds, 50);
    return () => clearTimeout(timeoutId);
  }, [headings, contentContainerSelector]);

  // Track active heading on scroll
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible heading
        const visibleEntries = entries.filter(entry => entry.isIntersecting);
        if (visibleEntries.length > 0) {
          // Sort by position and get the topmost
          const topEntry = visibleEntries.reduce((top, entry) => {
            return entry.boundingClientRect.top < top.boundingClientRect.top ? entry : top;
          });
          setActiveId(topEntry.target.id);
        }
      },
      { 
        rootMargin: "-80px 0px -70% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1]
      }
    );

    // Observe all heading elements
    headings.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [headings]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: "smooth",
      });
      setActiveId(id);
    }
  };

  if (headings.length === 0) {
    return null;
  }

  // Find the minimum heading level to normalize indentation
  const minLevel = Math.min(...headings.map(h => h.level));

  return (
    <nav className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
        <List className="h-4 w-4" />
        On this page
      </div>
      <ul className="space-y-1 text-sm">
        {headings.map((heading) => (
          <li
            key={heading.id}
            style={{ paddingLeft: `${(heading.level - minLevel) * 12}px` }}
          >
            <button
              onClick={() => scrollToHeading(heading.id)}
              className={cn(
                "text-left w-full hover:text-foreground transition-colors py-1 truncate leading-snug",
                activeId === heading.id
                  ? "text-primary font-medium"
                  : "text-muted-foreground"
              )}
              title={heading.text}
            >
              {heading.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
