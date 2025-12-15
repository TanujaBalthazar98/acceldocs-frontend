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
  
  // Dynamic styles from org branding
  const dynamicStyles = {
    '--brand-primary': organization.primary_color,
    '--brand-secondary': organization.secondary_color,
    '--brand-accent': organization.accent_color,
    '--brand-font-heading': organization.font_heading,
    '--brand-font-body': organization.font_body,
  } as React.CSSProperties;

  const heroTitle = organization.hero_title || `${organization.name} Documentation`;
  const heroDescription = organization.hero_description || 
    `Explore our comprehensive documentation to learn how to get the most out of ${organization.name}.`;

  return (
    <div style={dynamicStyles} className="min-h-[80vh] flex flex-col">
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
        <h1 
          className="text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground mb-4"
          style={{ fontFamily: `var(--brand-font-heading), sans-serif` }}
        >
          {heroTitle}
        </h1>

        {/* Description */}
        <p 
          className="text-lg lg:text-xl text-muted-foreground max-w-2xl mb-8"
          style={{ fontFamily: `var(--brand-font-body), sans-serif` }}
        >
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
                className="pl-12 pr-4 h-14 text-lg bg-card border-border shadow-lg"
                style={{ 
                  borderColor: organization.primary_color + '40',
                }}
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
                className="gap-2"
                onClick={() => onProjectSelect(project)}
                style={{
                  borderColor: organization.primary_color + '40',
                  color: organization.primary_color,
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
            <h2 
              className="text-2xl font-semibold text-foreground mb-6 text-center"
              style={{ fontFamily: `var(--brand-font-heading), sans-serif` }}
            >
              Browse Documentation
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map(project => (
                <button
                  key={project.id}
                  onClick={() => onProjectSelect(project)}
                  className="group p-6 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all text-left"
                  style={{
                    '--hover-border': organization.primary_color,
                  } as React.CSSProperties}
                >
                  <div className="flex items-start gap-4">
                    <div 
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: organization.primary_color + '15' }}
                    >
                      <FolderOpen 
                        className="h-6 w-6"
                        style={{ color: organization.primary_color }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 
                        className="font-semibold text-foreground group-hover:text-primary transition-colors"
                        style={{ fontFamily: `var(--brand-font-heading), sans-serif` }}
                      >
                        {project.name}
                      </h3>
                      {project.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
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
          <div className="flex items-center gap-2">
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
