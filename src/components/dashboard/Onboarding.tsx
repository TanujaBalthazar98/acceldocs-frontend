import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ArrowRight, ArrowLeft, Loader2, Building2, FolderOpen } from "lucide-react";
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

export const Onboarding = ({ onComplete, organizationId }: OnboardingProps) => {
  const { user, profileLoading, requestDriveAccess } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [isCheckingOrg, setIsCheckingOrg] = useState(true);
  const [driveFolderId, setDriveFolderId] = useState("");

  // If workspace already exists (login auto-created it), skip straight to Drive folder setup
  const [workspaceExists, setWorkspaceExists] = useState(false);

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
          drive_folder_id?: string;
          members?: Array<{ id?: string | number; role?: string }>;
        }>("get-organization");
        const role =
          orgRes?.members?.find((member) => String(member?.id) === String(user.id))?.role || null;

        if (role && orgRes?.drive_folder_id) {
          // Workspace exists AND has Drive folder — skip onboarding entirely
          onComplete();
          return;
        }

        if (role) {
          // Workspace exists but no Drive folder — skip to Drive folder setup
          setWorkspaceExists(true);
          setStep(3);
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
          description: "Now let's connect your Google Drive folder.",
        });
      } else {
        toast({
          title: "Workspace created!",
          description: "You're the owner. Now connect your Google Drive folder.",
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

  const handleSaveDriveFolder = async () => {
    const folderId = driveFolderId.trim();
    if (!folderId) {
      toast({
        title: "Folder ID required",
        description: "Please enter your Google Drive root folder ID.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingFolder(true);
    try {
      // Save the Drive folder ID to the organization
      const attempts = [
        { organizationId, data: { drive_folder_id: folderId } },
        { id: organizationId, drive_folder_id: folderId },
        { organizationId, drive_folder_id: folderId },
      ];

      let saved = false;
      let finalError: Error | null = null;
      for (const body of attempts) {
        const { data: updated, error } = await invokeFunction<{ ok?: boolean; error?: string }>(
          "update-organization",
          { body }
        );
        if (!error && updated?.ok !== false) {
          saved = true;
          break;
        }
        finalError = error || new Error(updated?.error || "Could not update organization.");
      }

      if (!saved) {
        throw finalError || new Error("Failed to save Drive folder.");
      }

      toast({
        title: "Drive folder configured!",
        description: "Your workspace is ready to sync documents from Google Drive.",
      });

      onComplete();
    } catch (error: any) {
      console.error("Error saving Drive folder:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save Drive folder. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingFolder(false);
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

  const steps = workspaceExists
    ? [{ label: "Connect Drive" }]
    : [{ label: "Welcome" }, { label: "Create Workspace" }, { label: "Connect Drive" }];

  const displayStep = workspaceExists ? 3 : step;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <h1 className="text-3xl font-bold text-center mb-8 text-foreground">{APP_NAME}</h1>

        {!workspaceExists && (
          <>
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
          </>
        )}

        <div className="glass rounded-2xl p-8">
          {displayStep === 1 && (
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

          {displayStep === 2 && (
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

          {displayStep === 3 && (
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <FolderOpen className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-center">Connect Google Drive</h2>
              <p className="text-muted-foreground mb-6 text-center">
                Enter the ID of the Google Drive folder that contains your documentation.
                Docspeare will sync documents from this folder.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="drive-folder-id">Google Drive Root Folder ID</Label>
                  <Input
                    id="drive-folder-id"
                    placeholder="1ABC123xyz..."
                    value={driveFolderId}
                    onChange={(e) => setDriveFolderId(e.target.value)}
                    disabled={isSavingFolder}
                  />
                  <p className="text-xs text-muted-foreground">
                    Open your Google Drive folder in a browser and copy the ID from the URL
                    — it's the part after <code className="bg-secondary px-1 rounded">/folders/</code>
                  </p>
                </div>

                <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                  <p className="text-sm text-foreground">
                    <strong>Example:</strong> If your Drive folder URL is{" "}
                    <code className="text-xs bg-secondary px-1 rounded break-all">
                      drive.google.com/drive/folders/1AbC2dEf3gHiJkL
                    </code>{" "}
                    then the folder ID is <code className="text-xs bg-secondary px-1 rounded">1AbC2dEf3gHiJkL</code>
                  </p>
                </div>

                <Button
                  variant="hero"
                  size="lg"
                  onClick={handleSaveDriveFolder}
                  className="w-full gap-2"
                  disabled={isSavingFolder || !driveFolderId.trim()}
                >
                  {isSavingFolder ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Save & Continue
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>

                {!workspaceExists && (
                  <Button variant="outline" size="lg" onClick={handleBack} className="w-full gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>
                )}
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
