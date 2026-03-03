import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, ArrowLeft, Loader2, Building2, Puzzle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { invokeFunction } from "@/lib/api/functions";

interface OnboardingProps {
  onComplete: () => void;
  organizationId: string | null;
}

const APP_NAME = "Docspeare";

const formatPersonalWorkspaceName = (email?: string | null, fullName?: string | null) => {
  const base = fullName?.trim() || email?.split("@")[0] || "Personal";
  const cleaned = base.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Personal Workspace";
  return cleaned.toLowerCase().includes("workspace") ? cleaned : `${cleaned} Workspace`;
};

export const Onboarding = ({ onComplete }: OnboardingProps) => {
  const { user, profileLoading, requestDriveAccess } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [isCheckingOrg, setIsCheckingOrg] = useState(true);

  const workspaceDomain = (() => {
    const email = user?.email?.toLowerCase().trim();
    if (!email) return null;
    const domain = email.split("@")[1]?.trim();
    return domain || email;
  })();
  const workspaceName = formatPersonalWorkspaceName(user?.email || null, user?.user_metadata?.full_name || null);

  useEffect(() => {
    const checkOrganization = async () => {
      if (!user) return;
      if (profileLoading) {
        setIsCheckingOrg(true);
        return;
      }

      try {
        const { data: orgRes } = await invokeFunction<{
          ok?: boolean;
          members?: Array<{ id?: string | number; role?: string }>;
        }>("get-organization");
        const role =
          orgRes?.members?.find((member) => String(member?.id) === String(user.id))?.role || null;
        if (role) {
          onComplete();
          return;
        }
      } catch (err) {
        console.error("Error during org check:", err);
      } finally {
        setIsCheckingOrg(false);
      }
    };

    checkOrganization();
  }, [user, profileLoading, onComplete]);

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!user) return;

    setIsCreating(true);
    try {
      if (!workspaceDomain) {
        throw new Error("Missing workspace identifier for creation.");
      }

      const { data, error } = await invokeFunction("ensure-workspace", {
        body: {
          domain: workspaceDomain,
          name: workspaceName,
        },
      });

      const resolvedOrgId =
        data?.organizationId ??
        data?.organization?.id ??
        data?.id ??
        null;
      if (error || !data?.ok || !resolvedOrgId) {
        throw error || new Error(data?.error || "Failed to ensure workspace");
      }

      if (data.existed) {
        toast({
          title: "Workspace ready",
          description: "You're all set to connect Drive.",
        });
      } else {
        toast({
          title: "Workspace created!",
          description: "You've created the workspace and are now the owner.",
        });
      }

      setStep(3);
    } catch (error: any) {
      console.error("Error creating workspace:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create workspace. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleConnectDrive = async () => {
    setIsConnectingDrive(true);
    try {
      const { error } = await requestDriveAccess();
      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error("Error connecting Drive:", error);
      toast({
        title: "Drive connection failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      setIsConnectingDrive(false);
    }
  };

  if (isCheckingOrg) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking workspace status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <h1 className="text-3xl font-bold text-center mb-8 text-foreground">{APP_NAME}</h1>

        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  step >= s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
              </div>
              {i < 2 && <div className={`w-8 h-0.5 mx-1 ${step > s ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-6 mb-8 text-xs text-muted-foreground">
          <span className={step >= 1 ? "text-primary" : ""}>Welcome</span>
          <span className={step >= 2 ? "text-primary" : ""}>Create Workspace</span>
          <span className={step >= 3 ? "text-primary" : ""}>Connect Drive</span>
        </div>

        <div className="glass rounded-2xl p-8">
          {step === 1 && (
            <div className="text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Welcome to {APP_NAME}!</h2>
              <p className="text-muted-foreground mb-6">
                Create your workspace, then connect Google Drive so Docspeare can sync and publish your docs.
              </p>
              <Button variant="hero" size="lg" onClick={() => setStep(2)} className="gap-2">
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-center">Create {workspaceName}</h2>
              <p className="text-muted-foreground mb-6 text-center">
                You'll be the owner of this workspace. Invite teammates after setup.
              </p>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <span className="font-semibold text-lg">{workspaceName}</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    Docs are edited in Google Docs and published into Docspeare.
                  </p>
                </div>

                <div className="flex gap-3 justify-center">
                  <Button variant="outline" size="lg" onClick={handleBack} className="gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>
                  <Button
                    variant="hero"
                    size="lg"
                    onClick={handleCreateWorkspace}
                    disabled={isCreating}
                    className="gap-2"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Create Workspace
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Puzzle className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Connect Google Drive</h2>
              <p className="text-muted-foreground mb-6">
                Docspeare stores source documents in Google Drive. Connect Drive once to enable syncing,
                publishing, and team access controls.
              </p>
              <div className="space-y-3">
                <Button
                  variant="hero"
                  size="lg"
                  onClick={handleConnectDrive}
                  className="w-full gap-2"
                  disabled={isConnectingDrive}
                >
                  {isConnectingDrive ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      Connect Google Drive
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
                <Button variant="outline" size="lg" onClick={onComplete} className="w-full gap-2">
                  Continue to Docspeare
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="lg" onClick={handleBack} className="w-full gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Docs are stored in Google Drive. {APP_NAME} keeps an encrypted cache for fast reads and publishing.
        </p>
      </div>
    </div>
  );
};
