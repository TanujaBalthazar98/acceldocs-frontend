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
    title: "Structured Navigation",
    description: "Organize docs into Projects, Topics, and Pages. Your folder chaos becomes clear, navigable knowledge.",
    color: "text-primary",
  },
  {
    icon: UserCheck,
    title: "Ownership & Accountability",
    description: "Every page has an owner. Know who's responsible. No more orphaned, outdated documentation.",
    color: "text-state-active",
  },
  {
    icon: RefreshCw,
    title: "Lifecycle Management",
    description: "Track document states: draft, active, deprecated, archived. Surface stale content automatically.",
    color: "text-state-draft",
  },
  {
    icon: ShieldCheck,
    title: "Knowledge Health",
    description: "Actionable dashboards showing unowned pages, overdue reviews, and high-impact changes.",
    color: "text-state-deprecated",
  },
  {
    icon: Globe,
    title: "External Publishing",
    description: "Publish docs externally with one click. Internal, authenticated, or public—same Google Doc, different audience.",
    color: "text-primary",
  },
  {
    icon: Sparkles,
    title: "Enterprise-Safe AI",
    description: "Summarize, detect outdated sections, and identify gaps. Page-scoped, permission-aware, citation-backed.",
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
