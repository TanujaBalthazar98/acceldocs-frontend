import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Building2,
  FolderOpen,
  Folder,
  FileText,
  Search,
  CheckSquare,
  Square,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { invokeFunction } from "@/lib/api/functions";

interface OnboardingProps {
  onComplete: () => void;
  organizationId: string | null;
}

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
}

const APP_NAME = "Docspeare";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const DOC_MIME = "application/vnd.google-apps.document";

const formatPersonalWorkspaceName = (email?: string | null, fullName?: string | null) => {
  const base = fullName?.trim() || email?.split("@")[0] || "Personal";
  const cleaned = base.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Personal Workspace";
  return cleaned.toLowerCase().includes("workspace") ? cleaned : `${cleaned} Workspace`;
};

export const Onboarding = ({ onComplete, organizationId }: OnboardingProps) => {
  const { user, profileLoading, googleAccessToken } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [isCheckingOrg, setIsCheckingOrg] = useState(true);
  const [driveFolderId, setDriveFolderId] = useState("");

  // If workspace already exists (login auto-created it), skip straight to Drive folder setup
  const [workspaceExists, setWorkspaceExists] = useState(false);

  // Discovery state
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [discoveredFolders, setDiscoveredFolders] = useState<DriveItem[]>([]);
  const [discoveredDocs, setDiscoveredDocs] = useState<DriveItem[]>([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [savedFolderId, setSavedFolderId] = useState<string | null>(null);

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
          onComplete();
          return;
        }

        if (role) {
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

      toast({
        title: data.existed ? "Workspace ready" : "Workspace created!",
        description: "Now let's connect your Google Drive folder.",
      });

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
        title: "Drive folder saved!",
        description: "Scanning your folder for existing content...",
      });

      setSavedFolderId(folderId);
      setStep(4);
      // Trigger scan after moving to step 4
      scanDriveFolder(folderId);
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

  const scanDriveFolder = async (folderId: string) => {
    setIsScanning(true);
    setScanError(null);
    try {
      const token = googleAccessToken || localStorage.getItem("google_access_token");
      console.log("[Onboarding] Scanning folder:", folderId, "token present:", !!token);

      const { data, error } = await invokeFunction<{
        ok?: boolean;
        files?: DriveItem[];
        needsReauth?: boolean;
        error?: string;
      }>("google-drive", {
        body: { action: "list_folder", folderId },
        ...(token ? { headers: { "x-google-token": token } } : {}),
      });

      console.log("[Onboarding] Scan result:", { data, error: error?.message });

      if (error) {
        setScanError(error.message || "Failed to scan folder");
        return;
      }

      if (data?.needsReauth) {
        setScanError("Google Drive access token expired. Please re-authenticate from the dashboard.");
        return;
      }

      if (data?.ok === false && data?.error) {
        setScanError(data.error);
        return;
      }

      const files = data?.files || [];
      console.log("[Onboarding] All files:", files.map((f) => ({ name: f.name, mimeType: f.mimeType, id: f.id })));
      const folders = files.filter((f) => f.mimeType === FOLDER_MIME);
      const docs = files.filter((f) => f.mimeType === DOC_MIME);
      console.log("[Onboarding] Folders:", folders.length, "Docs:", docs.length);

      setDiscoveredFolders(folders);
      setDiscoveredDocs(docs);
      setSelectedFolderIds(new Set(folders.map((f) => f.id)));
      setSelectedDocIds(new Set(docs.map((d) => d.id)));
    } catch (err: any) {
      console.error("[Onboarding] Scan error:", err);
      setScanError(err.message || "Failed to scan Drive folder");
    } finally {
      setIsScanning(false);
    }
  };

  const toggleFolder = (id: string) => {
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDoc = (id: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    const foldersToCreate = discoveredFolders.filter((f) => selectedFolderIds.has(f.id));
    const docsToImport = discoveredDocs.filter((d) => selectedDocIds.has(d.id));

    if (foldersToCreate.length === 0 && docsToImport.length === 0) {
      onComplete();
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    const totalItems = foldersToCreate.length + (docsToImport.length > 0 ? 1 + docsToImport.length : 0);
    let processed = 0;

    try {
      // Create projects from selected folders
      for (const folder of foldersToCreate) {
        try {
          await invokeFunction("create-project", {
            body: {
              name: folder.name,
              organizationId,
              parentId: null,
              driveFolderId: folder.id,
              driveParentId: driveFolderId.trim(),
              isPublished: false,
            },
          });
        } catch (err) {
          console.error(`Failed to create project for folder "${folder.name}":`, err);
        }
        processed++;
        setImportProgress(Math.round((processed / totalItems) * 100));
      }

      // If there are loose docs, create a default project for them
      if (docsToImport.length > 0) {
        let defaultProjectId: string | null = null;
        let defaultVersionId: string | null = null;

        try {
          const { data: projRes } = await invokeFunction<{
            ok?: boolean;
            projectId?: string;
            versionId?: string;
          }>("create-project", {
            body: {
              name: "General",
              organizationId,
              parentId: null,
              driveFolderId: null,
              isPublished: false,
            },
          });
          defaultProjectId = projRes?.projectId || null;
          defaultVersionId = projRes?.versionId || null;
        } catch (err) {
          console.error("Failed to create default project:", err);
        }
        processed++;
        setImportProgress(Math.round((processed / totalItems) * 100));

        // Import docs into the default project
        if (defaultProjectId) {
          for (const doc of docsToImport) {
            try {
              await invokeFunction("create-document", {
                body: {
                  projectId: defaultProjectId,
                  projectVersionId: defaultVersionId,
                  topicId: null,
                  title: doc.name,
                  googleDocId: doc.id,
                  isPublished: false,
                  visibility: "internal",
                },
              });
            } catch (err) {
              console.error(`Failed to import doc "${doc.name}":`, err);
            }
            processed++;
            setImportProgress(Math.round((processed / totalItems) * 100));
          }
        }
      }

      toast({
        title: "Import complete!",
        description: `Created ${foldersToCreate.length} project${foldersToCreate.length !== 1 ? "s" : ""}${
          docsToImport.length > 0 ? ` and imported ${docsToImport.length} document${docsToImport.length !== 1 ? "s" : ""}` : ""
        }.`,
      });

      onComplete();
    } catch (err: any) {
      console.error("Import error:", err);
      toast({
        title: "Import partially failed",
        description: "Some items couldn't be imported. You can sync from the dashboard.",
        variant: "destructive",
      });
      onComplete();
    } finally {
      setIsImporting(false);
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

  const displayStep = workspaceExists && step < 3 ? 3 : step;

  // Step indicator labels
  const stepLabels = workspaceExists
    ? ["Connect Drive", "Review"]
    : ["Welcome", "Workspace", "Connect Drive", "Review"];
  const stepNumbers = workspaceExists ? [3, 4] : [1, 2, 3, 4];
  const activeStepIndex = stepNumbers.indexOf(displayStep);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <h1 className="text-3xl font-bold text-center mb-8 text-foreground">{APP_NAME}</h1>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {stepNumbers.map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  displayStep >= s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                {displayStep > s ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
              </div>
              {i < stepNumbers.length - 1 && (
                <div className={`w-8 h-0.5 mx-1 ${displayStep > s ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-6 mb-8 text-xs text-muted-foreground">
          {stepLabels.map((label, i) => (
            <span key={label} className={activeStepIndex >= i ? "text-primary" : ""}>{label}</span>
          ))}
        </div>

        <div className="glass rounded-2xl p-8">
          {/* Step 1: Welcome */}
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

          {/* Step 2: Create Workspace */}
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

          {/* Step 3: Enter Drive Folder ID */}
          {displayStep === 3 && (
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <FolderOpen className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-center">Connect Google Drive</h2>
              <p className="text-muted-foreground mb-6 text-center">
                Enter the ID of the Google Drive folder that contains your documentation.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="drive-folder-id">Google Drive Root Folder ID</Label>
                  <Input
                    id="drive-folder-id"
                    placeholder="1ABC123xyz..."
                    value={driveFolderId}
                    onChange={(e) => setDriveFolderId(e.target.value)}
                    disabled={isSavingFolder || isScanning}
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
                  disabled={isSavingFolder || isScanning || !driveFolderId.trim()}
                >
                  {isSavingFolder || isScanning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isScanning ? "Scanning folder..." : "Saving..."}
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Save & Scan Folder
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

          {/* Step 4: Discovery Results */}
          {displayStep === 4 && (
            <div className="max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <FolderOpen className="w-8 h-8 text-primary" />
              </div>

              {/* Scanning state */}
              {isScanning && (
                <div className="text-center py-8">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
                  <h2 className="text-xl font-bold mb-2">Scanning your Drive folder...</h2>
                  <p className="text-muted-foreground text-sm">Looking for subfolders and documents</p>
                </div>
              )}

              {/* Scan error */}
              {!isScanning && scanError && (
                <div className="text-center py-4">
                  <h2 className="text-xl font-bold mb-2">Couldn't scan your folder</h2>
                  <p className="text-destructive text-sm mb-4">{scanError}</p>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="hero"
                      size="lg"
                      onClick={() => savedFolderId && scanDriveFolder(savedFolderId)}
                      className="w-full gap-2"
                    >
                      <Search className="w-4 h-4" />
                      Retry Scan
                    </Button>
                    <Button variant="outline" size="lg" onClick={onComplete} className="w-full gap-2">
                      Skip — continue to dashboard
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Empty folder */}
              {!isScanning && !scanError && discoveredFolders.length === 0 && discoveredDocs.length === 0 && (
                <div className="text-center py-4">
                  <h2 className="text-xl font-bold mb-2">Folder is empty</h2>
                  <p className="text-muted-foreground text-sm mb-4">
                    No subfolders or documents found yet. You can add content from the dashboard.
                  </p>
                  <Button variant="hero" size="lg" onClick={onComplete} className="w-full gap-2">
                    Continue to Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Found content */}
              {!isScanning && !scanError && (discoveredFolders.length > 0 || discoveredDocs.length > 0) && (
                <>
              <h2 className="text-2xl font-bold mb-2 text-center">We found content in your Drive</h2>
              <p className="text-muted-foreground mb-6 text-center text-sm">
                Select which items to import. Folders become projects, and documents will be linked to your workspace.
              </p>
              </>
              )}

              <div className="space-y-5">
                {/* Folders → Projects */}
                {!isScanning && !scanError && discoveredFolders.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Folder className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">
                        Folders → Projects ({discoveredFolders.length})
                      </h3>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-lg border border-border p-2">
                      {discoveredFolders.map((folder) => (
                        <button
                          key={folder.id}
                          onClick={() => toggleFolder(folder.id)}
                          disabled={isImporting}
                          className="flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-md hover:bg-secondary/50 transition-colors"
                        >
                          {selectedFolderIds.has(folder.id) ? (
                            <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                          <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                          <span className="text-sm truncate">{folder.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Documents → Pages (need default project) */}
                {!isScanning && !scanError && discoveredDocs.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <h3 className="text-sm font-semibold text-foreground">
                        Documents ({discoveredDocs.length})
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      These documents are at the root level. A <strong>"General"</strong> project will be created for them.
                    </p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-lg border border-border p-2">
                      {discoveredDocs.map((doc) => (
                        <button
                          key={doc.id}
                          onClick={() => toggleDoc(doc.id)}
                          disabled={isImporting}
                          className="flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-md hover:bg-secondary/50 transition-colors"
                        >
                          {selectedDocIds.has(doc.id) ? (
                            <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                          <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                          <span className="text-sm truncate">{doc.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Progress bar (only during import) */}
                {!isScanning && !scanError && isImporting && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Importing...</span>
                      <span className="font-medium">{importProgress}%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${importProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Actions — only show when we have results */}
                {!isScanning && !scanError && (discoveredFolders.length > 0 || discoveredDocs.length > 0) && (
                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    variant="hero"
                    size="lg"
                    onClick={handleImport}
                    disabled={isImporting}
                    className="w-full gap-2"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        Import Selected & Continue
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={onComplete}
                    disabled={isImporting}
                    className="w-full gap-2"
                  >
                    Skip — I'll set up later
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
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
