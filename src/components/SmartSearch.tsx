import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Sparkles, FileText, FolderOpen, Loader2, ArrowRight, X, Command } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SearchResult {
  id: string;
  title: string;
  type: "page" | "topic" | "project";
  projectName?: string;
  topicName?: string;
  snippet?: string;
}

interface SmartSearchProps {
  placeholder?: string;
  documents?: Array<{
    id: string;
    title: string;
    project_id: string;
    topic_id?: string | null;
    content_html?: string | null;
  }>;
  topics?: Array<{
    id: string;
    name: string;
    project_id: string;
  }>;
  projects?: Array<{
    id: string;
    name: string;
  }>;
  onSelect?: (result: SearchResult) => void;
  onSearch?: (query: string) => void;
  primaryColor?: string;
  showAIButton?: boolean;
  onAskAI?: () => void;
  className?: string;
  size?: "default" | "large";
}

export function SmartSearch({
  placeholder = "Search documentation...",
  documents = [],
  topics = [],
  projects = [],
  onSelect,
  onSearch,
  primaryColor,
  showAIButton = true,
  onAskAI,
  className,
  size = "default",
}: SmartSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Search logic
  const performSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const q = searchQuery.toLowerCase();
    const searchResults: SearchResult[] = [];

    // Search projects
    projects.forEach((project) => {
      if (project.name.toLowerCase().includes(q)) {
        searchResults.push({
          id: project.id,
          title: project.name,
          type: "project",
        });
      }
    });

    // Search topics
    topics.forEach((topic) => {
      if (topic.name.toLowerCase().includes(q)) {
        const project = projects.find((p) => p.id === topic.project_id);
        searchResults.push({
          id: topic.id,
          title: topic.name,
          type: "topic",
          projectName: project?.name,
        });
      }
    });

    // Search documents
    documents.forEach((doc) => {
      if (doc.title.toLowerCase().includes(q)) {
        const project = projects.find((p) => p.id === doc.project_id);
        const topic = doc.topic_id ? topics.find((t) => t.id === doc.topic_id) : null;
        
        // Extract snippet from content if available
        let snippet: string | undefined;
        if (doc.content_html) {
          const textContent = doc.content_html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
          const matchIndex = textContent.toLowerCase().indexOf(q);
          if (matchIndex > -1) {
            const start = Math.max(0, matchIndex - 30);
            const end = Math.min(textContent.length, matchIndex + q.length + 50);
            snippet = (start > 0 ? "..." : "") + textContent.slice(start, end).trim() + (end < textContent.length ? "..." : "");
          }
        }
        
        searchResults.push({
          id: doc.id,
          title: doc.title,
          type: "page",
          projectName: project?.name,
          topicName: topic?.name,
          snippet,
        });
      }
    });

    // Limit results
    setResults(searchResults.slice(0, 10));
    setSelectedIndex(0);
  }, [documents, topics, projects]);

  useEffect(() => {
    performSearch(query);
    onSearch?.(query);
  }, [query, performSearch, onSearch]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  const handleSelect = (result: SearchResult) => {
    onSelect?.(result);
    setQuery("");
    setIsOpen(false);
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Delay closing to allow click events on results
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setIsOpen(false);
      }
    }, 150);
  };

  const getResultIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "project":
        return <FolderOpen className="h-4 w-4" />;
      case "topic":
        return <FolderOpen className="h-4 w-4" />;
      case "page":
        return <FileText className="h-4 w-4" />;
    }
  };

  const isLarge = size === "large";

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Search 
          className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground",
            isLarge ? "h-5 w-5 left-4" : "h-4 w-4"
          )} 
        />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            "pr-24",
            isLarge ? "pl-12 h-14 text-lg" : "pl-10 h-10"
          )}
          style={primaryColor ? { 
            "--tw-ring-color": primaryColor,
          } as React.CSSProperties : undefined}
        />
        <div className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1",
          isLarge && "right-3"
        )}>
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setQuery("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          {showAIButton && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1.5 text-muted-foreground hover:text-primary",
                isLarge ? "h-8 px-2" : "h-6 px-1.5 text-xs"
              )}
              onClick={onAskAI}
              style={primaryColor ? { "--hover-color": primaryColor } as React.CSSProperties : undefined}
            >
              <Sparkles className={isLarge ? "h-4 w-4" : "h-3 w-3"} />
              <span className="hidden sm:inline">Ask AI</span>
            </Button>
          )}
          <kbd className={cn(
            "hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono",
            isLarge ? "text-xs" : "text-[10px]"
          )}>
            <Command className={isLarge ? "h-3 w-3" : "h-2.5 w-2.5"} />K
          </kbd>
        </div>
      </div>

      {/* Results Dropdown */}
      {isOpen && (query.trim() || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          {results.length === 0 && query.trim() ? (
            <div className="p-4 text-center text-muted-foreground">
              <p className="text-sm">No results found for "{query}"</p>
              {showAIButton && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2 gap-1"
                  onClick={onAskAI}
                >
                  <Sparkles className="h-3 w-3" />
                  Ask AI instead
                </Button>
              )}
            </div>
          ) : results.length > 0 ? (
            <ScrollArea className="max-h-80">
              <div className="py-2">
                {results.map((result, index) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    className={cn(
                      "w-full px-4 py-2.5 flex items-start gap-3 text-left transition-colors",
                      index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
                    )}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div 
                      className="p-1.5 rounded-md bg-muted shrink-0 mt-0.5"
                      style={primaryColor && index === selectedIndex ? { backgroundColor: `${primaryColor}20`, color: primaryColor } : undefined}
                    >
                      {getResultIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">
                        {result.title}
                      </div>
                      {(result.projectName || result.topicName) && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          {result.projectName}
                          {result.topicName && (
                            <>
                              <ArrowRight className="h-2.5 w-2.5" />
                              {result.topicName}
                            </>
                          )}
                        </div>
                      )}
                      {result.snippet && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {result.snippet}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0 mt-1">
                      {result.type}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          ) : null}
          
          {/* Quick Actions */}
          <div className="border-t border-border px-4 py-2 bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">esc</kbd>
                close
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
