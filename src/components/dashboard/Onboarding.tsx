import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, FolderOpen, CheckCircle2, ArrowRight, Loader2, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { PlanSelection } from "./PlanSelection";

interface OnboardingProps {
  onComplete: () => void;
  organizationId: string | null;
}

type Plan = "free" | "pro" | "enterprise";

export const Onboarding = ({ onComplete, organizationId }: OnboardingProps) => {
  const { user, session, requestDriveAccess } = useAuth();
  const { toast } = useToast();
  const { createFolder } = useGoogleDrive();
  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [driveConnected, setDriveConnected] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan>("free");

  // Check if Drive is already connected (has provider_token with drive scope)
  useEffect(() => {
    const checkDriveConnection = async () => {
      if (session?.provider_token) {
        // If we have a provider token, Drive might be connected
        // We can verify by checking if we can make a simple API call
        setDriveConnected(true);
      }
    };
    checkDriveConnection();
  }, [session]);

  const handlePlanSelect = (plan: Plan) => {
    setSelectedPlan(plan);
    setStep(2);
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
      // The page will redirect to Google for authorization
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
    if (!organizationId || !workspaceName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a workspace name.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      // Create root folder in Google Drive
      const folderName = `DocLayer - ${workspaceName}`;
      const folder = await createFolder(folderName, "root");

      if (!folder?.id) {
        throw new Error("Failed to create Google Drive folder. Make sure you've connected your Drive.");
      }

      // Update organization with root folder ID
      const { error } = await supabase
        .from("organizations")
        .update({ 
          drive_folder_id: folder.id,
          name: workspaceName 
        })
        .eq("id", organizationId);

      if (error) throw error;

      toast({
        title: "Workspace created!",
        description: "Your Google Drive folder is ready.",
      });

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

  const totalSteps = 4;

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

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s, i) => (
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
        <div className="flex justify-center gap-4 mb-8 text-xs text-muted-foreground">
          <span className={step >= 1 ? "text-primary" : ""}>Plan</span>
          <span className={step >= 2 ? "text-primary" : ""}>Welcome</span>
          <span className={step >= 3 ? "text-primary" : ""}>Connect Drive</span>
          <span className={step >= 4 ? "text-primary" : ""}>Workspace</span>
        </div>

        {/* Step Content */}
        <div className="glass rounded-2xl p-8">
          {step === 1 && (
            <PlanSelection onSelect={handlePlanSelect} />
          )}

          {step === 2 && (
            <div className="text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Welcome to DocLayer!</h2>
              <p className="text-muted-foreground mb-6">
                You're on the <span className="text-primary font-medium capitalize">{selectedPlan}</span> plan. 
                Next, let's connect your Google Drive to manage your documentation.
              </p>
              <div className="text-sm text-muted-foreground mb-6 p-4 rounded-lg bg-secondary/50">
                <p className="font-medium text-foreground mb-1">Signed in as:</p>
                <p>{user?.email}</p>
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
          )}

          {step === 3 && (
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
                    onClick={() => setStep(4)}
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
                    onClick={() => setStep(4)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Skip for now (you can connect later)
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
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

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Your documents stay in Google Drive. DocLayer adds structure and governance on top.
        </p>
      </div>
    </div>
  );
};
