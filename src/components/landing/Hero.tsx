import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useRef } from "react";

const Hero = () => {
  const navigate = useNavigate();
  const { user, profileOrganizationId, profileLoading } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);

  const needsOnboarding = !!user && !profileLoading && !profileOrganizationId;
  const dashboardCtaLabel = needsOnboarding ? "Complete Sign-Up" : "Go to Dashboard";

  // Smooth scroll reveal animation
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

    const elements = heroRef.current?.querySelectorAll('.animate-on-scroll');
    elements?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Animated Background */}
      <div className="absolute inset-0">
        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-[150px]" />
      </div>
      
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: '80px 80px'
        }}
      />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div 
            className="animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 ease-out inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
            style={{ transitionDelay: '100ms' }}
          >
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-muted-foreground">Built for Google Workspace</span>
          </div>

          {/* Headline */}
          <h1 
            className="animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 ease-out text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
            style={{ transitionDelay: '200ms' }}
          >
            Turn your Google Docs into{' '}
            <span className="text-gradient">trusted knowledge</span>
          </h1>

          {/* Subheadline */}
          <p 
            className="animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 ease-out text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-12"
            style={{ transitionDelay: '300ms' }}
          >
            The knowledge layer for Google Drive. Organize, govern, and publish your existing docs—without migration, uploads, or duplication.
          </p>

          {/* CTA Buttons */}
          <div 
            className="animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 ease-out flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            style={{ transitionDelay: '400ms' }}
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
                <Button variant="glass" size="xl" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="group">
                  See how it works
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </>
            )}
          </div>

          {/* Trust Signals */}
          <div 
            className="animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 ease-out flex flex-wrap items-center justify-center gap-8"
            style={{ transitionDelay: '500ms' }}
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4 text-primary" />
              <span>No data leaves Google Drive</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="w-4 h-4 text-primary" />
              <span>Setup in 60 seconds</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background to-transparent" />

      <style>{`
        .animate-on-scroll.animate-visible {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
    </section>
  );
};

export default Hero;
