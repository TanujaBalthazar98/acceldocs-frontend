import { Link } from "react-router-dom";
import { ArrowRight, FileText, FolderOpen, Code, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmartSearch } from "@/components/SmartSearch";
import { LandingBlockRenderer, type LandingBlock } from "./LandingBlockRenderer";

interface Project {
  id: string;
  name: string;
  slug: string | null;
  description?: string | null;
}

interface OrganizationBranding {
  name: string;
  domain: string;
  slug: string | null;
  logo_url: string | null;
  tagline: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_heading: string;
  font_body: string;
  hero_title: string | null;
  hero_description: string | null;
  show_search_on_landing: boolean;
  show_featured_projects: boolean;
  mcp_enabled?: boolean | null;
  openapi_spec_json?: any;
  openapi_spec_url?: string | null;
}

interface Document {
  id: string;
  title: string;
  project_id: string;
  topic_id?: string | null;
  content_html?: string | null;
}

interface Topic {
  id: string;
  name: string;
  project_id: string;
}

interface DocsLandingProps {
  organization: OrganizationBranding;
  projects: Project[];
  featuredProjects?: Project[];
  searchProjects?: Project[];
  documents?: Document[];
  topics?: Topic[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onProjectSelect: (project: Project) => void;
  onDocumentSelect?: (docId: string) => void;
  onTopicSelect?: (topicId: string) => void;
  onAskAI?: () => void;
  isAuthenticated: boolean;
  isOrgMember?: boolean;
  hasNonPublicContent?: boolean;
  landingBlocks?: LandingBlock[] | null;
}

export const DocsLanding = ({
  organization,
  projects,
  featuredProjects,
  searchProjects,
  documents = [],
  topics = [],
  searchQuery,
  onSearchChange,
  onProjectSelect,
  onDocumentSelect,
  onTopicSelect,
  onAskAI,
  isAuthenticated,
  isOrgMember = false,
  hasNonPublicContent = false,
  landingBlocks,
}: DocsLandingProps) => {
  const orgIdentifier = organization.slug || organization.domain;
  const featured = featuredProjects ?? projects;
  const searchList = searchProjects ?? projects;

  // When the org hasn't picked a brand color we want pure monochrome —
  // route everything through CSS vars so it adopts foreground/muted instead
  // of rendering empty/invalid inline colors like `#15` or "".
  const hasBrandColor = !!organization.primary_color?.trim();
  const accentColor = hasBrandColor ? organization.primary_color : "hsl(var(--foreground))";
  const accentTint = hasBrandColor
    ? `${organization.primary_color}15`
    : "hsl(var(--muted) / 0.6)";

  const heroTitle = organization.hero_title || `${organization.name} Documentation`;
  const heroDescription = organization.hero_description || 
    `Explore our comprehensive documentation to learn how to get the most out of ${organization.name}.`;

  return (
    <div className="docs-landing-shell min-h-[80vh] flex flex-col">
      {/* Hero Section */}
      <section className="docs-landing-hero flex-1 flex flex-col items-center justify-center px-4 py-16 lg:py-24 text-center">
        <div className="docs-landing-kicker mb-3 text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
          Documentation
        </div>
        {/* Logo */}
        {organization.logo_url && (
          <img 
            src={organization.logo_url} 
            alt={organization.name}
            className="h-16 lg:h-20 w-auto object-contain mb-6"
          />
        )}

        {/* Title */}
        <h1 className="docs-landing-title text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground mb-4 brand-heading">
          {heroTitle}
        </h1>

        {/* Description */}
        <p className="docs-landing-description text-lg lg:text-xl text-muted-foreground max-w-2xl mb-8 brand-body">
          {heroDescription}
        </p>

        {/* Search */}
        {organization.show_search_on_landing && (
          <div className="docs-landing-search w-full max-w-xl mb-12">
            <SmartSearch
              placeholder="Search documentation..."
              documents={documents}
              topics={topics}
              projects={searchList}
              orgSlug={organization.slug || undefined}
              audience={isAuthenticated ? "all" : "public"}
              primaryColor={organization.primary_color}
              size="large"
              showAIButton={true}
              onAskAI={onAskAI}
              onSearch={onSearchChange}
              onSelect={(result) => {
                if (result.type === "project") {
                  const project = searchList.find(p => p.id === result.id);
                  if (project) onProjectSelect(project);
                } else if (result.type === "topic" && onTopicSelect) {
                  onTopicSelect(result.id);
                } else if (result.type === "page" && onDocumentSelect) {
                  onDocumentSelect(result.id);
                }
              }}
            />
          </div>
        )}

        {/* Quick Links */}
        {!organization.show_featured_projects && featured.length > 0 && (
          <div className="docs-landing-quick-links flex flex-wrap gap-3 justify-center">
            {featured.slice(0, 3).map(project => (
              <Button
                key={project.id}
                variant="outline"
                className="gap-2 hover:text-white transition-colors"
                onClick={() => onProjectSelect(project)}
                style={{
                  borderColor: accentColor,
                  color: accentColor,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = accentColor;
                  e.currentTarget.style.color = hasBrandColor ? "white" : "hsl(var(--background))";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = accentColor;
                }}
              >
                <FileText className="h-4 w-4" />
                {project.name}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ))}
          </div>
        )}
      </section>

      {/* Custom Landing Blocks */}
      {landingBlocks && landingBlocks.length > 0 && (
        <div>
          {landingBlocks
            .filter((b) => b.type !== "hero")
            .map((block) => (
              <LandingBlockRenderer
                key={block.id}
                block={block}
                primaryColor={organization.primary_color}
                onNavigate={(href) => {
                  if (href.startsWith("/") || href.startsWith("http")) {
                    window.location.href = href;
                  }
                }}
              />
            ))}
        </div>
      )}

      {organization.show_featured_projects && featured.length > 0 && (
        <section className="docs-landing-featured px-4 pb-16 lg:pb-24">
          <div className="max-w-5xl mx-auto">
            <h2 className="docs-landing-featured-title text-2xl font-semibold text-foreground mb-6 text-center brand-heading">
              Browse Documentation
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featured.map(project => (
                <button
                  key={project.id}
                  onClick={() => onProjectSelect(project)}
                  className="docs-landing-card group p-6 rounded-xl border border-border bg-card hover:shadow-lg transition-all text-left"
                  style={{
                    "--hover-border": organization.primary_color,
                  } as React.CSSProperties}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = accentColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "";
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div 
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: accentTint }}
                    >
                      <FolderOpen 
                        className="h-6 w-6"
                        style={{ color: accentColor }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 
                        className="font-semibold text-foreground transition-colors brand-heading"
                        style={{ "--hover-color": organization.primary_color } as React.CSSProperties}
                      >
                        {project.name}
                      </h3>
                      {project.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2 brand-body">
                          {project.description}
                        </p>
                      )}
                    </div>
                    <ArrowRight 
                      className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-all"
                      style={{ color: accentColor }}
                    />
                  </div>
                </button>
              ))}
              
              {/* API Reference Card */}
              {(organization.openapi_spec_json || organization.openapi_spec_url) && (
                <Link
                  to={`/api/${orgIdentifier}`}
                  className="docs-landing-card group p-6 rounded-xl border border-border bg-card hover:shadow-lg transition-all text-left"
                  style={{
                    "--hover-border": organization.primary_color,
                  } as React.CSSProperties}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = accentColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "";
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div 
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: accentTint }}
                    >
                      <FileJson 
                        className="h-6 w-6"
                        style={{ color: accentColor }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 
                        className="font-semibold text-foreground transition-colors brand-heading"
                        style={{ "--hover-color": organization.primary_color } as React.CSSProperties}
                      >
                        API Reference
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2 brand-body">
                        Explore the API documentation
                      </p>
                    </div>
                    <ArrowRight 
                      className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-all"
                      style={{ color: accentColor }}
                    />
                  </div>
                </Link>
              )}
              
              {/* MCP Protocol Card */}
              {organization.mcp_enabled && (
                <Link
                  to={`/mcp/${orgIdentifier}`}
                  className="docs-landing-card group p-6 rounded-xl border border-border bg-card hover:shadow-lg transition-all text-left"
                  style={{
                    "--hover-border": organization.primary_color,
                  } as React.CSSProperties}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = accentColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "";
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div 
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: accentTint }}
                    >
                      <Code 
                        className="h-6 w-6"
                        style={{ color: accentColor }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 
                        className="font-semibold text-foreground transition-colors brand-heading"
                        style={{ "--hover-color": organization.primary_color } as React.CSSProperties}
                      >
                        MCP Protocol
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2 brand-body">
                        Model Context Protocol integration
                      </p>
                    </div>
                    <ArrowRight 
                      className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-all"
                      style={{ color: accentColor }}
                    />
                  </div>
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-border py-6 px-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2 brand-body">
            {organization.logo_url ? (
              <img src={organization.logo_url} alt="" className="h-5 w-auto" />
            ) : null}
            <span>{organization.name}</span>
            {organization.tagline && (
              <>
                <span className="text-border">•</span>
                <span>{organization.tagline}</span>
              </>
            )}
          </div>
          <div>
            {/* Only show Dashboard/Sign in if there's non-public content */}
            {hasNonPublicContent && (
              isAuthenticated && isOrgMember ? (
                <Link to="/dashboard" className="hover:text-foreground transition-colors">
                  Dashboard
                </Link>
              ) : !isAuthenticated ? (
                <Link to="/auth" className="hover:text-foreground transition-colors">
                  Sign in
                </Link>
              ) : null
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
