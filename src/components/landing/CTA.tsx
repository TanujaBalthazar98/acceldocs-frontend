import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useRef } from "react";

const CTA = () => {
  const navigate = useNavigate();
  const { user, profileOrganizationId, profileLoading } = useAuth();
  const sectionRef = useRef<HTMLDivElement>(null);

  const needsOnboarding = !!user && !profileLoading && !profileOrganizationId;
  const dashboardCtaLabel = needsOnboarding ? "Complete Sign-Up" : "Go to Dashboard";

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = sectionRef.current?.querySelectorAll('.animate-on-scroll');
    elements?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-32 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[150px]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 
            className="animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 ease-out text-3xl sm:text-4xl md:text-5xl font-bold mb-6"
          >
            Ready to trust your{' '}
            <span className="text-gradient">Google Docs</span>?
          </h2>
          <p 
            className="animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 ease-out text-lg text-muted-foreground mb-12 max-w-xl mx-auto"
            style={{ transitionDelay: '100ms' }}
          >
            Stop wondering which doc is the source of truth. Start with a single click.
          </p>

          <div 
            className="animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 ease-out flex flex-col sm:flex-row items-center justify-center gap-4"
            style={{ transitionDelay: '200ms' }}
          >
            {user ? (
              <Button variant="hero" size="xl" onClick={() => navigate("/dashboard")} className="group">
                {dashboardCtaLabel}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            ) : (
              <>
                <Button variant="hero" size="xl" onClick={() => navigate("/auth")} className="group">
                  Get Started
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
                <Button variant="glass" size="xl" onClick={() => navigate("/auth")} className="group">
                  Book a demo
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </>
            )}
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

export default CTA;
