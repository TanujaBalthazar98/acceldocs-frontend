import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuthNew";
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
  parentDriveId?: string;
  depth?: number;
  type?: "project" | "subproject" | "topic" | "document";
  isFolder?: boolean;
}

const APP_NAME = "Knowledge Workspace";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const DOC_MIME = "application/vnd.google-apps.document";
const GOOGLE_APP_MIMES = new Set([
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
  "application/vnd.google-apps.form",
  "application/vnd.google-apps.drawing",
]);

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

  // Guard: once we've saved the folder and moved to discovery, don't let the
  // useEffect re-check call onComplete() (it would see drive_folder_id is set)
  const pastOrgCheck = useRef(false);

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
  const workspaceName = formatPersonalWorkspaceName(user?.email || null, user?.name || null);

  useEffect(() => {
    // Once we've saved the folder and moved to discovery step, stop re-checking
    if (pastOrgCheck.current) return;

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profileLoading]);

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

      // Prevent the org-check useEffect from calling onComplete() now that
      // drive_folder_id is saved — we want to stay on the discovery step.
      pastOrgCheck.current = true;

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

  // All discovered items in a flat list with hierarchy info
  const [allDiscoveredItems, setAllDiscoveredItems] = useState<DriveItem[]>([]);

  const scanDriveFolder = async (folderId: string) => {
    setIsScanning(true);
    setScanError(null);
    try {
      const token = googleAccessToken || localStorage.getItem("google_access_token");
      console.log("[Onboarding] Scanning folder recursively:", folderId);

      const { data, error } = await invokeFunction<{
        ok?: boolean;
        items?: DriveItem[];
        needsReauth?: boolean;
        error?: string;
        summary?: { projects: number; subprojects: number; topics: number; documents: number };
      }>("discover-drive-structure", {
        body: { folderId },
        ...(token ? { headers: { "x-google-token": token } } : {}),
      });

      console.log("[Onboarding] Discovery result:", { summary: data?.summary, error: error?.message });

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

      const items = data?.items || [];
      setAllDiscoveredItems(items);

      // Split into folders (projects + topics) and documents
      const folders = items.filter((i) => i.isFolder);
      const docs = items.filter((i) => !i.isFolder);

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
    const selectedProjects = discoveredFolders.filter(
      (f) => f.type === "project" && selectedFolderIds.has(f.id)
    );
    const selectedSubprojects = discoveredFolders.filter(
      (f) => f.type === "subproject" && selectedFolderIds.has(f.id)
    );
    const selectedTopics = discoveredFolders.filter(
      (f) => f.type === "topic" && selectedFolderIds.has(f.id)
    );
    const docsToImport = discoveredDocs.filter((d) => selectedDocIds.has(d.id));

    if (selectedProjects.length === 0 && selectedSubprojects.length === 0 && selectedTopics.length === 0 && docsToImport.length === 0) {
      onComplete();
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    const totalItems = selectedProjects.length + selectedSubprojects.length + selectedTopics.length + docsToImport.length + 1;
    let processed = 0;

    // Maps Drive folder ID → created acceldocs project/topic ID
    const driveToProjectId: Record<string, string> = {};
    const driveToVersionId: Record<string, string> = {};
    const driveToTopicId: Record<string, string> = {};

    try {
      // 1. Create projects from level-1 folders
      for (const folder of selectedProjects) {
        try {
          const { data: projRes } = await invokeFunction<{
            ok?: boolean;
            project?: { id?: string | number };
            projectId?: string;
            versionId?: string;
          }>("create-project", {
            body: {
              name: folder.name,
              organizationId,
              driveFolderId: folder.id,
              driveParentId: driveFolderId.trim(),
            },
          });
          const pid = String(projRes?.project?.id || projRes?.projectId || "");
          if (pid) {
            driveToProjectId[folder.id] = pid;
            driveToVersionId[folder.id] = projRes?.versionId || "";
          }
        } catch (err) {
          console.error(`Failed to create project "${folder.name}":`, err);
        }
        processed++;
        setImportProgress(Math.round((processed / totalItems) * 100));
      }

      // 2. Create sub-projects from level-2 folders (projects with parent_id)
      for (const folder of selectedSubprojects) {
        const parentDriveId = folder.parentDriveId || "";
        const parentProjectId = driveToProjectId[parentDriveId] || findProjectForItem(parentDriveId);

        if (parentProjectId) {
          try {
            const { data: projRes } = await invokeFunction<{
              ok?: boolean;
              project?: { id?: string | number };
              projectId?: string;
              versionId?: string;
            }>("create-project", {
              body: {
                name: folder.name,
                organizationId,
                parentId: parentProjectId,
                driveFolderId: folder.id,
                driveParentId: parentDriveId,
              },
            });
            const pid = String(projRes?.project?.id || projRes?.projectId || "");
            if (pid) {
              driveToProjectId[folder.id] = pid;
              driveToVersionId[folder.id] = projRes?.versionId || "";
            }
          } catch (err) {
            console.error(`Failed to create sub-project "${folder.name}":`, err);
          }
        }
        processed++;
        setImportProgress(Math.round((processed / totalItems) * 100));
      }

      // 3. Create topics from level-3+ folders (sorted by depth so parents come first)
      const sortedTopics = [...selectedTopics].sort((a, b) => (a.depth || 0) - (b.depth || 0));
      for (const folder of sortedTopics) {
        // Find which project this topic belongs to by walking up the hierarchy
        const parentDriveId = folder.parentDriveId || "";
        const projectId = driveToProjectId[parentDriveId] || findProjectForItem(parentDriveId);
        const parentTopicId = driveToTopicId[parentDriveId] || null;

        if (projectId) {
          try {
            const { data: topicRes } = await invokeFunction<{
              ok?: boolean;
              topic?: { id?: string | number };
            }>("create-topic", {
              body: {
                projectId,
                name: folder.name,
                parentId: parentTopicId,
                driveFolderId: folder.id,
              },
            });
            const tid = String(topicRes?.topic?.id || "");
            if (tid) {
              driveToTopicId[folder.id] = tid;
              // Inherit the project mapping so deeper items can find their project
              driveToProjectId[folder.id] = projectId;
              driveToVersionId[folder.id] = driveToVersionId[parentDriveId] || "";
            }
          } catch (err) {
            console.error(`Failed to create topic "${folder.name}":`, err);
          }
        }
        processed++;
        setImportProgress(Math.round((processed / totalItems) * 100));
      }

      // Helper: walk up the hierarchy to find the project for a given Drive folder
      function findProjectForItem(driveId: string): string | null {
        // Check direct mapping
        if (driveToProjectId[driveId]) return driveToProjectId[driveId];
        // Walk up via allDiscoveredItems
        const item = allDiscoveredItems.find((i) => i.id === driveId);
        if (item?.parentDriveId) return findProjectForItem(item.parentDriveId);
        return null;
      }

      // 3. Import documents — assign to their parent project/topic
      // Separate root-level docs (orphans) from docs inside folders
      const rootFolderId = driveFolderId.trim();
      const orphanDocs = docsToImport.filter((d) => d.parentDriveId === rootFolderId);
      const nestedDocs = docsToImport.filter((d) => d.parentDriveId !== rootFolderId);

      // Create "General" project for orphan docs at root level
      let generalProjectId: string | null = null;
      let generalVersionId: string | null = null;
      if (orphanDocs.length > 0) {
        // First check if a "General" project already exists (avoids duplicates on re-runs)
        try {
          const { data: listRes } = await invokeFunction<{
            ok?: boolean;
            projects?: Array<{ id?: string | number; name?: string; drive_folder_id?: string | null; default_version?: { id?: string | number } }>;
          }>("list-projects", { body: { organizationId } });
          const existing = listRes?.projects?.find(
            (p) => p.name?.toLowerCase() === "general" && !p.drive_folder_id
          );
          if (existing?.id) {
            generalProjectId = String(existing.id);
            generalVersionId = String(existing.default_version?.id || "");
          }
        } catch {
          // ignore — will try to create below
        }

        if (!generalProjectId) {
          try {
            const { data: projRes } = await invokeFunction<{
              ok?: boolean;
              project?: { id?: string | number };
              projectId?: string | number;
              versionId?: string | number;
            }>("create-project", {
              body: {
                name: "General",
                organizationId,
                driveFolderId: null,
              },
            });
            const rawId = projRes?.project?.id || projRes?.projectId;
            if (rawId) {
              generalProjectId = String(rawId);
              generalVersionId = String(projRes?.versionId || "");
            } else {
              console.error("Failed to create General project: no ID in response", projRes);
            }
          } catch (err) {
            console.error("Failed to create General project:", err);
          }
        }
      }
      processed++;
      setImportProgress(Math.round((processed / totalItems) * 100));

      // Fallback: if General project is unavailable, use any project we already created
      const fallbackProjectId = generalProjectId ?? Object.values(driveToProjectId)[0] ?? null;
      const fallbackVersionId = generalVersionId ?? Object.values(driveToVersionId)[0] ?? "";

      let skippedDocs = 0;
      // Import all docs
      for (const doc of [...orphanDocs, ...nestedDocs]) {
        const parentDriveId = doc.parentDriveId || rootFolderId;
        const isOrphan = parentDriveId === rootFolderId;

        // For nested docs, walk up hierarchy; if that fails, fall back to General/first project
        const resolvedProjectId = isOrphan
          ? generalProjectId
          : (findProjectForItem(parentDriveId) ?? fallbackProjectId);
        const resolvedVersionId = isOrphan
          ? generalVersionId
          : (driveToVersionId[parentDriveId] || fallbackVersionId || "");
        const topicId = driveToTopicId[parentDriveId] || null;

        if (resolvedProjectId) {
          try {
            await invokeFunction("create-document", {
              body: {
                projectId: resolvedProjectId,
                projectVersionId: resolvedVersionId || null,
                topicId,
                title: doc.name,
                googleDocId: doc.id,
                visibility: "internal",
              },
            });
          } catch (err) {
            console.error(`Failed to import doc "${doc.name}":`, err);
          }
        } else {
          skippedDocs++;
          console.warn(`Could not find project for doc "${doc.name}" (parentDriveId: ${parentDriveId}) — skipped`);
        }
        processed++;
        setImportProgress(Math.round((processed / totalItems) * 100));
      }

      const projectCount = selectedProjects.length + (orphanDocs.length > 0 ? 1 : 0);
      const importedDocs = docsToImport.length - skippedDocs;
      toast({
        title: skippedDocs > 0 ? "Import complete (with warnings)" : "Import complete!",
        description: `Created ${projectCount} project${projectCount !== 1 ? "s" : ""}` +
          (selectedSubprojects.length > 0 ? `, ${selectedSubprojects.length} sub-project${selectedSubprojects.length !== 1 ? "s" : ""}` : "") +
          (selectedTopics.length > 0 ? `, ${selectedTopics.length} topic${selectedTopics.length !== 1 ? "s" : ""}` : "") +
          (importedDocs > 0 ? `, ${importedDocs} document${importedDocs !== 1 ? "s" : ""}` : "") +
          (skippedDocs > 0 ? `. ${skippedDocs} doc${skippedDocs !== 1 ? "s" : ""} skipped (no project found).` : "."),
        variant: skippedDocs > 0 ? "destructive" : undefined,
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
                Select which items to import. Level 1 folders become <strong>projects</strong>,
                level 2 folders become <strong>sub-projects</strong>, deeper folders become <strong>topics</strong>,
                and Google Docs become <strong>documents</strong>.
              </p>
              </>
              )}

              <div className="space-y-5">
                {/* Tree view of all discovered items */}
                {!isScanning && !scanError && allDiscoveredItems.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FolderOpen className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">
                        Drive Structure ({allDiscoveredItems.length} items)
                      </h3>
                    </div>
                    <div className="space-y-0.5 max-h-80 overflow-y-auto rounded-lg border border-border p-2">
                      {allDiscoveredItems.map((item) => {
                        const depth = item.depth || 0;
                        const isSelected = item.isFolder
                          ? selectedFolderIds.has(item.id)
                          : selectedDocIds.has(item.id);
                        const toggle = item.isFolder
                          ? () => toggleFolder(item.id)
                          : () => toggleDoc(item.id);

                        const typeLabel =
                          item.type === "project" ? "Project" :
                          item.type === "subproject" ? "Sub-project" :
                          item.type === "topic" ? "Topic" :
                          "Doc";
                        const typeBadgeColor =
                          item.type === "project" ? "bg-primary/10 text-primary" :
                          item.type === "subproject" ? "bg-green-500/10 text-green-600" :
                          item.type === "topic" ? "bg-amber-500/10 text-amber-600" :
                          "bg-blue-500/10 text-blue-600";

                        return (
                          <button
                            key={item.id}
                            onClick={toggle}
                            disabled={isImporting}
                            className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-md hover:bg-secondary/50 transition-colors"
                            style={{ paddingLeft: `${12 + depth * 20}px` }}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-primary shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            )}
                            {item.isFolder ? (
                              <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            )}
                            <span className="text-sm truncate flex-1">{item.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${typeBadgeColor} shrink-0`}>
                              {typeLabel}
                            </span>
                          </button>
                        );
                      })}
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
