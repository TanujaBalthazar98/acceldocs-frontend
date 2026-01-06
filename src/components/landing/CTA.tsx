import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";


const CTA = () => {
  const navigate = useNavigate();
  const { user, profileOrganizationId, profileLoading } = useAuth();

  const needsOnboarding = !!user && !profileLoading && !profileOrganizationId;
  const dashboardCtaLabel = needsOnboarding ? "Complete Sign-Up" : "Go to Dashboard";
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-glow opacity-40" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Ready to trust your{' '}
            <span className="text-gradient">Google Docs</span>?
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            Stop wondering which doc is the source of truth. Start with a single click.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {user ? (
              <Button variant="hero" size="xl" onClick={() => navigate("/dashboard")}>
                {dashboardCtaLabel}
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <>
                <Button variant="hero" size="xl" onClick={() => navigate("/auth")}>
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button variant="glass" size="xl" onClick={() => navigate("/auth")}>
                  Book a demo
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            Free for teams up to 5 people. No credit card required.
          </p>
        </div>
      </div>
    </section>
  );
};

export default CTA;
