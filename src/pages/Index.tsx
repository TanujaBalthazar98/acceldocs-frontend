import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuthNew";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  FileSpreadsheet,
  GitBranch,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    // If authenticated, go to dashboard.
    // If not authenticated, always stay on landing page.
    if (!loading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, loading, navigate]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Show landing page if not authenticated
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-16 right-0 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 md:px-6 py-10 md:py-16">
        <div className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-border bg-card p-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight">Knowledge Workspace</p>
              <p className="text-xs text-muted-foreground">Google Docs to Production Docs</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/login")}
          >
            Log In
          </Button>
        </div>

        <div className="rounded-2xl md:rounded-3xl border border-border bg-card/90 p-5 sm:p-8 shadow-xl backdrop-blur md:p-12">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm text-primary">
            <Sparkles className="h-4 w-4" />
            Google Docs to Production Docs
          </div>

          <h1 className="max-w-4xl text-3xl sm:text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
            Publish docs from <span className="text-primary">Google Drive</span> with structured approvals
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted-foreground">
            Keep writing in Google Docs. The platform handles ingestion, review workflow, and rendering for production docs.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:opacity-90"
              onClick={() => navigate("/signup")}
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/login")}
            >
              Continue to Login
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6">
            <Workflow className="mb-4 h-6 w-6 text-primary" />
            <h3 className="mb-2 text-xl font-semibold">Drive-Native Authoring</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Keep your folder hierarchy as source of truth, including project and version semantics.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <GitBranch className="mb-4 h-6 w-6 text-primary" />
            <h3 className="mb-2 text-xl font-semibold">Preview + Production Flow</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Route changes to preview branch at review stage and promote only approved pages to main.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <ShieldCheck className="mb-4 h-6 w-6 text-primary" />
            <h3 className="mb-2 text-xl font-semibold">Controlled Publishing</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              RBAC + approval checks keep accidental drafts out of rendered docs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
