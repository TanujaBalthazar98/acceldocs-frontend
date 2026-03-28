import { useState, useEffect } from "react";
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
  scrollContainerSelector?: string;
}

export function TableOfContents({ 
  html, 
  className,
  contentContainerSelector = ".prose, .doc-content, [data-doc-content]",
  scrollContainerSelector,
}: TableOfContentsProps) {
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const toSlug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);

  const normalizeHeadingLevel = (fontSizePx: number): number => {
    if (fontSizePx >= 36) return 2;
    if (fontSizePx >= 30) return 3;
    if (fontSizePx >= 24) return 4;
    return 5;
  };

  const parseFontWeight = (value: string): number => {
    if (!value) return 400;
    if (value === "bold") return 700;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 400;
  };

  const resolveScrollContainer = (): HTMLElement | null => {
    if (scrollContainerSelector) {
      const explicit = document.querySelector(scrollContainerSelector);
      if (explicit instanceof HTMLElement) return explicit;
    }

    const contentContainer = document.querySelector(contentContainerSelector);
    let node: HTMLElement | null =
      contentContainer instanceof HTMLElement ? contentContainer : null;

    while (node && node !== document.body) {
      const style = window.getComputedStyle(node);
      const overflowY = style.overflowY;
      const isScrollable = /(auto|scroll|overlay)/.test(overflowY);
      if (isScrollable && node.scrollHeight > node.clientHeight + 1) {
        return node;
      }
      node = node.parentElement;
    }

    return null;
  };

  // Extract headings from rendered DOM to support Google Docs HTML that lacks h-tags.
  useEffect(() => {
    if (!html) {
      setHeadings([]);
      setActiveId("");
      return;
    }

    let cancelled = false;
    let retries = 0;

    const collectHeadings = () => {
      if (cancelled) return;
      const container = document.querySelector(contentContainerSelector);
      if (!container) {
        if (retries < 10) {
          retries += 1;
          setTimeout(collectHeadings, 80);
        }
        return;
      }

      const extracted: TocHeading[] = [];
      const usedIds = new Set<string>();
      const seenText = new Set<string>();

      const headingNodes = Array.from(container.querySelectorAll("h1, h2, h3, h4, h5, h6"));
      headingNodes.forEach((node, index) => {
        const text = (node.textContent || "").trim();
        if (!text || text.length > 180) return;
        const dedupeKey = `${node.tagName}:${text.toLowerCase()}`;
        if (seenText.has(dedupeKey)) return;
        seenText.add(dedupeKey);

        const level = Number(node.tagName.slice(1));
        const candidateId = node.id || `toc-${index}-${toSlug(text) || "section"}`;
        let resolvedId = candidateId;
        let suffix = 2;
        while (usedIds.has(resolvedId)) {
          resolvedId = `${candidateId}-${suffix}`;
          suffix += 1;
        }
        usedIds.add(resolvedId);
        if (!node.id) node.id = resolvedId;

        extracted.push({ id: resolvedId, text, level });
      });

      // Fallback for Google Docs HTML where headings are often styled <p> tags.
      if (extracted.length === 0) {
        const candidateNodes = Array.from(container.querySelectorAll("p, div"));
        candidateNodes.forEach((node, index) => {
          if (extracted.length >= 200) return;
          if (node.querySelector("p, div, h1, h2, h3, h4, h5, h6")) return;
          if (node.closest("li, table, blockquote, pre, code")) return;

          const text = (node.textContent || "").trim();
          if (!text || text.length < 3 || text.length > 100) return;

          const directStyledChild = node.querySelector(":scope > span, :scope > strong, :scope > b");
          const nodeStyle = window.getComputedStyle(node as HTMLElement);
          const childStyle = directStyledChild
            ? window.getComputedStyle(directStyledChild as HTMLElement)
            : null;
          const fontSize = Math.max(
            Number.parseFloat(nodeStyle.fontSize || "0"),
            Number.parseFloat(childStyle?.fontSize || "0"),
          );
          const fontWeight = Math.max(
            parseFontWeight(nodeStyle.fontWeight),
            parseFontWeight(childStyle?.fontWeight || ""),
          );
          const shortHeadingText = text.split(/\s+/).length <= 10 && !/[.:;!?]$/.test(text);
          const next = node.nextElementSibling as HTMLElement | null;
          const nextTag = next?.tagName?.toLowerCase();
          const nextLooksLikeContent = !!nextTag && ["p", "ul", "ol", "table", "pre", "div"].includes(nextTag);
          const genericShortHeading =
            text.split(/\s+/).length <= 8 &&
            !/[.!?]$/.test(text) &&
            !text.includes("http") &&
            !text.includes("@");
          const looksLikeHeading =
            fontSize >= 20 ||
            fontWeight >= 600 ||
            (shortHeadingText && nextLooksLikeContent) ||
            genericShortHeading;
          if (!looksLikeHeading) return;

          const dedupeKey = `fallback:${text.toLowerCase()}`;
          if (seenText.has(dedupeKey)) return;
          seenText.add(dedupeKey);

          const candidateId = node.id || `toc-fallback-${index}-${toSlug(text) || "section"}`;
          let resolvedId = candidateId;
          let suffix = 2;
          while (usedIds.has(resolvedId)) {
            resolvedId = `${candidateId}-${suffix}`;
            suffix += 1;
          }
          usedIds.add(resolvedId);
          if (!node.id) node.id = resolvedId;

          extracted.push({
            id: resolvedId,
            text,
            level: normalizeHeadingLevel(fontSize),
          });
        });
      }

      if (!extracted.length && retries < 10) {
        retries += 1;
        setTimeout(collectHeadings, 100);
        return;
      }

      if (!cancelled) {
        setHeadings(extracted);
        setActiveId((prev) => (extracted.some((h) => h.id === prev) ? prev : extracted[0]?.id || ""));
      }
    };

    const timeoutId = setTimeout(collectHeadings, 40);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [html, contentContainerSelector]);

  // Track active heading on scroll
  useEffect(() => {
    if (headings.length === 0) return;

    const scrollContainer = resolveScrollContainer();
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
        root: scrollContainer,
        rootMargin: scrollContainer ? "-56px 0px -70% 0px" : "-80px 0px -70% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1]
      }
    );

    // Observe all heading elements
    headings.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [headings, contentContainerSelector, scrollContainerSelector]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const scrollContainer = resolveScrollContainer();
      if (scrollContainer) {
        const offset = 24;
        const targetTop =
          element.getBoundingClientRect().top -
          scrollContainer.getBoundingClientRect().top +
          scrollContainer.scrollTop -
          offset;
        scrollContainer.scrollTo({
          top: Math.max(targetTop, 0),
          behavior: "smooth",
        });
      } else {
        const offset = 100;
        const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({
          top: elementPosition - offset,
          behavior: "smooth",
        });
      }
      setActiveId(id);
    }
  };

  if (headings.length === 0) {
    return (
      <nav className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
          <List className="h-4 w-4" />
          On this page
        </div>
        <p className="text-xs text-muted-foreground/70">No sections detected.</p>
      </nav>
    );
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
