import { 
  ChevronRight, 
  FileText, 
  Folder, 
  User, 
  Clock, 
  CheckCircle2,
  AlertTriangle,
  Circle
} from "lucide-react";

const mockPages = [
  { 
    title: "API Authentication Guide", 
    state: "active", 
    owner: "Sarah K.", 
    verified: "2 days ago",
    visibility: "internal"
  },
  { 
    title: "Getting Started", 
    state: "active", 
    owner: "Mike R.", 
    verified: "1 week ago",
    visibility: "public"
  },
  { 
    title: "Legacy Integration (v1)", 
    state: "deprecated", 
    owner: "—", 
    verified: "45 days ago",
    visibility: "internal"
  },
  { 
    title: "Webhook Setup Draft", 
    state: "draft", 
    owner: "Alex M.", 
    verified: "—",
    visibility: "internal"
  },
];

const stateConfig = {
  active: { color: "bg-state-active", label: "Active" },
  draft: { color: "bg-state-draft", label: "Draft" },
  deprecated: { color: "bg-state-deprecated", label: "Deprecated" },
  archived: { color: "bg-state-archived", label: "Archived" },
};

const DashboardPreview = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-6 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            See your knowledge{' '}
            <span className="text-gradient">at a glance</span>
          </h2>
          <p className="text-muted-foreground">
            A unified view of your documentation. Structure, ownership, and health—all in one place.
          </p>
        </div>

        {/* Dashboard Preview */}
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-border overflow-hidden shadow-lg opacity-0 animate-scale-in" style={{ animationDelay: '0.2s' }}>
            {/* Window Header */}
            <div className="bg-card/80 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive/60" />
                <div className="w-3 h-3 rounded-full bg-state-draft/60" />
                <div className="w-3 h-3 rounded-full bg-state-active/60" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded-md bg-secondary text-xs text-muted-foreground">
                  app.doclayer.io
                </div>
              </div>
            </div>

            {/* Dashboard Content */}
            <div className="bg-background flex">
              {/* Sidebar */}
              <div className="w-64 border-r border-border p-4 hidden md:block">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm">
                    <Folder className="w-4 h-4 text-primary" />
                    <span className="font-medium">Developer Docs</span>
                    <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground" />
                  </div>
                  <div className="pl-6 space-y-1">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary/50 text-muted-foreground text-sm cursor-pointer transition-colors">
                      <Folder className="w-4 h-4" />
                      <span>API Reference</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary/50 text-muted-foreground text-sm cursor-pointer transition-colors">
                      <Folder className="w-4 h-4" />
                      <span>Guides</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary/50 text-muted-foreground text-sm cursor-pointer transition-colors">
                    <Folder className="w-4 h-4" />
                    <span>Product Docs</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary/50 text-muted-foreground text-sm cursor-pointer transition-colors">
                    <Folder className="w-4 h-4" />
                    <span>Internal Wiki</span>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1 p-6">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                  <span>Projects</span>
                  <ChevronRight className="w-3 h-3" />
                  <span>Developer Docs</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-foreground">API Reference</span>
                </div>

                {/* Health Alert */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-state-deprecated/10 border border-state-deprecated/20 mb-6">
                  <AlertTriangle className="w-4 h-4 text-state-deprecated" />
                  <span className="text-sm text-state-deprecated">1 page needs attention: missing owner, not verified in 45+ days</span>
                </div>

                {/* Pages Table */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-secondary/50">
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Page</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">State</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Owner</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Verified</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {mockPages.map((page, index) => (
                        <tr 
                          key={page.title}
                          className="hover:bg-secondary/30 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <span className="text-sm font-medium text-foreground">{page.title}</span>
                                {page.visibility === "public" && (
                                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">Public</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <div className="flex items-center gap-2">
                              <Circle className={`w-2 h-2 ${stateConfig[page.state as keyof typeof stateConfig].color} rounded-full`} />
                              <span className="text-sm text-muted-foreground">
                                {stateConfig[page.state as keyof typeof stateConfig].label}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="flex items-center gap-2">
                              <User className="w-3 h-3 text-muted-foreground" />
                              <span className={`text-sm ${page.owner === "—" ? "text-state-deprecated" : "text-muted-foreground"}`}>
                                {page.owner}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              <span className={`text-sm ${page.verified === "45 days ago" ? "text-state-deprecated" : "text-muted-foreground"}`}>
                                {page.verified}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DashboardPreview;
