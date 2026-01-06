import { 
  FolderTree, 
  UserCheck, 
  Globe, 
  Sparkles, 
  ShieldCheck, 
  RefreshCw 
} from "lucide-react";
import { useEffect, useRef } from "react";

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
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    const elements = sectionRef.current?.querySelectorAll('.animate-on-scroll');
    elements?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" ref={sectionRef} className="py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/30 to-transparent" />
      
      <div className="container mx-auto px-6 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-20">
          <h2 
            className="animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 ease-out text-3xl sm:text-4xl md:text-5xl font-bold mb-6"
          >
            Everything you need.{' '}
            <span className="text-muted-foreground">Nothing you don't.</span>
          </h2>
          <p 
            className="animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 ease-out text-lg text-muted-foreground"
            style={{ transitionDelay: '100ms' }}
          >
            Structure, trust, and governance for your Google Docs. No migrations. No uploads. No duplications.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 ease-out group p-8 rounded-2xl bg-card/50 border border-border/50 hover:border-primary/30 hover:shadow-glow"
              style={{ transitionDelay: `${150 + index * 100}ms` }}
            >
              <div className={`w-14 h-14 rounded-xl bg-secondary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className={`w-7 h-7 ${feature.color}`} />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .animate-on-scroll.animate-visible {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
    </section>
  );
};

export default Features;
