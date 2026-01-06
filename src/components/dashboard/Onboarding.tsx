import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, FolderOpen, CheckCircle2, ArrowRight, Loader2, Link2, Users, Building2, Clock, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";

interface OnboardingProps {
  onComplete: () => void;
  organizationId: string | null;
}

interface ExistingOrg {
  id: string;
  name: string;
  domain: string;
}

const PERSONAL_DOMAINS = ["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", 
  "msn.com", "yahoo.com", "yahoo.co.uk", "ymail.com", "aol.com", 
  "icloud.com", "me.com", "mac.com", "protonmail.com", "proton.me",
  "tutanota.com", "zoho.com", "mail.com", "gmx.com", "gmx.net"];

export const Onboarding = ({ onComplete, organizationId }: OnboardingProps) => {
  const { user, session, requestDriveAccess } = useAuth();
  const { toast } = useToast();
  const { createFolder } = useGoogleDrive();
  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [driveConnected, setDriveConnected] = useState(false);
  const [existingOrg, setExistingOrg] = useState<ExistingOrg | null>(null);
  const [joinChoice, setJoinChoice] = useState<"join" | "create" | null>(null);
  const [pendingRequest, setPendingRequest] = useState<{ id: string; status: string } | null>(null);
  const [requestSent, setRequestSent] = useState(false);

  // Check if Drive is already connected, existing org, and pending requests
  useEffect(() => {
    const checkInitialState = async () => {
      if (session?.provider_token) {
        setDriveConnected(true);
      }

      if (!user?.email) return;

      const emailDomain = user.email.split("@")[1]?.trim().toLowerCase();
      if (!emailDomain || PERSONAL_DOMAINS.includes(emailDomain)) return;

      // Check for existing org with same domain (for business emails)
      const { data: orgByDomain, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, domain")
        .ilike("domain", emailDomain)
        .maybeSingle();

      if (orgError) {
        console.warn("Failed to check existing org by domain:", orgError);
      }

      if (orgByDomain) {
        setExistingOrg(orgByDomain);

        // Check if user already has a pending/rejected request
        const { data: existingRequest } = await supabase
          .from("join_requests")
          .select("id, status")
          .eq("organization_id", orgByDomain.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (existingRequest) {
          setPendingRequest(existingRequest);
        }
      }
    };
    checkInitialState();
  }, [session, user]);

  const handleRequestToJoin = async () => {
    if (!existingOrg || !user) return;
    
    setIsJoining(true);
    try {
      // Create a join request (not auto-join)
      const { data: request, error: requestError } = await supabase
        .from("join_requests")
        .insert({
          organization_id: existingOrg.id,
          user_id: user.id,
          user_email: user.email || "",
          user_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "",
        })
        .select("id, status")
        .single();

      if (requestError) {
        if (requestError.code === "23505") {
          // Duplicate - request already exists
          toast({
            title: "Request already sent",
            description: "You have already requested to join this workspace.",
          });
        } else {
          throw requestError;
        }
      } else {
        setPendingRequest(request);
        setRequestSent(true);
        toast({
          title: "Request sent!",
          description: `Your request to join ${existingOrg.name} has been sent to the admins.`,
        });
      }
    } catch (error: any) {
      console.error("Error requesting to join:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
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

  const handleCreateRootFolder = async () => {
    if (!workspaceName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a workspace name.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      let orgId = organizationId;

      // If no organization exists (individual user), create one
      if (!orgId && user) {
        const emailDomain = user.email?.split("@")[1] || "personal";
        const isPersonalEmail = PERSONAL_DOMAINS.includes(emailDomain.toLowerCase());
        
        // Check if org already exists for this user first
        const { data: existingOrgByOwner } = await supabase
          .from("organizations")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();
        
        if (existingOrgByOwner) {
          orgId = existingOrgByOwner.id;
        } else {
          // For personal emails, always use unique domain. 
          // For business, use domain if unique, else add suffix
          let domain: string;
          
          if (isPersonalEmail) {
            domain = `personal-${user.id}`;
          } else {
            // User chose to create new org (existingOrg scenario handled by joinChoice)
            // Check if domain already taken
            const { data: domainTaken } = await supabase
              .from("organizations")
              .select("id")
              .eq("domain", emailDomain)
              .maybeSingle();
            
            domain = domainTaken ? `${emailDomain}-${user.id.substring(0, 8)}` : emailDomain;
          }
          
          const { data: newOrg, error: orgError } = await supabase
            .from("organizations")
            .insert({
              domain: domain,
              name: workspaceName,
              owner_id: user.id,
            })
            .select("id")
            .single();

          if (orgError) throw orgError;
          orgId = newOrg.id;
        }

        // Upsert user's profile with the organization
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({ 
            id: user.id,
            email: user.email || "",
            organization_id: orgId,
            account_type: "individual"
          }, { onConflict: "id" });

        if (profileError) throw profileError;

        // Add owner role
        await supabase
          .from("user_roles")
          .upsert({
            user_id: user.id,
            organization_id: orgId,
            role: "owner",
          }, { onConflict: "user_id,organization_id" });
      }

      if (!orgId) {
        throw new Error("Could not create or find organization.");
      }

      // Try to create root folder in Google Drive (optional - can be done later)
      const folderName = `DocLayer - ${workspaceName}`;
      const folder = await createFolder(folderName, "root");

      if (folder?.id) {
        // Update organization with root folder ID
        const { error } = await supabase
          .from("organizations")
          .update({ 
            drive_folder_id: folder.id,
            name: workspaceName 
          })
          .eq("id", orgId);

        if (error) throw error;

        toast({
          title: "Workspace created!",
          description: "Your Google Drive folder is ready.",
        });
      } else {
        // No Drive folder created - update just the name
        const { error } = await supabase
          .from("organizations")
          .update({ name: workspaceName })
          .eq("id", orgId);

        if (error) throw error;

        toast({
          title: "Workspace created!",
          description: "Drive folder wasn't created. You can connect Google Drive later in settings.",
        });
      }

      onComplete();
    } catch (error: any) {
      console.error("Error creating root folder:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create workspace. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const totalSteps = existingOrg && !joinChoice ? 1 : 3;
  const displayStep = existingOrg && !joinChoice ? 0 : step;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <FileText className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-foreground">DocLayer</span>
        </div>

        {/* Show join/create choice for users with existing org domain */}
        {existingOrg && !joinChoice ? (
          <div className="glass rounded-2xl p-8">
            <div className="text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-3">We found your team!</h2>
              <p className="text-muted-foreground mb-6">
                <span className="font-medium text-foreground">{existingOrg.name}</span> already has a workspace on DocLayer.
              </p>
              
              {/* Show status badge if request exists */}
              {(pendingRequest?.status === 'pending' || requestSent) && (
                <div className="flex items-center justify-center gap-2 mb-6 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span className="text-sm text-amber-600 dark:text-amber-400">
                    Join request pending admin approval
                  </span>
                </div>
              )}
              
              {pendingRequest?.status === 'rejected' && (
                <div className="flex items-center justify-center gap-2 mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <Building2 className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-destructive">
                    Your join request was declined
                  </span>
                </div>
              )}
              
              <div className="space-y-3">
                {/* Show request button only if no pending/approved request */}
                {!pendingRequest && !requestSent && (
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={handleRequestToJoin}
                    disabled={isJoining}
                    className="w-full gap-2"
                  >
                    {isJoining ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending request...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Request to join {existingOrg.name}
                      </>
                    )}
                  </Button>
                )}
                
                <Button 
                  variant="hero" 
                  size="lg" 
                  onClick={() => {
                    setJoinChoice("create");
                    setStep(1);
                  }}
                  className="w-full gap-2"
                >
                  <ArrowRight className="w-4 h-4" />
                  Continue with my own workspace
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground mt-6">
                {pendingRequest?.status === 'pending' || requestSent 
                  ? `You'll be notified when an admin approves your request. Meanwhile, you can set up your own workspace.`
                  : `You can request to join ${existingOrg.name} or create your own separate workspace.`
                }
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {[1, 2, 3].map((s, i) => (
                <div key={s} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    step >= s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  }`}>
                    {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
                  </div>
                  {i < totalSteps - 1 && (
                    <div className={`w-8 h-0.5 mx-1 ${step > s ? "bg-primary" : "bg-border"}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step Labels */}
            <div className="flex justify-center gap-6 mb-8 text-xs text-muted-foreground">
              <span className={step >= 1 ? "text-primary" : ""}>Welcome</span>
              <span className={step >= 2 ? "text-primary" : ""}>Connect Drive</span>
              <span className={step >= 3 ? "text-primary" : ""}>Workspace</span>
            </div>

            {/* Step Content */}
            <div className="glass rounded-2xl p-8">
              {step === 1 && (
                <div className="text-center max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold mb-3">Welcome to DocLayer!</h2>
                  <p className="text-muted-foreground mb-6">
                    Let's get you set up. First, we'll connect your Google Drive to manage your documentation.
                  </p>
                  <div className="text-sm text-muted-foreground mb-6 p-4 rounded-lg bg-secondary/50">
                    <p className="font-medium text-foreground mb-1">Signed in as:</p>
                    <p>{user?.email}</p>
                  </div>
                  <Button 
                    variant="hero" 
                    size="lg" 
                    onClick={() => setStep(2)}
                    className="gap-2"
                  >
                    Continue
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
                DocLayer needs access to create and manage folders in your Google Drive. Your files stay in your Drive.
              </p>

                {driveConnected ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-2 text-primary">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium">Google Drive connected!</span>
                    </div>
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
                    <button
                      onClick={() => setStep(3)}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Skip for now (you can connect later)
                    </button>
                  </div>
                )}
              </div>
            )}

              {step === 3 && (
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <FolderOpen className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-center">Create Your Workspace</h2>
              <p className="text-muted-foreground mb-6 text-center">
                We'll create a root folder in your Google Drive to store all your documentation.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="workspace-name">Workspace Name</Label>
                  <Input
                    id="workspace-name"
                    placeholder="My Company"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    disabled={isCreating}
                  />
                  <p className="text-xs text-muted-foreground">
                    A folder named "DocLayer - {workspaceName || 'Your Name'}" will be created in your Google Drive.
                  </p>
                </div>

                <Button 
                  variant="hero" 
                  size="lg" 
                  onClick={handleCreateRootFolder}
                  disabled={isCreating || !workspaceName.trim()}
                  className="w-full gap-2"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <FolderOpen className="w-4 h-4" />
                      Create Workspace
                    </>
                  )}
                  </Button>
                </div>
              </div>
            )}
            </div>
          </>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Your documents stay in Google Drive. DocLayer adds structure and governance on top.
        </p>
      </div>
    </div>
  );
};
