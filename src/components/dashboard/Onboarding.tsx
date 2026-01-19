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

type OnboardingMode = "first_user" | "join_existing" | "pending_request";

const APP_NAME = "Docspeare";

const getEmailDomain = (email?: string | null) => {
  return email?.split("@")[1]?.toLowerCase().trim() || null;
};

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.co.uk",
  "ymail.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "tutanota.com",
  "zoho.com",
  "mail.com",
  "gmx.com",
  "gmx.net",
]);

const isPersonalEmailDomain = (domain?: string | null) => {
  if (!domain) return false;
  return PERSONAL_EMAIL_DOMAINS.has(domain);
};

const formatWorkspaceName = (domain?: string | null) => {
  if (!domain) return "Workspace";
  const base = domain.split(".")[0] || domain;
  return base
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatPersonalWorkspaceName = (email?: string | null, fullName?: string | null) => {
  const base = fullName?.trim() || email?.split("@")[0] || "Personal";
  const cleaned = base.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Personal Workspace";
  return cleaned.toLowerCase().includes("workspace") ? cleaned : `${cleaned} Workspace`;
};

export const Onboarding = ({ onComplete, organizationId }: OnboardingProps) => {
  const { user, session, requestDriveAccess, profileLoading } = useAuth();
  const { toast } = useToast();
  const { createFolder } = useGoogleDrive();
  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode | null>(null);
  const [isCheckingOrg, setIsCheckingOrg] = useState(true);
  const [existingOrgId, setExistingOrgId] = useState<string | null>(null);
  const [existingOrgName, setExistingOrgName] = useState<string | null>(null);
  const emailDomain = getEmailDomain(user?.email);
  const isPersonalDomain = isPersonalEmailDomain(emailDomain);
  const workspaceDomain = isPersonalDomain ? user?.email?.toLowerCase().trim() || null : emailDomain;
  const workspaceName =
    existingOrgName?.trim() ||
    (isPersonalDomain
      ? formatPersonalWorkspaceName(user?.email || null, user?.user_metadata?.full_name || null)
      : formatWorkspaceName(emailDomain));

  const pendingRequestStorageKey = user?.id ? `pending_join_request:${user.id}` : null;
  const getPendingRequestOrgId = () => {
    if (!pendingRequestStorageKey || typeof sessionStorage === "undefined") return null;
    return sessionStorage.getItem(pendingRequestStorageKey);
  };
  const setPendingRequestOrgId = (orgId: string) => {
    if (!pendingRequestStorageKey || typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(pendingRequestStorageKey, orgId);
  };
  const clearPendingRequestOrgId = () => {
    if (!pendingRequestStorageKey || typeof sessionStorage === "undefined") return;
    sessionStorage.removeItem(pendingRequestStorageKey);
  };

  // Check if Drive is already connected
  useEffect(() => {
    if (session?.provider_token) {
      setDriveConnected(true);
    }
  }, [session]);

  // Determine onboarding mode based on whether the user's org exists
  useEffect(() => {
    const checkOrganization = async () => {
      if (!user) return;
      if (profileLoading) {
        setIsCheckingOrg(true);
        return;
      }

      try {
        if (!emailDomain && !user?.email) {
          console.error("Missing email domain for onboarding");
          setOnboardingMode("first_user");
          setIsCheckingOrg(false);
          return;
        }

        // First check if user already has an org role (they're already a member)
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("id, organization_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (existingRole) {
          // User is already a member - complete onboarding immediately
          console.log("User already has org role, completing onboarding");
          clearPendingRequestOrgId();
          setIsCheckingOrg(false);
          onComplete();
          return;
        }

        const storedPendingOrgId = getPendingRequestOrgId();

        // Check if user already has a pending join request (they can see their own requests)
        const { data: pendingRequest } = await supabase
          .from("join_requests")
          .select("id, status, organization_id")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .maybeSingle();

        if (pendingRequest) {
          setExistingOrgId(pendingRequest.organization_id);
          setPendingRequestOrgId(pendingRequest.organization_id);
          setOnboardingMode("pending_request");
          setIsCheckingOrg(false);
          return;
        }

        if (storedPendingOrgId && !isPersonalDomain) {
          setExistingOrgId(storedPendingOrgId);
          setOnboardingMode("pending_request");
          setIsCheckingOrg(false);
          return;
        }

        if (isPersonalDomain) {
          setOnboardingMode("first_user");
          setIsCheckingOrg(false);
          return;
        }

        // Try to check if org exists using RLS-visible query
        // This query works because of "Users can view organizations by domain" policy
        const { data: existingOrg, error } = await supabase
          .from("organizations")
          .select("id, name, drive_folder_id")
          .eq("domain", emailDomain)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          console.error("Error checking org:", error);
        }

        if (existingOrg) {
          setExistingOrgId(existingOrg.id);
          setExistingOrgName(existingOrg.name ?? null);
          setOnboardingMode("join_existing");
        } else {
          clearPendingRequestOrgId();
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

    checkOrganization();
  }, [user, onComplete, emailDomain, isPersonalDomain, profileLoading]);

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
      if (!workspaceDomain) {
        throw new Error("Missing workspace identifier for creation.");
      }

      // Create (or fetch) the workspace in an idempotent way.
      // This avoids "duplicate key" errors if the org already exists but isn't RLS-visible here.
      const { data, error } = await supabase.functions.invoke("ensure-workspace", {
        body: {
          domain: workspaceDomain,
          name: workspaceName,
        },
      });

      if (error || !data?.ok || !data?.organizationId) {
        throw error || new Error(data?.error || "Failed to ensure workspace");
      }

      // If it already existed, switch the user into the request-access flow.
      if (data.existed) {
        if (isPersonalDomain) {
          toast({
            title: "Workspace ready",
            description: "Your personal workspace is ready to use.",
          });
          onComplete();
          return;
        }

        setExistingOrgId(data.organizationId);
        setOnboardingMode("join_existing");
        toast({
          title: "Workspace already exists",
          description: "Request access to join the existing workspace.",
        });
        return;
      }

      // Create Drive folder if connected, then store folder id (without overwriting if already set).
      if (driveConnected) {
        const folderName = `${APP_NAME} - ${workspaceName}`;
        const folder = await createFolder(folderName, "root");

        if (folder?.id) {
          await supabase.functions.invoke("ensure-workspace", {
            body: {
              domain: workspaceDomain,
              driveFolderId: folder.id,
            },
          });
        }
      }

      toast({
        title: "Workspace created!",
        description: "You've created the workspace and are now the owner.",
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

      setPendingRequestOrgId(existingOrgId);
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
          <h1 className="text-3xl font-bold mb-8 text-foreground">{APP_NAME}</h1>
          <div className="glass rounded-2xl p-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-6">
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Access Request Pending</h2>
            <p className="text-muted-foreground mb-6">
              Your request to join the {workspaceName} workspace has been submitted. A workspace admin will review your request shortly.
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
          <h1 className="text-3xl font-bold mb-8 text-foreground">{APP_NAME}</h1>
          <div className="glass rounded-2xl p-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <UserPlus className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Request Workspace Access</h2>
            <p className="text-muted-foreground mb-6">
              The {workspaceName} workspace already exists. Request access to join your team's documentation.
            </p>
            <div className="p-4 rounded-lg bg-secondary/50 mb-6">
              <span className="font-semibold text-lg">{workspaceName}</span>
              <p className="text-xs text-muted-foreground mt-1">
                Documentation workspace
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
        <h1 className="text-3xl font-bold text-center mb-8 text-foreground">{APP_NAME}</h1>

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
              <h2 className="text-2xl font-bold mb-3">Welcome to {APP_NAME}!</h2>
              <p className="text-muted-foreground mb-6">
                You're the first member of {workspaceName}! Let's set up the workspace by connecting your Google Drive, which will serve as the root storage for all team documentation.
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
                Your Google Drive will become the root storage for {APP_NAME}. All team members will access documentation through this shared drive.
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
              <h2 className="text-2xl font-bold mb-3 text-center">Create {workspaceName} Workspace</h2>
              <p className="text-muted-foreground mb-6 text-center">
                You'll be the owner of this workspace. Other team members will need your approval to join.
              </p>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <span className="font-semibold text-lg">{workspaceName}</span>
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
          Your documents stay in Google Drive. {APP_NAME} adds structure and governance on top.
        </p>
      </div>
    </div>
  );
};
