import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { parseZipFile, parseFolderFiles, ParsedImport } from "@/lib/zipImporter";
import { splitImportBatches } from "@/lib/importBatching";
import { 
  Upload, 
  FolderArchive, 
  FolderOpen, 
  FileText, 
  CheckCircle2, 
  Loader2,
  FileJson,
  Sparkles,
  X
} from "lucide-react";

interface ZipImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectVersionId?: string | null;
  projectName: string;
  projectFolderId: string;
  organizationId: string;
  onImported: () => void;
}

type ImportGroupType = "subproject" | "topic";

interface ImportStructureGroup {
  type: ImportGroupType;
  name: string;
  prefixes: string[];
  order?: string[];
}

interface ImportStructurePlan {
  version: number;
  groups: ImportStructureGroup[];
  notes?: string[];
}

interface GroupPreview {
  key: string;
  type: ImportGroupType;
  name: string;
  fileCount: number;
  samplePaths: string[];
}

const MAX_SAMPLE_FILES = 120;
const MAX_SAMPLE_PER_FOLDER = 8;
const MAX_SNIPPET_LENGTH = 200;

const normalizePath = (path: string): string =>
  path
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/+/g, "/");

const getTopLevel = (path: string): string => {
  const normalized = normalizePath(path);
  return normalized.split("/")[0] || "(root)";
};

const getCommonRoot = (paths: string[]): string | null => {
  if (paths.length === 0) return null;
  const firstParts = normalizePath(paths[0]).split("/");
  if (firstParts.length < 2) return null;
  const candidate = firstParts[0];
  const allShare = paths.every((path) => normalizePath(path).startsWith(`${candidate}/`));
  return allShare ? candidate : null;
};

const matchesPrefix = (path: string, prefix: string): boolean => {
  if (!prefix) return true;
  if (path === prefix) return true;
  return path.startsWith(`${prefix}/`);
};

const stripPrefix = (path: string, prefix: string): string => {
  if (!prefix) return path;
  if (path === prefix) return "";
  if (path.startsWith(`${prefix}/`)) {
    return path.slice(prefix.length + 1);
  }
  return path;
};

const extractTitleFromContent = (content: string): string | null => {
  const frontmatterMatch = content.match(/^---[\s\S]*?title:\s*['"]?([^'"\n]+)['"]?[\s\S]*?---/);
  if (frontmatterMatch) return frontmatterMatch[1].trim();
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  return null;
};

const extractSnippet = (content: string): string => {
  const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n*/m, "");
  return withoutFrontmatter.replace(/\s+/g, " ").trim().slice(0, MAX_SNIPPET_LENGTH);
};

const buildSampleFiles = (files: ParsedImport["files"]) => {
  const byFolder = new Map<string, ParsedImport["files"]>();
  for (const file of files) {
    const top = getTopLevel(file.path);
    if (!byFolder.has(top)) byFolder.set(top, []);
    byFolder.get(top)!.push(file);
  }

  const samples: Array<{ path: string; title?: string; heading?: string; snippet?: string }> = [];
  for (const [, folderFiles] of byFolder) {
    for (const file of folderFiles.slice(0, MAX_SAMPLE_PER_FOLDER)) {
      const title = extractTitleFromContent(file.content) || undefined;
      samples.push({
        path: normalizePath(file.path),
        title,
        heading: title,
        snippet: extractSnippet(file.content),
      });
    }
  }

  if (samples.length < MAX_SAMPLE_FILES) {
    const seen = new Set(samples.map((sample) => sample.path));
    for (const file of files) {
      if (samples.length >= MAX_SAMPLE_FILES) break;
      const normalized = normalizePath(file.path);
      if (seen.has(normalized)) continue;
      const title = extractTitleFromContent(file.content) || undefined;
      samples.push({
        path: normalized,
        title,
        heading: title,
        snippet: extractSnippet(file.content),
      });
      seen.add(normalized);
    }
  }

  return samples.slice(0, MAX_SAMPLE_FILES);
};

const normalizePlanGroups = (plan: ImportStructurePlan): ImportStructureGroup[] =>
  plan.groups.map((group) => ({
    ...group,
    name: group.name?.trim() || "",
    prefixes: group.prefixes.map((prefix) => (prefix === "" ? "" : normalizePath(prefix))),
  }));

const getGroupKey = (group: ImportStructureGroup, index: number): string => {
  const base = group.name || group.prefixes[0] || "group";
  return `${group.type}:${base}:${index}`;
};

const isProjectRootName = (name: string): boolean =>
  name.trim().toLowerCase() === "project root";

const adjustPathForGroup = (
  originalPath: string,
  group: ImportStructureGroup,
  matchedPrefix: string
): string => {
  const normalized = normalizePath(originalPath);
  const stripped = stripPrefix(normalized, matchedPrefix);
  const fallbackName = normalized.split("/").pop() || normalized;

  if (group.type === "subproject") {
    const adjusted = stripped || fallbackName;
    return normalizePath(adjusted);
  }

  const groupName = group.name.trim();
  if (groupName && !isProjectRootName(groupName)) {
    const adjusted = stripped ? `${groupName}/${stripped}` : groupName;
    return normalizePath(adjusted);
  }

  return normalized;
};

const buildAssignments = (
  files: ParsedImport["files"],
  plan: ImportStructurePlan
) => {
  const groups = normalizePlanGroups(plan);
  const assignments = new Map<string, { group: ImportStructureGroup; files: { path: string; content: string }[] }>();
  const groupOrder: string[] = [];

  groups.forEach((group, index) => {
    const key = getGroupKey(group, index);
    groupOrder.push(key);
    assignments.set(key, { group, files: [] });
  });

  const findBestGroup = (path: string) => {
    let bestGroup: ImportStructureGroup | null = null;
    let bestPrefix = "";
    let bestLength = -1;

    for (const group of groups) {
      for (const prefix of group.prefixes) {
        if (!matchesPrefix(path, prefix)) continue;
        const length = prefix.length;
        if (length > bestLength) {
          bestGroup = group;
          bestPrefix = prefix;
          bestLength = length;
        }
      }
    }

    return { group: bestGroup, prefix: bestPrefix };
  };

  for (const file of files) {
    const normalizedPath = normalizePath(file.path);
    const { group, prefix } = findBestGroup(normalizedPath);
    if (!group) continue;

    const groupIndex = groups.indexOf(group);
    const key = getGroupKey(group, groupIndex);
    const assignment = assignments.get(key);
    if (!assignment) continue;

    const adjustedPath = adjustPathForGroup(normalizedPath, group, prefix);
    assignment.files.push({ path: adjustedPath, content: file.content });
  }

  const preview: GroupPreview[] = [];
  const topicFiles: { path: string; content: string }[] = [];
  const subprojectGroups: Array<{ group: ImportStructureGroup; files: { path: string; content: string }[] }> = [];

  for (const key of groupOrder) {
    const entry = assignments.get(key);
    if (!entry || entry.files.length === 0) continue;

    preview.push({
      key,
      type: entry.group.type,
      name: entry.group.name || (entry.group.type === "subproject" ? "Untitled subproject" : "Project Root"),
      fileCount: entry.files.length,
      samplePaths: entry.files.slice(0, 5).map((file) => file.path),
    });

    if (entry.group.type === "subproject") {
      subprojectGroups.push(entry);
    } else {
      topicFiles.push(...entry.files);
    }
  }

  return { preview, topicFiles, subprojectGroups };
};

export function ZipImportDialog({
  open,
  onOpenChange,
  projectId,
  projectVersionId,
  projectName,
  projectFolderId,
  organizationId,
  onImported,
}: ZipImportDialogProps) {
  const [parsedImport, setParsedImport] = useState<ParsedImport | null>(null);
  const [importing, setImporting] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [analysis, setAnalysis] = useState<ImportStructurePlan | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const { user, googleAccessToken } = useAuth();
  const { createFolder } = useGoogleDrive();

  const resetState = useCallback(() => {
    setParsedImport(null);
    setImporting(false);
    setAiEnabled(false);
    setAnalysis(null);
    setAnalysisLoading(false);
    setAnalysisError(null);
    if (zipInputRef.current) zipInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  }, []);

  const handleZipSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast({ title: "Invalid file", description: "Please select a ZIP file", variant: "destructive" });
      return;
    }
    
    const parsed = await parseZipFile(file);
    setParsedImport(parsed);
    setAnalysis(null);
    setAnalysisError(null);
    
    if (parsed.errors.length > 0) {
      toast({ 
        title: "Some files couldn't be read", 
        description: `${parsed.errors.length} error(s) occurred`,
        variant: "destructive"
      });
    }
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const parsed = await parseFolderFiles(files);
    setParsedImport(parsed);
    setAnalysis(null);
    setAnalysisError(null);
    
    if (parsed.errors.length > 0) {
      toast({ 
        title: "Some files couldn't be read", 
        description: `${parsed.errors.length} error(s) occurred`,
        variant: "destructive"
      });
    }
  };

  const getAnalysisErrorMessage = useCallback(async (error: unknown) => {
    if (!error || typeof error !== "object") return "AI analysis failed";

    const err = error as { name?: string; message?: string; context?: unknown };

    if (err.name === "FunctionsFetchError") {
      const causeMessage =
        err.context && typeof err.context === "object" && "message" in err.context
          ? ` (${String(err.context.message)})`
          : "";
      return `Could not reach the AI analysis Edge Function${causeMessage}. Make sure analyze-import-structure is deployed for this project and your network allows requests to the Functions URL.`;
    }

    if (err.name === "FunctionsRelayError") {
      return "Supabase relay could not reach the AI analysis function. Check that analyze-import-structure is deployed and healthy.";
    }

    if (err.name === "FunctionsHttpError") {
      const response = err.context as Response | undefined;
      let details = "";

      if (response && typeof response.text === "function") {
        const bodyText = await response.text();
        try {
          const parsed = JSON.parse(bodyText);
          details = String(parsed?.error || parsed?.message || "");
        } catch {
          details = bodyText;
        }
        details = details.replace(/\s+/g, " ").trim();
      }

      if (response?.status) {
        return `AI analysis failed (${response.status})${details ? `: ${details}` : "."}`;
      }
    }

    return err.message || "AI analysis failed";
  }, []);

  const runStructureAnalysis = useCallback(async () => {
    if (!parsedImport || parsedImport.files.length === 0) return;
    if (!user) {
      setAnalysisError("Sign in to analyze structure.");
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError(null);

    try {
      const normalizedPaths = parsedImport.files.map((file) => normalizePath(file.path));
      const commonRoot = getCommonRoot(normalizedPaths);
      const topLevelCounts = new Map<string, number>();

      for (const path of normalizedPaths) {
        const relativePath = commonRoot ? stripPrefix(path, commonRoot) || path : path;
        const top = getTopLevel(relativePath);
        topLevelCounts.set(top, (topLevelCounts.get(top) ?? 0) + 1);
      }

      const { data, error } = await supabase.functions.invoke("analyze-import-structure", {
        body: {
          projectName,
          files: buildSampleFiles(parsedImport.files),
          totalFiles: parsedImport.files.length,
          topLevelFolders: Array.from(topLevelCounts.entries()).map(([name, count]) => ({ name, count })),
          commonRoot,
        },
      });

      if (error) {
        throw new Error(error.message || "AI analysis failed");
      }

      if (!data?.plan?.groups) {
        throw new Error("No structure plan returned");
      }

      setAnalysis(data.plan);
    } catch (err) {
      const message = await getAnalysisErrorMessage(err);
      setAnalysisError(message);
      setAnalysis(null);
    } finally {
      setAnalysisLoading(false);
    }
  }, [parsedImport, projectName, user, getAnalysisErrorMessage]);

  useEffect(() => {
    if (!aiEnabled) return;
    if (!parsedImport || parsedImport.files.length === 0) return;
    if (analysis || analysisLoading || analysisError) return;
    void runStructureAnalysis();
  }, [aiEnabled, parsedImport, analysis, analysisLoading, analysisError, runStructureAnalysis]);

  const analysisPreview = useMemo(() => {
    if (!parsedImport || !analysis) return null;
    return buildAssignments(parsedImport.files, analysis);
  }, [parsedImport, analysis]);

  const plannedSummary = useMemo(() => {
    if (!analysisPreview) return null;
    const plannedFiles =
      analysisPreview.topicFiles.length +
      analysisPreview.subprojectGroups.reduce((sum, entry) => sum + entry.files.length, 0);
    return {
      plannedFiles,
      plannedGroups: analysisPreview.preview.length,
    };
  }, [analysisPreview]);

  const startImportBatches = async (
    filesToImport: Array<{ path: string; content: string }>,
    targetProjectId: string
  ) => {
    if (filesToImport.length === 0) return { jobId: null, needsReauth: false };

    const { batches, offsets } = splitImportBatches(filesToImport);
    const totalFiles = filesToImport.length;

    const invokeBatch = (batchFiles: typeof filesToImport, batchStart: number, jobId?: string | null) =>
        supabase.functions.invoke("import-markdown", {
          body: {
            files: batchFiles,
            projectId: targetProjectId,
            organizationId,
            projectVersionId,
            jobId,
            batchStart,
            totalFiles,
            filesAreBatch: true,
          },
        headers: {
          "x-google-token": googleAccessToken,
        },
      });

    const { data, error } = await invokeBatch(batches[0], offsets[0], null);

    if (error) {
      throw new Error(error.message || "Failed to start import");
    }

    if (data?.needsReauth) {
      return { jobId: null, needsReauth: true, error: data?.error };
    }

    if (data?.jobId && batches.length > 1) {
      void (async () => {
        try {
          for (let i = 1; i < batches.length; i += 1) {
            const batchResponse = await invokeBatch(batches[i], offsets[i], data.jobId);
            if (batchResponse.error) {
              throw new Error(batchResponse.error.message || "Failed to continue import");
            }
            if (batchResponse.data?.needsReauth) {
              toast({
                title: "Google reconnection required",
                description: batchResponse.data?.error || "Please reconnect your Google account to continue.",
                variant: "destructive",
              });
              break;
            }
          }
        } catch (batchError) {
          console.error("Import batch error:", batchError);
          toast({
            title: "Import failed",
            description: batchError instanceof Error ? batchError.message : "Unknown error",
            variant: "destructive",
          });
        }
      })();
    }

    return { jobId: data?.jobId ?? null, needsReauth: false };
  };

  const handleImport = async () => {
    if (!parsedImport || parsedImport.files.length === 0 || !user || !googleAccessToken) return;
    
    setImporting(true);
    
    try {
      if (aiEnabled) {
        if (!analysis || analysisLoading) {
          toast({
            title: "Smart structure not ready",
            description: "Wait for analysis to finish, or turn off Smart structure.",
            variant: "destructive",
          });
          setImporting(false);
          return;
        }

        const assignments = buildAssignments(parsedImport.files, analysis);
        const { topicFiles, subprojectGroups } = assignments;
        const totalPlanned =
          topicFiles.length +
          subprojectGroups.reduce((sum, entry) => sum + entry.files.length, 0);

        if (totalPlanned === 0) {
          throw new Error("No files matched the import plan");
        }

        for (const entry of subprojectGroups) {
          const nameFromPrefix = entry.group.prefixes[0]?.split("/").pop() || "Subproject";
          const subprojectName = entry.group.name?.trim() || nameFromPrefix;
          const { data: existingProject, error: existingError } = await supabase
            .from("projects")
            .select("id, drive_folder_id")
            .eq("organization_id", organizationId)
            .eq("parent_id", projectId)
            .eq("name", subprojectName)
            .maybeSingle();

          if (existingError) {
            throw new Error(existingError.message || "Failed to check subproject");
          }

          let targetProjectId = existingProject?.id || null;
          let targetFolderId = existingProject?.drive_folder_id || null;

          if (!targetFolderId) {
            const folder = await createFolder(subprojectName, projectFolderId);
            if (!folder) {
              throw new Error(`Failed to create Drive folder for ${subprojectName}`);
            }
            targetFolderId = folder.id;

            if (targetProjectId) {
              const { error: updateError } = await supabase
                .from("projects")
                .update({ drive_folder_id: targetFolderId })
                .eq("id", targetProjectId);
              if (updateError) {
                throw new Error(updateError.message || "Failed to update subproject folder");
              }
            } else {
              const { data: createdProject, error: createError } = await supabase
                .from("projects")
                .insert({
                  name: subprojectName,
                  organization_id: organizationId,
                  created_by: user.id,
                  drive_folder_id: targetFolderId,
                  parent_id: projectId,
                })
                .select("id")
                .single();

              if (createError || !createdProject) {
                throw new Error(createError?.message || "Failed to create subproject record");
              }
              targetProjectId = createdProject.id;
            }
          }

          if (!targetProjectId) {
            throw new Error(`No project id available for ${subprojectName}`);
          }

          const subprojectResult = await startImportBatches(entry.files, targetProjectId);
          if (subprojectResult.needsReauth) {
            toast({
              title: "Google reconnection required",
              description: subprojectResult.error || "Please reconnect your Google account to continue.",
              variant: "destructive",
            });
            setImporting(false);
            return;
          }
        }

        if (topicFiles.length > 0) {
          const rootResult = await startImportBatches(topicFiles, projectId);
          if (rootResult.needsReauth) {
            toast({
              title: "Google reconnection required",
              description: rootResult.error || "Please reconnect your Google account to continue.",
              variant: "destructive",
            });
            setImporting(false);
            return;
          }
        }

        toast({
          title: "Import started",
          description: `Importing ${totalPlanned} files across ${subprojectGroups.length + (topicFiles.length > 0 ? 1 : 0)} group(s).`,
        });
      } else {
        const filesToImport = parsedImport.files.map((file) => ({
          path: file.path,
          content: file.content,
        }));
        const result = await startImportBatches(filesToImport, projectId);
        if (result.needsReauth) {
          toast({
            title: "Google reconnection required",
            description: result.error || "Please reconnect your Google account to continue.",
            variant: "destructive",
          });
          setImporting(false);
          return;
        }

        toast({
          title: "Import started",
          description: `Importing ${parsedImport.files.length} files in the background. Progress will be shown in the corner.`,
        });
      }
      
      // Close the dialog - GlobalImportProgress will track the job
      resetState();
      onOpenChange(false);
      onImported();
      
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (!importing) {
      resetState();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderArchive className="h-5 w-5" />
            Import from ZIP or Folder
          </DialogTitle>
          <DialogDescription>
            Import markdown files with preserved folder structure. 
            Supports _meta.json and toc.yml for ordering.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!parsedImport && !importing && (
            <>
              {/* Upload options */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  onClick={() => zipInputRef.current?.click()}
                >
                  <FolderArchive className="h-8 w-8 text-muted-foreground" />
                  <span>Upload ZIP</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  onClick={() => folderInputRef.current?.click()}
                >
                  <FolderOpen className="h-8 w-8 text-muted-foreground" />
                  <span>Select Folder</span>
                </Button>
              </div>
              
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleZipSelect}
              />
              <input
                ref={folderInputRef}
                type="file"
                // @ts-ignore - webkitdirectory is non-standard but widely supported
                webkitdirectory=""
                directory=""
                multiple
                className="hidden"
                onChange={handleFolderSelect}
              />

              {/* Config file info */}
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-2">
                <p className="font-medium text-foreground">Supported config files:</p>
                <div className="flex items-center gap-2">
                  <FileJson className="h-3.5 w-3.5" />
                  <code className="bg-background px-1 rounded">_meta.json</code>
                  <span>- Per-folder ordering & titles</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileJson className="h-3.5 w-3.5" />
                  <code className="bg-background px-1 rounded">toc.yml</code>
                  <span>- GitBook/Mintlify style TOC</span>
                </div>
              </div>
            </>
          )}

          {/* Parsed preview */}
          {parsedImport && !importing && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  {parsedImport.files.length} files ready to import
                </div>
                <Button variant="ghost" size="sm" onClick={resetState}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {parsedImport.rootConfig && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                  <FileJson className="h-3.5 w-3.5" />
                  <span>Config file detected - using custom ordering</span>
                </div>
              )}

              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Smart structure
                  </div>
                  <Switch
                    checked={aiEnabled}
                    onCheckedChange={(checked) => {
                      setAiEnabled(checked);
                      if (!checked) {
                        setAnalysis(null);
                        setAnalysisError(null);
                      }
                    }}
                    disabled={analysisLoading}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Use AI to split imports into sub-projects and topics based on folder structure. Requires Gemini to be configured.
                </p>
                {aiEnabled && (
                  <div className="space-y-2 text-xs">
                    {analysisLoading && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Analyzing structure...
                      </div>
                    )}
                    {analysisError && (
                      <div className="text-destructive">
                        AI analysis failed: {analysisError}
                      </div>
                    )}
                    {analysisPreview?.preview?.length ? (
                      <div className="space-y-2">
                        {analysisPreview.preview.map((group) => (
                          <div key={group.key} className="rounded-md border bg-muted/30 p-2">
                            <div className="flex items-center justify-between text-sm font-medium">
                              <span>
                                {group.type === "subproject" ? "Subproject" : "Topic"}: {group.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {group.fileCount} files
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                              {group.samplePaths.map((path) => (
                                <div key={path} className="truncate">{path}</div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {plannedSummary ? (
                      <div className="text-xs text-muted-foreground">
                        Plan covers {plannedSummary.plannedFiles} files across {plannedSummary.plannedGroups} group(s).
                      </div>
                    ) : null}
                    {analysis?.notes?.length ? (
                      <ul className="list-disc pl-4 text-muted-foreground">
                        {analysis.notes.map((note, index) => (
                          <li key={index}>{note}</li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={runStructureAnalysis}
                        disabled={analysisLoading}
                      >
                        Re-analyze
                      </Button>
                      {analysis && !analysisLoading && !analysisError && (
                        <span className="text-muted-foreground">Plan ready.</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                {parsedImport.files.slice(0, 20).map((file, i) => (
                  <div key={i} className="px-3 py-2 text-sm flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{file.path}</span>
                    {file.order !== undefined && (
                      <span className="text-xs text-muted-foreground ml-auto">#{file.order + 1}</span>
                    )}
                  </div>
                ))}
                {parsedImport.files.length > 20 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    ... and {parsedImport.files.length - 20} more files
                  </div>
                )}
              </div>
              
              {parsedImport.errors.length > 0 && (
                <div className="bg-destructive/10 text-destructive text-xs rounded-lg p-2 space-y-2">
                  <p className="font-medium">{parsedImport.errors.length} file(s) couldn't be read</p>
                  <ul className="list-disc pl-4 space-y-1">
                    {parsedImport.errors.slice(0, 3).map((error, index) => (
                      <li key={`${index}-${error}`} className="break-words">{error}</li>
                    ))}
                  </ul>
                  {parsedImport.errors.length > 3 && (
                    <p className="text-destructive/80">
                      ...and {parsedImport.errors.length - 3} more
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Import in progress */}
          {importing && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">Starting background import...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You can close this dialog. Progress will appear in the corner.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={
              !parsedImport ||
              parsedImport.files.length === 0 ||
              importing ||
              (aiEnabled && (!analysis || analysisLoading))
            }
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              aiEnabled ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Import with Smart structure ({parsedImport?.files.length || 0})
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {parsedImport?.files.length || 0} files
                </>
              )
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
