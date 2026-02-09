import { cn } from "@/lib/utils";
import { Search, Menu, ChevronRight, FileText, ExternalLink } from "lucide-react";

interface DocumentationPreviewProps {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontHeading: string;
  fontBody: string;
  logoUrl?: string | null;
  tagline?: string | null;
  heroTitle?: string | null;
  heroDescription?: string | null;
  customLinks?: { label: string; url: string; target: string }[];
}

export const DocumentationPreview = ({
  primaryColor,
  secondaryColor,
  accentColor,
  fontHeading,
  fontBody,
  logoUrl,
  tagline,
  heroTitle,
  heroDescription,
  customLinks = [],
}: DocumentationPreviewProps) => {
  return (
    <div 
      className="w-full border border-border rounded-xl overflow-hidden bg-background shadow-sm"
      style={{ fontFamily: fontBody }}
    >
      <div className="bg-muted/30 px-3 py-1.5 border-b border-border flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-destructive/20" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/20" />
        </div>
        <div className="flex-1 bg-background/50 rounded px-2 py-0.5 text-[10px] text-muted-foreground truncate border border-border">
          docs.yourcompany.com
        </div>
      </div>

      <div className="h-[400px] overflow-hidden flex flex-col">
        {/* Header */}
        <header 
          className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0 bg-background"
          style={{ borderTop: `2px solid ${primaryColor}` }}
        >
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-6 w-auto" />
            ) : (
              <div 
                className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: primaryColor }} />
              </div>
            )}
            <span className="font-bold text-sm" style={{ fontFamily: fontHeading }}>Docs</span>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <div className="h-7 w-32 rounded-md border border-border bg-muted/30 flex items-center px-2 gap-2">
              <Search className="w-3 h-3 text-muted-foreground" />
              <div className="w-16 h-2 bg-muted rounded-full" />
            </div>
            <div className="w-8 h-8 rounded-full bg-muted" />
          </div>
          <Menu className="w-4 h-4 sm:hidden text-muted-foreground" />
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <aside className="w-40 border-r border-border p-3 hidden md:block shrink-0 bg-muted/5">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="w-12 h-2 bg-muted rounded-full mb-3" />
                {[1, 2, 3].map((i) => (
                  <div key={i} className={cn(
                    "flex items-center gap-2 p-1.5 rounded",
                    i === 1 && "bg-secondary"
                  )}>
                    <div className="w-3 h-3 rounded bg-muted-foreground/20" />
                    <div className={cn(
                      "h-2 rounded-full",
                      i === 1 ? "w-16 bg-primary/50" : "w-12 bg-muted"
                    )} 
                    style={i === 1 ? { backgroundColor: `${primaryColor}50` } : {}}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <div className="w-16 h-2 bg-muted rounded-full mb-3" />
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-2 p-1.5">
                    <div className="w-3 h-3 rounded bg-muted-foreground/20" />
                    <div className="w-14 h-2 bg-muted rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-6 space-y-6">
            <div className="max-w-xl mx-auto space-y-8">
              {/* Hero Section */}
              <div className="space-y-4 text-center py-4 border-b border-border">
                <h1 
                  className="text-2xl font-bold tracking-tight"
                  style={{ fontFamily: fontHeading, color: primaryColor }}
                >
                  {heroTitle || "Documentation"}
                </h1>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {heroDescription || tagline || "Welcome to our technical documentation. Explore our guides and API reference."}
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <div 
                    className="px-4 py-2 rounded-md text-white text-xs font-medium"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Get Started
                  </div>
                  <div 
                    className="px-4 py-2 rounded-md border text-xs font-medium"
                    style={{ borderColor: primaryColor, color: primaryColor }}
                  >
                    API Reference
                  </div>
                </div>
              </div>

              {/* Sample Content */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: `${accentColor}20` }}>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
                  </div>
                  <div className="w-32 h-3 bg-muted rounded-full" />
                </div>
                <div className="space-y-2">
                  <div className="w-full h-2 bg-muted rounded-full" />
                  <div className="w-full h-2 bg-muted rounded-full" />
                  <div className="w-3/4 h-2 bg-muted rounded-full" />
                </div>
                
                <div className="p-4 rounded-lg bg-muted/30 border-l-4" style={{ borderLeftColor: primaryColor }}>
                  <div className="w-20 h-2 bg-foreground/60 rounded-full mb-2" />
                  <div className="w-full h-2 bg-muted rounded-full" />
                </div>
              </div>

              {/* Footer */}
              <footer className="pt-8 border-t border-border flex flex-wrap justify-between items-center text-[10px] text-muted-foreground gap-4">
                <div className="flex flex-wrap gap-4">
                  {customLinks.length > 0 ? (
                    customLinks.map((link, idx) => (
                      <span key={idx} className="hover:text-foreground transition-colors cursor-pointer">
                        {link.label}
                      </span>
                    ))
                  ) : (
                    <>
                      <span>Privacy Policy</span>
                      <span>Terms of Service</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span>Powered by Docspeare</span>
                  <ExternalLink className="w-2 h-2" />
                </div>
              </footer>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
