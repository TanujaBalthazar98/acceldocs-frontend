import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, ArrowLeft, Loader2, Link2, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";

interface OnboardingProps {
  onComplete: () => void;
  organizationId: string | null;
}

const ACCELDATA_DOMAIN = "acceldata.io";
const ACCELDATA_WORKSPACE_NAME = "Acceldata";

export const Onboarding = ({ onComplete, organizationId }: OnboardingProps) => {
  const { user, session, requestDriveAccess } = useAuth();
  const { toast } = useToast();
  const { createFolder } = useGoogleDrive();
  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);

  // Check if Drive is already connected
  useEffect(() => {
    if (session?.provider_token) {
      setDriveConnected(true);
    }
  }, [session]);

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

  const findOrCreateAcceldataOrg = async () => {
    // Check if Acceldata org already exists
    const { data: existingOrg, error: orgError } = await supabase
      .from("organizations")
      .select("id, drive_folder_id")
      .eq("domain", ACCELDATA_DOMAIN)
      .maybeSingle();

    if (orgError && orgError.code !== "PGRST116") {
      throw orgError;
    }

    if (existingOrg) {
      return { orgId: existingOrg.id, isNewOrg: false, driveFolderId: existingOrg.drive_folder_id };
    }

    // Create the Acceldata organization (first user becomes owner)
    const { data: newOrg, error: createError } = await supabase
      .from("organizations")
      .insert({
        domain: ACCELDATA_DOMAIN,
        name: ACCELDATA_WORKSPACE_NAME,
        owner_id: user!.id,
      })
      .select("id")
      .single();

    if (createError) throw createError;

    return { orgId: newOrg.id, isNewOrg: true, driveFolderId: null };
  };

  const handleJoinAcceldata = async () => {
    if (!user) return;

    setIsCreating(true);
    try {
      const { orgId, isNewOrg, driveFolderId } = await findOrCreateAcceldataOrg();

      // Update user's profile to link to this org
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          email: user.email || "",
          organization_id: orgId,
          account_type: "team"
        }, { onConflict: "id" });

      if (profileError) throw profileError;

      // Add user role - owner if created, viewer otherwise
      const role = isNewOrg ? "owner" : "viewer";
      await supabase
        .from("user_roles")
        .upsert({
          user_id: user.id,
          organization_id: orgId,
          role: role,
        }, { onConflict: "user_id,organization_id" });

      // If this is a new org or Drive folder doesn't exist, try to create it
      if (isNewOrg && driveConnected && !driveFolderId) {
        const folderName = `Acceldocs - ${ACCELDATA_WORKSPACE_NAME}`;
        const folder = await createFolder(folderName, "root");

        if (folder?.id) {
          await supabase
            .from("organizations")
            .update({ drive_folder_id: folder.id })
            .eq("id", orgId);
        }
      }

      toast({
        title: isNewOrg ? "Workspace created!" : "Joined workspace!",
        description: isNewOrg 
          ? "You've created the Acceldata workspace." 
          : "You've joined the Acceldata workspace.",
      });

      onComplete();
    } catch (error: any) {
      console.error("Error joining Acceldata:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to join workspace. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        {/* Header */}
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
          <span className={step >= 3 ? "text-primary" : ""}>Workspace</span>
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
                Acceldata's internal documentation platform. Let's get you set up by connecting your Google Drive.
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
                Acceldocs needs access to create and manage folders in your Google Drive. Your files stay in your Drive.
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
                    <button
                      onClick={() => setStep(3)}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4"
                    >
                      Skip for now
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-center">Join Acceldata Workspace</h2>
              <p className="text-muted-foreground mb-6 text-center">
                You'll be joining the shared Acceldata workspace where all team documentation is managed.
              </p>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <span className="font-semibold text-lg">{ACCELDATA_WORKSPACE_NAME}</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    All Acceldata team members share this workspace
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
                    onClick={handleJoinAcceldata}
                    disabled={isCreating}
                    className="gap-2"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Setting up...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Complete Setup
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Your documents stay in Google Drive. Acceldocs adds structure and governance on top.
        </p>
      </div>
    </div>
  );
};
