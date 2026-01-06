import { ArrowRight, Check } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Connect Your Google Drive",
    description: "Sign in with Google and grant access to your Drive. Select a folder to use as your knowledge base—no uploads or migrations needed.",
    highlights: ["Google SSO", "Folder-based setup", "Your docs stay in Drive"],
  },
  {
    number: "02",
    title: "Organize Into Projects & Topics",
    description: "Create Projects to group related documentation. Add Topics within projects to build a clear hierarchy from your existing Google Docs.",
    highlights: ["Projects → Topics → Pages", "Link existing Google Docs", "Custom slugs & URLs"],
  },
  {
    number: "03",
    title: "Publish & Share",
    description: "Publish documentation internally for your team or externally with custom branding. Control visibility per page—internal, external, or public.",
    highlights: ["Custom domains", "Branded docs portal", "Visibility controls"],
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 relative">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            From chaos to clarity in{' '}
            <span className="text-gradient">3 steps</span>
          </h2>
          <p className="text-muted-foreground">
            No setup wizards. No data migration. Just connect and go.
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Connecting Line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-primary via-primary/50 to-transparent hidden md:block" />

            {steps.map((step, index) => (
              <div
                key={step.number}
                className="relative flex gap-8 mb-12 last:mb-0 opacity-0 animate-fade-in"
                style={{ animationDelay: `${0.2 + index * 0.15}s` }}
              >
                {/* Step Number */}
                <div className="hidden md:flex flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-primary items-center justify-center shadow-glow relative z-10">
                  <span className="text-lg font-bold text-primary-foreground">{step.number}</span>
                </div>

                {/* Content */}
                <div className="flex-1 p-6 rounded-2xl glass-hover">
                  <div className="flex items-center gap-3 mb-3 md:hidden">
                    <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
                      <span className="text-sm font-bold text-primary-foreground">{step.number}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                  
                  <h3 className="text-xl font-semibold mb-2 text-foreground">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {step.description}
                  </p>
                  
                  <div className="flex flex-wrap gap-3">
                    {step.highlights.map((highlight) => (
                      <div
                        key={highlight}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-sm text-secondary-foreground"
                      >
                        <Check className="w-3 h-3 text-primary" />
                        {highlight}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
