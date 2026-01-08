import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, ArrowLeft, Loader2, Link2, Building2, Clock, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";

interface OnboardingProps {
  onComplete: () => void;
  organizationId: string | null;
}

const ACCELDATA_DOMAIN = "acceldata.io";
const ACCELDATA_WORKSPACE_NAME = "Acceldata";

type OnboardingMode = "first_user" | "join_existing" | "pending_request";

export const Onboarding = ({ onComplete, organizationId }: OnboardingProps) => {
  const { user, session, requestDriveAccess } = useAuth();
  const { toast } = useToast();
  const { createFolder } = useGoogleDrive();
  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode | null>(null);
  const [isCheckingOrg, setIsCheckingOrg] = useState(true);
  const [existingOrgId, setExistingOrgId] = useState<string | null>(null);

  // Check if Drive is already connected
  useEffect(() => {
    if (session?.provider_token) {
      setDriveConnected(true);
    }
  }, [session]);

  // Determine onboarding mode based on whether Acceldata org exists
  useEffect(() => {
    const checkAcceldataOrg = async () => {
      if (!user) return;

      try {
        // First check if user already has a pending join request (they can see their own requests)
        const { data: pendingRequest } = await supabase
          .from("join_requests")
          .select("id, status, organization_id")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .maybeSingle();

        if (pendingRequest) {
          setExistingOrgId(pendingRequest.organization_id);
          setOnboardingMode("pending_request");
          setIsCheckingOrg(false);
          return;
        }

        // Try to check if Acceldata org exists using RLS-visible query
        // This query works because of "Users can view organizations by domain" policy
        const { data: existingOrg, error } = await supabase
          .from("organizations")
          .select("id, drive_folder_id")
          .eq("domain", ACCELDATA_DOMAIN)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          console.error("Error checking org:", error);
        }

        if (existingOrg) {
          setExistingOrgId(existingOrg.id);
          setOnboardingMode("join_existing");
        } else {
          // No org found via RLS - this user will be the first/owner
          setOnboardingMode("first_user");
        }
      } catch (err) {
        console.error("Error during org check:", err);
        // Default to join_existing to avoid duplicate creation errors
        setOnboardingMode("join_existing");
      } finally {
        setIsCheckingOrg(false);
      }
    };

    checkAcceldataOrg();
  }, [user]);

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleConnectDrive = async () => {
    setIsConnecting(true);
    try {
      const { error } = await requestDriveAccess();
      if (error) {
        toast({
          title: "Error",
          description: "Failed to connect Google Drive. Please try again.",
          variant: "destructive",
        });
        setIsConnecting(false);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to connect Google Drive.",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!user) return;

    setIsCreating(true);
    try {
      // Create the Acceldata organization (this user becomes owner)
      const { data: newOrg, error: createError } = await supabase
        .from("organizations")
        .insert({
          domain: ACCELDATA_DOMAIN,
          name: ACCELDATA_WORKSPACE_NAME,
          owner_id: user.id,
        })
        .select("id")
        .single();

      if (createError) throw createError;

      // Update user's profile to link to this org
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          email: user.email || "",
          organization_id: newOrg.id,
          account_type: "team"
        }, { onConflict: "id" });

      if (profileError) throw profileError;

      // Add user as owner
      await supabase
        .from("user_roles")
        .upsert({
          user_id: user.id,
          organization_id: newOrg.id,
          role: "owner",
        }, { onConflict: "user_id,organization_id" });

      // Create Drive folder if connected
      if (driveConnected) {
        const folderName = `Acceldocs - ${ACCELDATA_WORKSPACE_NAME}`;
        const folder = await createFolder(folderName, "root");

        if (folder?.id) {
          await supabase
            .from("organizations")
            .update({ drive_folder_id: folder.id })
            .eq("id", newOrg.id);
        }
      }

      toast({
        title: "Workspace created!",
        description: "You've created the Acceldata workspace and are now the owner.",
      });

      onComplete();
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

  const handleRequestAccess = async () => {
    if (!user || !existingOrgId) return;

    setIsCreating(true);
    try {
      // Create a join request
      const { error } = await supabase
        .from("join_requests")
        .insert({
          user_id: user.id,
          organization_id: existingOrgId,
          user_email: user.email || "",
          user_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "",
          status: "pending",
        });

      if (error) throw error;

      toast({
        title: "Access requested",
        description: "Your request has been sent to workspace admins for approval.",
      });

      setOnboardingMode("pending_request");
    } catch (error: any) {
      console.error("Error requesting access:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to request access. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Show loading while checking org status
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

  // Pending request screen
  if (onboardingMode === "pending_request") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold mb-8 text-foreground">Acceldocs</h1>
          <div className="glass rounded-2xl p-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-6">
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Access Request Pending</h2>
            <p className="text-muted-foreground mb-6">
              Your request to join the Acceldata workspace has been submitted. A workspace admin will review your request shortly.
            </p>
            <div className="p-4 rounded-lg bg-secondary/50 mb-6">
              <p className="text-sm text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{user?.email}</span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              You'll be notified once your request is approved.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Join existing workspace screen (request access)
  if (onboardingMode === "join_existing") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold mb-8 text-foreground">Acceldocs</h1>
          <div className="glass rounded-2xl p-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <UserPlus className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Request Workspace Access</h2>
            <p className="text-muted-foreground mb-6">
              The Acceldata workspace already exists. Request access to join your team's documentation.
            </p>
            <div className="p-4 rounded-lg bg-secondary/50 mb-6">
              <span className="font-semibold text-lg">{ACCELDATA_WORKSPACE_NAME}</span>
              <p className="text-xs text-muted-foreground mt-1">
                Internal documentation workspace
              </p>
            </div>
            <Button 
              variant="hero" 
              size="lg" 
              onClick={handleRequestAccess}
              disabled={isCreating}
              className="w-full gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Requesting...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Request Access
                </>
              )}
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-6">
            A workspace admin will review and approve your request.
          </p>
        </div>
      </div>
    );
  }

  // First user flow - create workspace with Drive connection
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <h1 className="text-3xl font-bold text-center mb-8 text-foreground">Acceldocs</h1>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                step >= s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}>
                {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
              </div>
              {i < 2 && (
                <div className={`w-8 h-0.5 mx-1 ${step > s ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Labels */}
        <div className="flex justify-center gap-6 mb-8 text-xs text-muted-foreground">
          <span className={step >= 1 ? "text-primary" : ""}>Welcome</span>
          <span className={step >= 2 ? "text-primary" : ""}>Connect Drive</span>
          <span className={step >= 3 ? "text-primary" : ""}>Create Workspace</span>
        </div>

        {/* Step Content */}
        <div className="glass rounded-2xl p-8">
          {step === 1 && (
            <div className="text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Welcome to Acceldocs!</h2>
              <p className="text-muted-foreground mb-6">
                You're the first Acceldata user! Let's set up the workspace by connecting your Google Drive, which will serve as the root storage for all team documentation.
              </p>
              <Button 
                variant="hero" 
                size="lg" 
                onClick={() => setStep(2)}
                className="gap-2"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Link2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Connect Google Drive</h2>
              <p className="text-muted-foreground mb-6">
                Your Google Drive will become the root storage for Acceldocs. All team members will access documentation through this shared drive.
              </p>

              {driveConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Google Drive connected!</span>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <Button 
                      variant="outline" 
                      size="lg" 
                      onClick={handleBack}
                      className="gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </Button>
                    <Button 
                      variant="hero" 
                      size="lg" 
                      onClick={() => setStep(3)}
                      className="gap-2"
                    >
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Button 
                    variant="hero" 
                    size="lg" 
                    onClick={handleConnectDrive}
                    disabled={isConnecting}
                    className="w-full gap-3"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                          <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                          <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                          <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 13.25z" fill="#ea4335"/>
                          <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                          <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                          <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                        </svg>
                        Connect Google Drive
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={handleBack}
                    className="gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-center">Create Acceldata Workspace</h2>
              <p className="text-muted-foreground mb-6 text-center">
                You'll be the owner of this workspace. Other Acceldata team members will need your approval to join.
              </p>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <span className="font-semibold text-lg">{ACCELDATA_WORKSPACE_NAME}</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your Google Drive will be the root storage
                  </p>
                </div>

                <div className="flex gap-3 justify-center">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={handleBack}
                    className="gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>
                  <Button 
                    variant="hero" 
                    size="lg" 
                    onClick={handleCreateWorkspace}
                    disabled={isCreating || !driveConnected}
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
                
                {!driveConnected && (
                  <p className="text-xs text-center text-amber-500">
                    Please connect Google Drive first to create the workspace.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Your documents stay in Google Drive. Acceldocs adds structure and governance on top.
        </p>
      </div>
    </div>
  );
};
