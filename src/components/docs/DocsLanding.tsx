import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, Code, FileJson } from "lucide-react";
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

  const heroTitle = organization.hero_title || "Documentation";
  const heroDescription = organization.hero_description || 
    `Explore our comprehensive documentation to learn how to get the most out of ${organization.name}.`;

  const featuredCardBackgrounds = [
    "linear-gradient(135deg, hsl(var(--primary) / 0.18) 0%, hsl(var(--accent) / 0.14) 100%)",
    "linear-gradient(135deg, hsl(214 100% 62% / 0.15) 0%, hsl(257 92% 66% / 0.15) 100%)",
    "linear-gradient(135deg, hsl(46 99% 62% / 0.2) 0%, hsl(30 95% 63% / 0.16) 100%)",
  ];

  return (
    <div className="docs-landing-shell min-h-[calc(100vh-56px)] flex flex-col">
      <section className="docs-landing-hero">
        <div className="docs-landing-hero-inner">
          <div className="docs-landing-hero-copy">
            <div className="docs-landing-kicker">Documentation</div>
            <h1 className="docs-landing-title brand-heading">{heroTitle}</h1>
            <p className="docs-landing-description brand-body">{heroDescription}</p>
            <div className="docs-landing-hero-actions">
              {featured[0] ? (
                <Button
                  className="docs-landing-primary-action"
                  onClick={() => onProjectSelect(featured[0])}
                  style={{ backgroundColor: organization.primary_color }}
                >
                  {featured[0].name}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="docs-landing-hero-art" aria-hidden>
            <div className="docs-landing-hero-art-outline" />
            <div className="docs-landing-hero-art-solid" />
            <div className="docs-landing-hero-art-spark" />
          </div>
        </div>
      </section>

      {organization.show_search_on_landing && (
        <section className="docs-landing-search-row md:hidden">
          <div className="docs-landing-search-inner">
            <SmartSearch
              placeholder="Search documentation..."
              documents={documents}
              topics={topics}
              projects={searchList}
              orgSlug={organization.slug || undefined}
              audience={isAuthenticated ? "all" : "public"}
              primaryColor={organization.primary_color}
              showAIButton={true}
              onAskAI={onAskAI}
              onSearch={onSearchChange}
              onSelect={(result) => {
                if (result.type === "project") {
                  const project = searchList.find((p) => p.id === result.id);
                  if (project) onProjectSelect(project);
                } else if (result.type === "topic" && onTopicSelect) {
                  onTopicSelect(result.id);
                } else if (result.type === "page" && onDocumentSelect) {
                  onDocumentSelect(result.id);
                }
              }}
            />
          </div>
        </section>
      )}

      {!organization.show_featured_projects && featured.length > 0 && (
        <section className="docs-landing-quick-links-wrap">
          <div className="docs-landing-quick-links">
            {featured.slice(0, 4).map((project) => (
              <Button
                key={project.id}
                variant="outline"
                className="gap-2 hover:text-white transition-colors"
                onClick={() => onProjectSelect(project)}
                style={{
                  borderColor: organization.primary_color,
                  color: organization.primary_color,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = organization.primary_color;
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = organization.primary_color;
                }}
              >
                {project.name}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ))}
          </div>
        </section>
      )}

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
        <section className="docs-landing-featured">
          <div className="docs-landing-featured-inner">
            <div className="docs-landing-featured-grid">
              {featured.map((project, index) => (
                <button
                  key={project.id}
                  onClick={() => onProjectSelect(project)}
                  className="docs-landing-card group text-left"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = organization.primary_color;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "";
                  }}
                >
                  <div
                    className="docs-landing-card-media"
                    style={{
                      background: featuredCardBackgrounds[index % featuredCardBackgrounds.length],
                    }}
                  >
                    <div className="docs-landing-card-shape" />
                  </div>
                  <div className="docs-landing-card-body">
                    <h3 className="docs-landing-card-title brand-heading">{project.name}</h3>
                    {project.description && (
                      <p className="docs-landing-card-description brand-body">{project.description}</p>
                    )}
                    <span
                      className="docs-landing-card-link"
                      style={{ color: organization.primary_color }}
                    >
                      Open section
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </button>
              ))}
              
              {/* API Reference Card */}
              {(organization.openapi_spec_json || organization.openapi_spec_url) && (
                <Link
                  to={`/api/${orgIdentifier}`}
                  className="docs-landing-card group text-left"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = organization.primary_color;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "";
                  }}
                >
                  <div className="docs-landing-card-media docs-landing-card-media--api">
                    <FileJson className="h-7 w-7" style={{ color: organization.primary_color }} />
                  </div>
                  <div className="docs-landing-card-body">
                    <h3 className="docs-landing-card-title brand-heading">API Reference</h3>
                    <p className="docs-landing-card-description brand-body">
                      Explore endpoints, payloads, and response formats.
                    </p>
                    <span className="docs-landing-card-link" style={{ color: organization.primary_color }}>
                      Open API docs
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              )}
              
              {/* MCP Protocol Card */}
              {organization.mcp_enabled && (
                <Link
                  to={`/mcp/${orgIdentifier}`}
                  className="docs-landing-card group text-left"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = organization.primary_color;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "";
                  }}
                >
                  <div className="docs-landing-card-media docs-landing-card-media--mcp">
                    <Code className="h-7 w-7" style={{ color: organization.primary_color }} />
                  </div>
                  <div className="docs-landing-card-body">
                    <h3 className="docs-landing-card-title brand-heading">MCP Protocol</h3>
                    <p className="docs-landing-card-description brand-body">
                      Connect assistants with workspace context through MCP.
                    </p>
                    <span className="docs-landing-card-link" style={{ color: organization.primary_color }}>
                      Open MCP docs
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-border py-6 px-4">
        <div className="max-w-[1320px] mx-auto flex items-center justify-between text-sm text-muted-foreground">
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
