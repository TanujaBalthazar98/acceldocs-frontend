import { Link } from "react-router-dom";
import { Search, ArrowRight, FileText, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
}

interface DocsLandingProps {
  organization: OrganizationBranding;
  projects: Project[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onProjectSelect: (project: Project) => void;
  isAuthenticated: boolean;
}

export const DocsLanding = ({
  organization,
  projects,
  searchQuery,
  onSearchChange,
  onProjectSelect,
  isAuthenticated,
}: DocsLandingProps) => {
  const orgIdentifier = organization.slug || organization.domain;

  const heroTitle = organization.hero_title || `${organization.name} Documentation`;
  const heroDescription = organization.hero_description || 
    `Explore our comprehensive documentation to learn how to get the most out of ${organization.name}.`;

  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16 lg:py-24 text-center">
        {/* Logo */}
        {organization.logo_url && (
          <img 
            src={organization.logo_url} 
            alt={organization.name}
            className="h-16 lg:h-20 w-auto object-contain mb-6"
          />
        )}

        {/* Title */}
        <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground mb-4 brand-heading">
          {heroTitle}
        </h1>

        {/* Description */}
        <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mb-8 brand-body">
          {heroDescription}
        </p>

        {/* Search */}
        {organization.show_search_on_landing && (
          <div className="w-full max-w-xl mb-12">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-12 pr-4 h-14 text-lg bg-card border-border shadow-lg focus:ring-2"
                style={{ 
                  "--tw-ring-color": organization.primary_color,
                } as React.CSSProperties}
              />
            </div>
          </div>
        )}

        {/* Quick Links */}
        {!organization.show_featured_projects && projects.length > 0 && (
          <div className="flex flex-wrap gap-3 justify-center">
            {projects.slice(0, 3).map(project => (
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
                <FileText className="h-4 w-4" />
                {project.name}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ))}
          </div>
        )}
      </section>

      {/* Featured Projects */}
      {organization.show_featured_projects && projects.length > 0 && (
        <section className="px-4 pb-16 lg:pb-24">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-semibold text-foreground mb-6 text-center brand-heading">
              Browse Documentation
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map(project => (
                <button
                  key={project.id}
                  onClick={() => onProjectSelect(project)}
                  className="group p-6 rounded-xl border border-border bg-card hover:shadow-lg transition-all text-left"
                  style={{
                    "--hover-border": organization.primary_color,
                  } as React.CSSProperties}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = organization.primary_color;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "";
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div 
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: `${organization.primary_color}15` }}
                    >
                      <FolderOpen 
                        className="h-6 w-6"
                        style={{ color: organization.primary_color }}
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
                      style={{ color: organization.primary_color }}
                    />
                  </div>
                </button>
              ))}
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
            {isAuthenticated ? (
              <Link to="/dashboard" className="hover:text-foreground transition-colors">
                Dashboard
              </Link>
            ) : (
              <Link to="/auth" className="hover:text-foreground transition-colors">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
