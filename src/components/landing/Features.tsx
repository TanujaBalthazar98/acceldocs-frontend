import { 
  FolderTree, 
  UserCheck, 
  Globe, 
  Sparkles, 
  ShieldCheck, 
  RefreshCw 
} from "lucide-react";

const features = [
  {
    icon: FolderTree,
    title: "Projects & Topics",
    description: "Organize documentation into Projects with nested Topics. Build a clear structure without moving files out of Google Drive.",
    color: "text-primary",
  },
  {
    icon: Globe,
    title: "Publish Anywhere",
    description: "Publish docs internally for your team or externally on custom domains. Same Google Doc, different audiences.",
    color: "text-primary",
  },
  {
    icon: UserCheck,
    title: "Team Collaboration",
    description: "Invite team members with role-based permissions. Admins, editors, and viewers—everyone has the right access level.",
    color: "text-state-active",
  },
  {
    icon: RefreshCw,
    title: "Live Sync",
    description: "Changes in Google Docs sync automatically. Your published documentation always reflects the latest content.",
    color: "text-state-draft",
  },
  {
    icon: ShieldCheck,
    title: "Visibility Controls",
    description: "Set visibility per page—internal, external, or public. Control exactly who sees what documentation.",
    color: "text-state-deprecated",
  },
  {
    icon: Sparkles,
    title: "Custom Branding",
    description: "Add your logo, colors, and custom domain. Create a branded documentation portal that feels like your own.",
    color: "text-primary",
  },
];

const Features = () => {
  return (
    <section id="features" className="py-24 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/50 to-transparent" />
      
      <div className="container mx-auto px-6 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Everything you need.{' '}
            <span className="text-muted-foreground">Nothing you don't.</span>
          </h2>
          <p className="text-muted-foreground">
            Structure, trust, and governance for your Google Docs. No migrations. No uploads. No duplications.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group p-6 rounded-2xl glass-hover opacity-0 animate-fade-in"
              style={{ animationDelay: `${0.1 + index * 0.1}s` }}
            >
              <div className={`w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className={`w-6 h-6 ${feature.color}`} />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
