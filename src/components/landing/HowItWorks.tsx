import { Check } from "lucide-react";
import { useEffect, useRef } from "react";

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
    <section id="how-it-works" ref={sectionRef} className="py-32 relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2" />
      
      <div className="container mx-auto px-6 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-20">
          <h2 
            className="animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 ease-out text-3xl sm:text-4xl md:text-5xl font-bold mb-6"
          >
            From chaos to clarity in{' '}
            <span className="text-gradient">3 steps</span>
          </h2>
          <p 
            className="animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 ease-out text-lg text-muted-foreground"
            style={{ transitionDelay: '100ms' }}
          >
            No setup wizards. No data migration. Just connect and go.
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Connecting Line */}
            <div className="absolute left-8 md:left-[52px] top-0 bottom-0 w-px bg-gradient-to-b from-primary via-primary/50 to-transparent" />

            {steps.map((step, index) => (
              <div
                key={step.number}
                className="animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 ease-out relative flex gap-8 mb-16 last:mb-0"
                style={{ transitionDelay: `${200 + index * 150}ms` }}
              >
                {/* Step Number */}
                <div className="flex-shrink-0 w-16 h-16 md:w-[104px] md:h-[104px] rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow relative z-10">
                  <span className="text-xl md:text-2xl font-bold text-primary-foreground">{step.number}</span>
                </div>

                {/* Content */}
                <div className="flex-1 pt-2">
                  <h3 className="text-2xl md:text-3xl font-semibold mb-4 text-foreground">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                    {step.description}
                  </p>
                  
                  <div className="flex flex-wrap gap-3">
                    {step.highlights.map((highlight) => (
                      <div
                        key={highlight}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-sm text-secondary-foreground"
                      >
                        <Check className="w-4 h-4 text-primary" />
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

      <style>{`
        .animate-on-scroll.animate-visible {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
    </section>
  );
};

export default HowItWorks;
