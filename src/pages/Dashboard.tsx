/**
 * AccelDocs Dashboard — clean architecture rebuild.
 */

import { useState, useCallback, useMemo, useEffect, useRef, type ChangeEvent } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuthNew";
import { useToast } from "@/hooks/use-toast";
import { signInWithGoogle as startGoogleOAuth } from "@/lib/auth-new";

import { orgApi, sectionsApi, pagesApi, driveApi, buildSectionTree } from "@/api";
import type { Org, Section, Page, ImportTargetType } from "@/api/types";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  BookOpen,
  Circle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  Copy,
  ExternalLink,
  FileText,
  FolderOpen,
  FolderPlus,
  GripVertical,
  ListOrdered,
  Loader2,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  ArrowRightLeft,
  RefreshCw,
  Settings,
  Trash2,
  ArrowUpFromLine,
  GitBranchPlus,
  UserPlus,
  Users,
  Wifi,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { API_BASE_URL, getAuthToken } from "@/api/client";
import { ProjectSharePanel } from "@/components/dashboard/ProjectSharePanel";
import { InviteMemberDialog } from "@/components/dashboard/InviteMemberDialog";
import { WorkspaceSwitcher, setStoredOrgId, getStoredOrgId } from "@/components/dashboard/WorkspaceSwitcher";
import { TableOfContents } from "@/components/docs/TableOfContents";

type VisibilityLevel = "public" | "internal" | "external";
type VisibilityFilter = "all" | VisibilityLevel;
type LocalImportMode = "files" | "folder";

type DriveImportTarget = {
  id: number;
  name: string;
  type: ImportTargetType;
};

const visibilityOptions: Array<{ value: VisibilityLevel; label: string }> = [
  { value: "public", label: "Public" },
  { value: "internal", label: "Internal" },
  { value: "external", label: "External" },
];

const LOCAL_IMPORT_ACCEPT = ".md,.txt,.html,.htm,.doc,.docx,.pdf,.rtf";
const LOCAL_IMPORT_LABEL = ".md, .txt, .html, .htm, .doc, .docx, .pdf, .rtf";

const visibilityCompactBadgeClass: Record<VisibilityLevel, string> = {
  public: "bg-sky-500/10 text-sky-700 border-sky-200",
  internal: "bg-violet-500/10 text-violet-700 border-violet-200",
  external: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
};

function visibilityShortLabel(value: VisibilityLevel): string {
  if (value === "internal") return "I";
  if (value === "external") return "E";
  return "P";
}

function visibilityLabel(value: VisibilityLevel | null | undefined): string {
  if (value === "internal") return "Internal";
  if (value === "external") return "External";
  return "Public";
}

function resolveEffectivePageVisibility(page: Page, sectionsById: Map<number, Section>): VisibilityLevel {
  if (page.visibility_override) {
    return page.visibility_override as VisibilityLevel;
  }
  if (page.section_id) {
    const sectionVisibility = sectionsById.get(page.section_id)?.visibility;
    if (sectionVisibility === "internal" || sectionVisibility === "external" || sectionVisibility === "public") {
      return sectionVisibility;
    }
  }
  return "public";
}

// ---------------------------------------------------------------------------
// AddPageDialog
// ---------------------------------------------------------------------------

function parseGoogleDocId(input: string): string {
  const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input.trim();
}

function parseDriveFolderId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const pathMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (pathMatch?.[1]) return pathMatch[1];
  const queryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch?.[1]) return queryMatch[1];
  return trimmed;
}

function inferImportTargetType(section: Section): ImportTargetType {
  if (section.parent_id === null) return "product";
  if ((section.section_type ?? "section") === "version") return "version";
  if ((section.section_type ?? "section") === "tab") return "tab";
  return "section";
}

function importTargetTypeLabel(type: ImportTargetType): string {
  if (type === "product") return "Product";
  if (type === "version") return "Version";
  if (type === "tab") return "Tab";
  return "Section";
}

function AddPageDialog({ sectionId, onClose }: { sectionId: number | null; onClose: () => void }) {
  const [docId, setDocId] = useState("");
  const [title, setTitle] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const resolvedId = parseGoogleDocId(docId);

  const create = useMutation({
    mutationFn: () =>
      pagesApi.create({ google_doc_id: resolvedId, section_id: sectionId, title: title.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      toast({ title: "Page added" });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Add page</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Title <span className="normal-case font-normal text-muted-foreground/60">(required when creating a new doc)</span>
            </Label>
            <Input
              placeholder="Page title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Google Doc URL or ID <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
            </Label>
            <Input
              placeholder="Leave blank to create a new Google Doc"
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              className="text-sm"
            />
            {resolvedId && resolvedId !== docId && (
              <p className="text-xs text-emerald-600">ID: {resolvedId}</p>
            )}
            {!docId && (
              <p className="text-xs text-muted-foreground">A blank Google Doc will be created in your Drive.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={(!resolvedId && !title.trim()) || create.isPending} onClick={() => create.mutate()}>
            {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            {resolvedId ? "Add page" : "Create page"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// ScanDriveDialog
// ---------------------------------------------------------------------------

function ScanDriveDialog({
  onClose,
  onSuccess,
  rootFolderId,
  driveConnected,
  canManageDrive,
  target,
  allSections,
}: {
  onClose: () => void;
  onSuccess: () => void;
  rootFolderId: string | null;
  driveConnected: boolean;
  canManageDrive: boolean;
  target: DriveImportTarget | null;
  allSections: Section[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const resolvedRootFolderId = (rootFolderId || "").trim();
  const [source, setSource] = useState<"drive" | "local">("drive");
  const [driveFolderInput, setDriveFolderInput] = useState("");
  const [localMode, setLocalMode] = useState<LocalImportMode>("files");
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [relativePaths, setRelativePaths] = useState<string[]>([]);
  const [localTargetId, setLocalTargetId] = useState<number | null>(target?.id ?? null);
  const filesInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const sectionsById = useMemo(() => new Map(allSections.map((section) => [section.id, section])), [allSections]);
  const destinationOptions = useMemo(() => {
    const buildPath = (section: Section): string => {
      const parts = [section.name];
      const seen = new Set<number>([section.id]);
      let parentId = section.parent_id;
      while (parentId !== null) {
        if (seen.has(parentId)) break;
        seen.add(parentId);
        const parent = sectionsById.get(parentId);
        if (!parent) break;
        parts.unshift(parent.name);
        parentId = parent.parent_id;
      }
      return parts.join(" / ");
    };

    return allSections
      .map((section) => ({
        id: section.id,
        name: section.name,
        type: inferImportTargetType(section),
        path: buildPath(section),
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [allSections, sectionsById]);
  const defaultLocalTargetId = useMemo(() => {
    const preferred = destinationOptions.find((option) => option.type === "section");
    return preferred?.id ?? destinationOptions[0]?.id ?? null;
  }, [destinationOptions]);
  const selectedLocalTarget = useMemo(
    () => destinationOptions.find((option) => option.id === localTargetId) ?? null,
    [destinationOptions, localTargetId],
  );
  const localImportTarget = target ?? selectedLocalTarget;

  useEffect(() => {
    if (target) {
      setDriveFolderInput("");
      setSource("drive");
      setLocalTargetId(target.id);
    } else {
      setDriveFolderInput(resolvedRootFolderId);
      setLocalTargetId((prev) => {
        if (prev !== null && destinationOptions.some((option) => option.id === prev)) return prev;
        return defaultLocalTargetId;
      });
    }
    setLocalFiles([]);
    setRelativePaths([]);
  }, [target, resolvedRootFolderId, defaultLocalTargetId, destinationOptions]);

  useEffect(() => {
    const node = folderInputRef.current;
    if (!node) return;
    node.setAttribute("webkitdirectory", "");
    node.setAttribute("directory", "");
  }, []);

  const rootFolderMissing = !resolvedRootFolderId;
  const parsedDriveFolderId = parseDriveFolderId(driveFolderInput);
  const canConfigureRootFolder = !rootFolderMissing || canManageDrive;
  const canImportDriveFolder = target
    ? !!parsedDriveFolderId
    : (rootFolderMissing ? !!parsedDriveFolderId && canConfigureRootFolder : !!resolvedRootFolderId);
  const localImportNeedsTarget = source === "local" && localImportTarget === null;
  const localFilesRequireSectionTarget =
    source === "local" && localMode === "files" && localImportTarget !== null && localImportTarget.type !== "section";

  const scanFromDrive = useMutation({
    mutationFn: async () => {
      if (!driveConnected) {
        throw new Error("Connect Drive and set a root folder before importing.");
      }
      if (target) {
        if (!parsedDriveFolderId) {
          throw new Error("Paste a Google Drive folder URL or ID to import into this destination.");
        }
        return driveApi.scan(parsedDriveFolderId, target.id, target.type);
      }
      if (!canConfigureRootFolder) {
        throw new Error("Only workspace owner/admin can configure the Drive root folder.");
      }
      if (!resolvedRootFolderId && !parsedDriveFolderId) {
        throw new Error("Paste a Google Drive folder URL or ID to configure the workspace root.");
      }
      return driveApi.scan(resolvedRootFolderId || parsedDriveFolderId);
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["sections"] });
      qc.invalidateQueries({ queryKey: ["pages"] });
      toast({
        title: "Import complete",
        description: target
          ? `${result.sections_created} sections, ${result.pages_created} pages imported into ${target.name}`
          : `${result.sections_created} sections, ${result.pages_created} pages from "${result.folder_name}"`,
      });
      onClose();
      onSuccess();
    },
    onError: (err: Error) => toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  const importLocal = useMutation({
    mutationFn: async () => {
      if (!driveConnected) throw new Error("Connect Drive before importing local files.");
      if (!localImportTarget) throw new Error("Choose a destination before importing local files.");
      if (!localFiles.length) throw new Error("Select at least one file to import.");
      return driveApi.importLocal({
        targetSectionId: localImportTarget.id,
        targetType: localImportTarget.type,
        mode: localMode,
        files: localFiles,
        relativePaths: localMode === "folder" ? relativePaths : localFiles.map((file) => file.name),
      });
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["sections"] });
      qc.invalidateQueries({ queryKey: ["pages"] });
      toast({
        title: "Local import complete",
        description: `${result.uploaded_files} file(s), ${result.sections_created} sections, ${result.pages_created} pages in ${localImportTarget?.name ?? "selected destination"}`,
      });
      onClose();
      onSuccess();
    },
    onError: (err: Error) => toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>, mode: LocalImportMode) => {
    const selected = Array.from(event.target.files ?? []);
    setLocalMode(mode);
    setLocalFiles(selected);
    if (mode === "folder") {
      const paths = selected.map((file) => {
        const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
        return (rel && rel.trim()) ? rel : file.name;
      });
      setRelativePaths(paths);
    } else {
      setRelativePaths(selected.map((file) => file.name));
    }
  };

  const isPending = scanFromDrive.isPending || importLocal.isPending;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Import content</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {target ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Destination</p>
              <p className="text-sm font-medium mt-1">{target.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Type: {importTargetTypeLabel(target.type)}
              </p>
            </div>
          ) : source === "local" ? (
            <div className="space-y-1.5 rounded-md border bg-muted/30 px-3 py-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Destination</Label>
              {destinationOptions.length === 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Create a Product, Tab, or Section first. Then import local content into it.
                </div>
              ) : (
                <>
                  <Select
                    value={localTargetId !== null ? String(localTargetId) : undefined}
                    onValueChange={(value) => setLocalTargetId(Number(value))}
                  >
                    <SelectTrigger className="h-9 text-sm bg-background">
                      <SelectValue placeholder="Choose destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {destinationOptions.map((option) => (
                        <SelectItem key={option.id} value={String(option.id)}>
                          <span className="truncate">{option.path} ({importTargetTypeLabel(option.type)})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Files import into a Section. Folder import supports Product, Tab, or Section destinations.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Destination</p>
              <p className="text-sm font-medium mt-1">Workspace root</p>
              <p className="text-xs text-muted-foreground mt-0.5">Use this for first-time onboarding imports.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Import source</Label>
            <div className="inline-flex rounded-md border p-0.5 bg-muted/20">
              <button
                type="button"
                onClick={() => setSource("drive")}
                className={cn(
                  "px-3 py-1 text-xs rounded transition-colors",
                  source === "drive" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Google Drive folder
              </button>
              <button
                type="button"
                onClick={() => setSource("local")}
                className={cn(
                  "px-3 py-1 text-xs rounded transition-colors",
                  source === "local" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                From computer
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {source === "drive"
                ? "Google Drive import syncs Google Docs found in the selected folder tree."
                : `From computer supports: ${LOCAL_IMPORT_LABEL}`}
            </p>
          </div>

          {source === "drive" ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {target
                  ? "Drive folder URL or ID"
                  : rootFolderMissing
                    ? "Root folder URL or ID"
                    : "Connected root folder"}
              </Label>
              {target || rootFolderMissing ? (
                <>
                  <Input
                    value={driveFolderInput}
                    onChange={(e) => setDriveFolderInput(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/..."
                    className="text-sm"
                    disabled={rootFolderMissing && !canManageDrive}
                  />
                  {parsedDriveFolderId && parsedDriveFolderId !== driveFolderInput.trim() && (
                    <p className="text-xs text-emerald-600">Folder ID: {parsedDriveFolderId}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {target
                      ? "The selected Drive folder will be moved under this destination before syncing."
                      : "This folder will be saved as the workspace root and imported."}
                  </p>
                  {rootFolderMissing && !canManageDrive && (
                    <p className="text-xs text-amber-700">
                      Root folder can only be configured by workspace owner/admin.
                    </p>
                  )}
                </>
              ) : (
                <div className="rounded-md border bg-background px-3 py-2 font-mono text-xs text-muted-foreground break-all">
                  {resolvedRootFolderId || "No root folder configured"}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="inline-flex rounded-md border p-0.5 bg-muted/20">
                <button
                  type="button"
                  onClick={() => setLocalMode("files")}
                  className={cn(
                    "px-3 py-1 text-xs rounded transition-colors",
                    localMode === "files" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Files
                </button>
                <button
                  type="button"
                  onClick={() => setLocalMode("folder")}
                  className={cn(
                    "px-3 py-1 text-xs rounded transition-colors",
                    localMode === "folder" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Folder
                </button>
              </div>

              {localImportNeedsTarget ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Choose a destination above to import local content.
                </div>
              ) : localFilesRequireSectionTarget ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  File import requires a <span className="font-semibold">Section</span> destination. Choose Folder mode for Product/Tab imports.
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => filesInputRef.current?.click()}
                    >
                      <ArrowUpFromLine className="h-3.5 w-3.5 mr-1.5" />
                      Select files
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => folderInputRef.current?.click()}
                    >
                      <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                      Select folder
                    </Button>
                  </div>
                  <input
                    ref={filesInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept={LOCAL_IMPORT_ACCEPT}
                    onChange={(event) => handleFilesSelected(event, "files")}
                  />
                  <input
                    ref={folderInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept={LOCAL_IMPORT_ACCEPT}
                    onChange={(event) => handleFilesSelected(event, "folder")}
                  />
                  <div className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground max-h-36 overflow-auto">
                    {localFiles.length === 0 ? (
                      <span>No files selected.</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {(localMode === "folder" ? relativePaths : localFiles.map((file) => file.name))
                          .slice(0, 12)
                          .map((name, idx) => (
                            <li key={`${name}-${idx}`} className="truncate">{name}</li>
                          ))}
                        {localFiles.length > 12 && (
                          <li className="text-[11px] text-muted-foreground/70">+{localFiles.length - 12} more</li>
                        )}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            disabled={
              !driveConnected ||
              isPending ||
              (source === "drive"
                ? !canImportDriveFolder
                : localImportNeedsTarget || localFilesRequireSectionTarget || localFiles.length === 0)
            }
            onClick={() => {
              if (source === "drive") scanFromDrive.mutate();
              else importLocal.mutate();
            }}
          >
            {isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              : source === "drive"
                ? <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                : <ArrowUpFromLine className="h-3.5 w-3.5 mr-1.5" />}
            {source === "drive" ? "Import from Drive" : "Import from computer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// ConfigureTabsDialog
// ---------------------------------------------------------------------------

function ConfigureTabsDialog({
  sections,
  hierarchyMode: initialHierarchyMode,
  onClose,
}: {
  sections: Section[];
  hierarchyMode: "product" | "flat";
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const products = useMemo(
    () =>
      sections
        .filter((s) => s.parent_id === null)
        .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)),
    [sections],
  );

  const secondLevelSections = useMemo(
    () =>
      sections
        .filter((s) => s.parent_id !== null && products.some((p) => p.id === s.parent_id))
        .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)),
    [sections, products],
  );

  const [hierarchyMode, setHierarchyMode] = useState<"product" | "flat">(initialHierarchyMode);
  const [selectedTabIds, setSelectedTabIds] = useState<Set<number>>(
    () => new Set(sections.filter((s) => (s.section_type ?? "section") === "tab").map((s) => s.id)),
  );
  const hierarchyModeChanged = hierarchyMode !== initialHierarchyMode;

  const setTabEnabled = (sectionId: number, isTab: boolean) => {
    setSelectedTabIds((prev) => {
      const next = new Set(prev);
      if (isTab) next.add(sectionId);
      else next.delete(sectionId);
      return next;
    });
  };

  const changesPending = useMemo(
    () => {
      const configurableSections = hierarchyMode === "flat" ? products : secondLevelSections;
      const sectionChanges = configurableSections.reduce((count, section) => {
        const currentType = (section.section_type ?? "section");
        const nextType: "section" | "tab" = selectedTabIds.has(section.id) ? "tab" : "section";
        return count + (currentType !== nextType ? 1 : 0);
      }, 0);
      return sectionChanges + (hierarchyModeChanged ? 1 : 0);
    },
    [hierarchyMode, hierarchyModeChanged, products, secondLevelSections, selectedTabIds],
  );

  const setProductChildrenAsTabs = (productId: number, makeTabs: boolean) => {
    const childIds = secondLevelSections
      .filter((s) => s.parent_id === productId)
      .map((s) => s.id);
    setSelectedTabIds((prev) => {
      const next = new Set(prev);
      for (const childId of childIds) {
        if (makeTabs) next.add(childId);
        else next.delete(childId);
      }
      return next;
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      const updates: Promise<Section>[] = [];
      const configurableSections = hierarchyMode === "flat" ? products : secondLevelSections;
      const sectionsToNormalize =
        hierarchyMode === "flat"
          ? secondLevelSections.filter((s) => (s.section_type ?? "section") === "tab")
          : products.filter((s) => (s.section_type ?? "section") === "tab");

      for (const section of configurableSections) {
        const desiredType: "section" | "tab" = selectedTabIds.has(section.id) ? "tab" : "section";
        if ((section.section_type ?? "section") !== desiredType) {
          updates.push(sectionsApi.update(section.id, { section_type: desiredType }));
        }
      }

      // Keep invalid levels normalized when switching modes:
      // flat mode: only top-level sections can be tabs
      // product mode: only second-level sections can be tabs
      for (const section of sectionsToNormalize) {
        updates.push(sectionsApi.update(section.id, { section_type: "section" }));
      }

      if (hierarchyModeChanged) {
        await orgApi.update({ hierarchy_mode: hierarchyMode });
      }

      if (updates.length === 0) return 0;
      await Promise.all(updates);
      return updates.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["org"] });
      qc.invalidateQueries({ queryKey: ["sections"] });
      toast({
        title: count > 0 || hierarchyModeChanged ? "Hierarchy updated" : "No changes",
        description:
          count > 0 || hierarchyModeChanged
            ? `${count} section${count === 1 ? "" : "s"} updated${hierarchyModeChanged ? `, mode set to ${hierarchyMode}.` : "."}`
            : "Your hierarchy is already configured.",
      });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">Configure hierarchy</DialogTitle>
          <p className="text-xs text-muted-foreground pt-0.5 leading-relaxed">
            Choose whether docs are grouped by product or rendered as one flat doc set.
          </p>
        </DialogHeader>
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <div className="mb-2 flex items-center gap-2">
            <Button
              variant={hierarchyMode === "product" ? "default" : "outline"}
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setHierarchyMode("product")}
            >
              By product
            </Button>
            <Button
              variant={hierarchyMode === "flat" ? "default" : "outline"}
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setHierarchyMode("flat")}
            >
              Flat
            </Button>
          </div>
          <p>
            {hierarchyMode === "product" ? (
              <>
                Structure model: <span className="font-medium text-foreground/80">Product</span> →
                <span className="font-medium text-foreground/80"> optional Tab</span> →
                <span className="font-medium text-foreground/80"> Section</span> → Page.
              </>
            ) : (
              <>
                Structure model: <span className="font-medium text-foreground/80">Section</span> →
                <span className="font-medium text-foreground/80"> optional Tab</span> → Page.
              </>
            )}
          </p>
          <p className="mt-1">
            {hierarchyMode === "product"
              ? "Only second-level folders can be tabs."
              : "Only top-level folders can be tabs."} Leave all unchecked for a simple sidebar-only layout.
          </p>
        </div>
        <div className="space-y-4 py-1 max-h-[60vh] overflow-y-auto pr-1">

          {hierarchyMode === "product" ? (
            products.length === 0 ? (
              <div className="text-sm text-muted-foreground">No products found yet. Import a Drive root folder first.</div>
            ) : (
            products.map((product) => {
              const children = secondLevelSections.filter((s) => s.parent_id === product.id);
              const selectedTabs = children.filter((c) => selectedTabIds.has(c.id));
              return (
                <div key={product.id} className="rounded-lg border">
                  <div className="px-4 py-2.5 border-b bg-muted/30 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{product.name}</div>
                        <div className="text-xs text-muted-foreground">{children.length} folder(s)</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() => setProductChildrenAsTabs(product.id, false)}
                          disabled={children.length === 0}
                        >
                          Clear all
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() => setProductChildrenAsTabs(product.id, true)}
                          disabled={children.length === 0}
                        >
                          Select all
                        </Button>
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center flex-wrap gap-1.5">
                      <span>Top tabs:</span>
                      {selectedTabs.length > 0 ? (
                        selectedTabs.map((tab) => (
                          <Badge key={tab.id} variant="secondary" className="h-5 px-2 text-[10px] font-medium">
                            {tab.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="font-medium text-foreground/80">None</span>
                      )}
                    </div>
                  </div>
                  <div className="p-2 space-y-2">
                    {children.length === 0 ? (
                      <div className="px-2 py-2 text-xs text-muted-foreground">No second-level sections yet.</div>
                    ) : (
                      children.map((child) => {
                        const selected = selectedTabIds.has(child.id);
                        return (
                          <label
                            key={child.id}
                            className="w-full flex items-center gap-3 rounded-md border px-3 py-2 hover:bg-accent/30 cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={selected}
                              onCheckedChange={(checked) => setTabEnabled(child.id, !!checked)}
                            />
                            <div className="min-w-0">
                              <p className="text-sm truncate">{child.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {selected
                                  ? "Shown in top tabs"
                                  : "Shown in sidebar only"}
                              </p>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })
            )
          ) : (
            <div className="rounded-lg border">
              <div className="px-4 py-2.5 border-b bg-muted/30 space-y-1">
                <div className="text-sm font-semibold">Top-level sections</div>
                <div className="text-xs text-muted-foreground">
                  Mark a section as <span className="font-medium text-foreground/80">Top tab</span> to show it in horizontal navigation.
                </div>
              </div>
              <div className="p-2 space-y-2">
                {products.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-muted-foreground">No top-level sections yet.</div>
                ) : (
                  products.map((section) => {
                    const selected = selectedTabIds.has(section.id);
                    return (
                      <label
                        key={section.id}
                        className="w-full flex items-center gap-3 rounded-md border px-3 py-2 hover:bg-accent/30 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={selected}
                          onCheckedChange={(checked) => setTabEnabled(section.id, !!checked)}
                        />
                        <div className="min-w-0">
                          <p className="text-sm truncate">{section.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {selected ? "Shown in top tabs" : "Shown in sidebar only"}
                          </p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <span className="text-xs text-muted-foreground mr-2">
            {changesPending} change{changesPending === 1 ? "" : "s"} pending
          </span>
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Save hierarchy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceSettingsDialog({
  org,
  onClose,
}: {
  org: Org;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [workspaceName, setWorkspaceName] = useState(org.name ?? "");
  const [customDomain, setCustomDomain] = useState(org.custom_docs_domain ?? "");

  const save = useMutation({
    mutationFn: async () =>
      orgApi.update({
        name: workspaceName.trim(),
        custom_docs_domain: customDomain.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org"] });
      qc.invalidateQueries({ queryKey: ["org", org.id] });
      qc.invalidateQueries({ queryKey: ["org-list"] });
      toast({ title: "Workspace settings saved" });
      onClose();
    },
    onError: (err: Error) =>
      toast({
        title: "Update failed",
        description: err.message,
        variant: "destructive",
      }),
  });

  const canSave = workspaceName.trim().length > 0 && !save.isPending;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Workspace settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Workspace name
            </Label>
            <Input
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="My Workspace"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Custom docs domain
            </Label>
            <Input
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value.toLowerCase())}
              placeholder="docs.example.com"
            />
            <p className="text-xs text-muted-foreground">
              Optional. Leave empty to use default docs URL.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={!canSave}>
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// AddSectionDialog
// ---------------------------------------------------------------------------

function AddSectionDialog({
  parentId,
  allSections,
  hierarchyMode,
  preferredType,
  cloneFromSectionId,
  onClose,
}: {
  parentId?: number | null;
  allSections: Section[];
  hierarchyMode: "product" | "flat";
  preferredType?: "section" | "tab" | "version";
  cloneFromSectionId?: number | null;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [sectionType, setSectionType] = useState<"section" | "tab" | "version">(preferredType ?? "section");
  const [visibility, setVisibility] = useState<VisibilityLevel>("public");
  const { toast } = useToast();
  const qc = useQueryClient();
  const parentMap = useMemo(() => new Map(allSections.map((s) => [s.id, s.parent_id])), [allSections]);

  const getDepth = useCallback((id: number | null | undefined): number => {
    if (!id) return 0;
    let depth = 0;
    let cursor: number | null | undefined = id;
    while (cursor) {
      const parent = parentMap.get(cursor);
      if (parent == null) break;
      depth += 1;
      cursor = parent;
    }
    return depth;
  }, [parentMap]);

  const isRootCreate = parentId == null;
  const parentDepth = getDepth(parentId);
  const isProductMode = hierarchyMode === "product";
  const canCreateTab = isProductMode ? (!isRootCreate && parentDepth === 0) : isRootCreate;
  const canCreateVersion = isProductMode && !isRootCreate && parentDepth === 0;

  useEffect(() => {
    setSectionType(preferredType ?? "section");
  }, [preferredType, parentId]);

  useEffect(() => {
    if (!canCreateTab && sectionType === "tab") {
      setSectionType("section");
      return;
    }
    if (!canCreateVersion && sectionType === "version") {
      setSectionType("section");
    }
  }, [canCreateTab, canCreateVersion, sectionType]);

  const create = useMutation({
    mutationFn: () =>
      sectionsApi.create({
        name: name.trim(),
        parent_id: parentId ?? null,
        section_type: isRootCreate ? (isProductMode ? "section" : sectionType) : sectionType,
        visibility,
        clone_from_section_id: !isRootCreate && sectionType === "version" ? (cloneFromSectionId ?? null) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sections"] });
      const createdLabel = isRootCreate
        ? (isProductMode ? "Product" : sectionType === "tab" ? "Tab" : sectionType === "version" ? "Version" : "Section")
        : sectionType === "tab"
          ? "Tab"
          : sectionType === "version"
            ? "Version"
          : "Section";
      toast({ title: `${createdLabel} created` });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">
            {isRootCreate
              ? (isProductMode ? "New product" : "New section")
              : canCreateTab
                ? "New item"
                : "New section"}
          </DialogTitle>
        </DialogHeader>
        <div className="py-1">
          <div className="space-y-3">
            <Input
              placeholder={
                isRootCreate
                  ? (isProductMode ? "Product name" : "Section name")
                  : sectionType === "version"
                    ? "Version name (e.g. v1.0)"
                    : "Section name"
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && name.trim() && create.mutate()}
            />
            {isRootCreate ? (
              <p className="text-xs text-muted-foreground">
                {isProductMode
                  ? "Products render as top-level entries and can contain optional tabs and sections."
                  : "Top-level sections render directly in docs. You can convert a section to Tab from its action menu if needed."}
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select value={sectionType} onValueChange={(v) => setSectionType(v as "section" | "tab" | "version")}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="section">Section</SelectItem>
                    {canCreateTab && <SelectItem value="tab">Tab</SelectItem>}
                    {canCreateVersion && <SelectItem value="version">Version</SelectItem>}
                  </SelectContent>
                </Select>
                {(!canCreateTab || !canCreateVersion) && (
                  <p className="text-[11px] text-muted-foreground">
                    {isProductMode
                      ? "Tabs/versions are allowed only directly under a product."
                      : "Tabs are allowed only at the top level in flat mode."}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Visibility</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as VisibilityLevel)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {visibilityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// RenameDialog (sections + pages)
// ---------------------------------------------------------------------------

function RenameDialog({ label, initialValue, onSave, onClose }: {
  label: string;
  initialValue: string;
  onSave: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Rename {label}</DialogTitle>
        </DialogHeader>
        <div className="py-1">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && value.trim() && onSave(value.trim())}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!value.trim() || value.trim() === initialValue} onClick={() => onSave(value.trim())}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// MoveSectionDialog
// ---------------------------------------------------------------------------

function MoveSectionDialog({ section, allSections, onClose }: {
  section: Section;
  allSections: Section[];
  onClose: () => void;
}) {
  const [parentId, setParentId] = useState<string>(section.parent_id?.toString() ?? "none");
  const { toast } = useToast();
  const qc = useQueryClient();

  const getDescendantIds = (id: number): Set<number> => {
    const ids = new Set<number>([id]);
    allSections.filter((s) => s.parent_id === id).forEach((s) => {
      getDescendantIds(s.id).forEach((d) => ids.add(d));
    });
    return ids;
  };
  const excluded = getDescendantIds(section.id);
  const candidates = allSections.filter((s) => !excluded.has(s.id));
  const unchanged = parentId === (section.parent_id?.toString() ?? "none");

  const move = useMutation({
    mutationFn: () =>
      sectionsApi.update(section.id, { parent_id: parentId === "none" ? null : parseInt(parentId) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sections"] });
      toast({ title: "Section moved" });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Move "{section.name}"</DialogTitle>
        </DialogHeader>
        <div className="py-1 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Move under</Label>
          <Select value={parentId} onValueChange={setParentId}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Top level (no parent)</SelectItem>
              {candidates.map((s) => (
                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={unchanged || move.isPending} onClick={() => move.mutate()}>
            {move.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovePageDialog({ page, allSections, allPages, onClose }: {
  page: Page;
  allSections: Section[];
  allPages: Page[];
  onClose: () => void;
}) {
  const [sectionId, setSectionId] = useState<string>(page.section_id?.toString() ?? "none");
  const { toast } = useToast();
  const qc = useQueryClient();

  const unchanged = sectionId === (page.section_id?.toString() ?? "none");
  const move = useMutation({
    mutationFn: () => {
      const nextSectionId = sectionId === "none" ? null : parseInt(sectionId, 10);
      const targetOrder =
        allPages.filter((p) => p.id !== page.id && p.section_id === nextSectionId).length;
      return pagesApi.update(page.id, { section_id: nextSectionId, display_order: targetOrder });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      toast({ title: "Page moved" });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Move failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Move "{page.title}"</DialogTitle>
        </DialogHeader>
        <div className="py-1 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Move to section</Label>
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Top level (no section)</SelectItem>
              {allSections.map((s) => (
                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={unchanged || move.isPending} onClick={() => move.mutate()}>
            {move.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PageActionsMenu({
  page,
  onEditTitle,
  onEditSlug,
  onMove,
  onRearrange,
  onSetVisibilityOverride,
  onDuplicate,
  onUnpublish,
  onDelete,
}: {
  page: Page;
  onEditTitle: (page: Page) => void;
  onEditSlug: (page: Page) => void;
  onMove: (page: Page) => void;
  onRearrange: (page: Page) => void;
  onSetVisibilityOverride: (page: Page, visibility: VisibilityLevel | null) => void;
  onDuplicate: (page: Page) => void;
  onUnpublish: (page: Page) => void;
  onDelete: (page: Page) => void;
}) {
  const currentOverride = page.visibility_override ?? null;
  return (
    <DropdownMenuContent align="end" className="w-44">
      <DropdownMenuItem onClick={() => onEditTitle(page)}>
        <Pencil className="h-3 w-3 mr-2" /> Edit Title
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onEditSlug(page)}>
        <Pencil className="h-3 w-3 mr-2" /> Edit URL slug
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onMove(page)}>
        <ArrowRightLeft className="h-3 w-3 mr-2" /> Move
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onRearrange(page)}>
        <ListOrdered className="h-3 w-3 mr-2" /> Re-arrange
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => onSetVisibilityOverride(page, null)}>
        {currentOverride === null ? "✓ " : ""}Use section visibility
      </DropdownMenuItem>
      {visibilityOptions.map((opt) => (
        <DropdownMenuItem key={opt.value} onClick={() => onSetVisibilityOverride(page, opt.value)}>
          {currentOverride === opt.value ? "✓ " : ""}{opt.label}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => onDuplicate(page)}>
        <Copy className="h-3 w-3 mr-2" /> Duplicate
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={!page.is_published}
        className={cn(!page.is_published && "opacity-50")}
        onClick={() => onUnpublish(page)}
      >
        <Circle className="h-2.5 w-2.5 mr-2 fill-red-500 text-red-500" /> Unpublish
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="text-destructive" onClick={() => onDelete(page)}>
        <Trash2 className="h-3 w-3 mr-2" /> Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}

// ---------------------------------------------------------------------------
// PageItem — sortable
// ---------------------------------------------------------------------------

function PageItem({
  page,
  visibility,
  showVisibilityBadge,
  selectedPageId,
  onSelect,
  onEditTitle,
  onEditSlug,
  onMove,
  onRearrange,
  onSetVisibilityOverride,
  onDuplicate,
  onUnpublish,
  onDelete,
}: {
  page: Page;
  visibility: VisibilityLevel;
  showVisibilityBadge: boolean;
  selectedPageId: number | null;
  onSelect: (id: number) => void;
  onEditTitle: (page: Page) => void;
  onEditSlug: (page: Page) => void;
  onMove: (page: Page) => void;
  onRearrange: (page: Page) => void;
  onSetVisibilityOverride: (page: Page, visibility: VisibilityLevel | null) => void;
  onDuplicate: (page: Page) => void;
  onUnpublish: (page: Page) => void;
  onDelete: (page: Page) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `page-${page.id}`,
    data: { type: "page", pageId: page.id, sectionId: page.section_id },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="group relative flex items-center"
    >
      <button
        {...listeners} {...attributes}
        className="shrink-0 p-0.5 ml-1 opacity-0 group-hover:opacity-30 hover:!opacity-60 cursor-grab active:cursor-grabbing touch-none"
        tabIndex={-1}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </button>
      <button
        onClick={() => onSelect(page.id)}
        className={cn(
          "flex items-center flex-1 min-w-0 gap-2 py-1.5 pl-1 pr-7 rounded-md text-sm transition-all",
          selectedPageId === page.id
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
        )}
      >
        <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span className="truncate flex-1 text-left">{page.title}</span>
        {showVisibilityBadge && (
          <Badge
            variant="outline"
            className={cn(
              "h-4 min-w-4 px-1 text-[9px] font-semibold uppercase tracking-normal justify-center",
              visibilityCompactBadgeClass[visibility],
            )}
            title={`${visibilityLabel(visibility)} visibility`}
          >
            {visibilityShortLabel(visibility)}
          </Badge>
        )}
        {page.is_published && (
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
              page.status === "published"
                ? "bg-emerald-500/10 text-emerald-700"
                : "bg-amber-500/10 text-amber-700",
            )}
            title={page.status === "published" ? "Published" : "Changes pending"}
          >
            {page.status === "published" ? "Live" : "Sync"}
          </span>
        )}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <PageActionsMenu
          page={page}
          onEditTitle={onEditTitle}
          onEditSlug={onEditSlug}
          onMove={onMove}
          onRearrange={onRearrange}
          onSetVisibilityOverride={onSetVisibilityOverride}
          onDuplicate={onDuplicate}
          onUnpublish={onUnpublish}
          onDelete={onDelete}
        />
      </DropdownMenu>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionNode — sortable + nest-droppable header
// ---------------------------------------------------------------------------

function SectionNode({
  section, pages, selectedPageId, onSelectPage, depth,
  onAddPage, onAddSubSection, onImportHere, onRenameSection, onMoveSection, onDeleteSection, onChangeSectionType, onSetSectionVisibility, onRenamePage, onEditPageSlug, onMovePage, onSetPageVisibilityOverride, onDuplicatePage, onUnpublishPage, onRearrangePage, onDeletePage,
  activeDragType,
  hierarchyMode,
}: {
  section: Section;
  pages: Page[];
  selectedPageId: number | null;
  onSelectPage: (id: number) => void;
  depth: number;
  onAddPage: (sectionId: number) => void;
  onAddSubSection: (parentId: number) => void;
  onImportHere: (section: Section) => void;
  onRenameSection: (section: Section) => void;
  onMoveSection: (section: Section) => void;
  onDeleteSection: (section: Section) => void;
  onChangeSectionType: (section: Section, sectionType: "section" | "tab" | "version") => void;
  onSetSectionVisibility: (section: Section, visibility: VisibilityLevel) => void;
  onRenamePage: (page: Page) => void;
  onEditPageSlug: (page: Page) => void;
  onMovePage: (page: Page) => void;
  onSetPageVisibilityOverride: (page: Page, visibility: VisibilityLevel | null) => void;
  onDuplicatePage: (page: Page) => void;
  onUnpublishPage: (page: Page) => void;
  onRearrangePage: (page: Page) => void;
  onDeletePage: (page: Page) => void;
  activeDragType: "page" | "section" | null;
  hierarchyMode: "product" | "flat";
}) {
  const [open, setOpen] = useState(true);
  const sectionPages = pages.filter((p) => p.section_id === section.id);
  const pageIds = sectionPages.map((p) => `page-${p.id}`);

  // Sortable: for reordering sections among siblings
  const {
    attributes: sortAttrs,
    listeners: sortListeners,
    setNodeRef: setSortRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `sect-${section.id}`,
    data: { type: "section", sectionId: section.id, parentId: section.parent_id },
  });

  // Droppable: separate zone on the header to accept drops (page moves + section nesting)
  const { isOver: isNestOver, setNodeRef: setNestRef } = useDroppable({
    id: `nest-${section.id}`,
    data: { type: "section-nest", targetId: section.id },
  });

  const showDropHighlight = isNestOver && activeDragType !== null;
  const isProductMode = hierarchyMode === "product";
  const isTabEligibleLevel = isProductMode ? depth === 1 || depth === 2 : depth === 0;
  const isVersionEligibleLevel = isProductMode ? depth === 1 : false;
  const sectionType = section.section_type ?? "section";
  const hierarchyLabel = isProductMode
    ? (
      depth === 0
        ? "Product"
        : sectionType === "version"
          ? "Version"
          : isTabEligibleLevel && sectionType === "tab"
          ? "Tab"
          : "Section"
    )
    : (
      isTabEligibleLevel && sectionType === "tab"
        ? "Tab"
        : "Section"
    );
  const hierarchyBadgeClass =
    isProductMode && depth === 0
      ? "bg-sky-500/10 text-sky-700 border-sky-200"
      : hierarchyLabel === "Version"
        ? "bg-indigo-500/10 text-indigo-700 border-indigo-200"
      : hierarchyLabel === "Tab"
        ? "bg-violet-500/10 text-violet-700 border-violet-200"
        : "bg-muted text-muted-foreground border-border";
  const currentSectionVisibility = (section.visibility ?? "public") as VisibilityLevel;
  const showHierarchyBadge = depth === 0 || hierarchyLabel === "Tab" || hierarchyLabel === "Version";
  const showSectionVisibilityBadge = currentSectionVisibility !== "public";
  const canSetTab = sectionType === "tab" || isTabEligibleLevel;
  const canSetVersion = sectionType === "version" || isVersionEligibleLevel;

  return (
    <div
      ref={setSortRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={cn(depth > 0 && "ml-2 border-l border-border/40 pl-1")}
    >
      {/* Section header row */}
      <div
        ref={setNestRef}
        className={cn(
          "group flex items-center w-full gap-1 py-0.5 rounded-md hover:bg-accent/50 transition-colors",
          showDropHighlight && "ring-2 ring-primary/40 bg-primary/5 rounded-md",
        )}
      >
        {/* Drag handle */}
        <button
          {...sortListeners} {...sortAttrs}
          className="shrink-0 p-0.5 opacity-0 group-hover:opacity-30 hover:!opacity-60 cursor-grab active:cursor-grabbing touch-none"
          tabIndex={-1}
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </button>

        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex items-center flex-1 min-w-0 gap-1.5 py-1 pr-1 rounded-md",
            depth === 0 ? "text-sm font-semibold text-foreground" : "text-sm font-medium text-muted-foreground hover:text-foreground",
          )}
        >
          {open
            ? <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
            : <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
          }
          <span className="truncate">{section.name}</span>
          {showHierarchyBadge && (
            <Badge
              variant="outline"
              className={cn("h-4 px-1.5 text-[9px] font-semibold uppercase tracking-wide", hierarchyBadgeClass)}
            >
              {hierarchyLabel}
            </Badge>
          )}
          {showSectionVisibilityBadge && (
            <Badge
              variant="outline"
              className={cn(
                "h-4 min-w-4 px-1 text-[9px] font-semibold uppercase tracking-normal justify-center",
                visibilityCompactBadgeClass[currentSectionVisibility],
              )}
              title={`${visibilityLabel(currentSectionVisibility)} visibility`}
            >
              {visibilityShortLabel(currentSectionVisibility)}
            </Badge>
          )}
        </button>

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 pr-1 shrink-0 transition-opacity">
          <button
            onClick={() => onAddPage(section.id)}
            className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            title="Add page"
          >
            <Plus className="h-3 w-3" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onAddSubSection(section.id)}>
                <FolderPlus className="h-3 w-3 mr-2" />
                {depth === 0 ? "Add section / tab / version" : "Add sub-section"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onImportHere(section)}>
                <ArrowUpFromLine className="h-3 w-3 mr-2" />
                Import here
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onChangeSectionType(section, "section")}
              >
                <ChevronsUpDown className="h-3 w-3 mr-2" />
                {sectionType === "section" ? "✓ " : ""}Set as section
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canSetTab}
                onClick={() => {
                  if (!canSetTab) return;
                  onChangeSectionType(section, "tab");
                }}
              >
                <ChevronsUpDown className="h-3 w-3 mr-2" />
                {sectionType === "tab" ? "✓ " : ""}Set as tab
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canSetVersion}
                onClick={() => {
                  if (!canSetVersion) return;
                  onChangeSectionType(section, "version");
                }}
              >
                <ChevronsUpDown className="h-3 w-3 mr-2" />
                {sectionType === "version" ? "✓ " : ""}Set as version
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRenameSection(section)}>
                <Pencil className="h-3 w-3 mr-2" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMoveSection(section)}>
                <ChevronsUpDown className="h-3 w-3 mr-2" /> Move to...
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {visibilityOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => onSetSectionVisibility(section, opt.value)}
                >
                  {currentSectionVisibility === opt.value ? "✓ " : ""}{opt.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => onDeleteSection(section)}>
                <Trash2 className="h-3 w-3 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {open && (
        <div className="pl-3">
          <SortableContext items={pageIds} strategy={verticalListSortingStrategy}>
            {sectionPages.map((page) => (
              <PageItem
                key={page.id}
                page={page}
                visibility={((page.visibility_override as VisibilityLevel | null) ?? currentSectionVisibility)}
                showVisibilityBadge={page.visibility_override !== null || currentSectionVisibility !== "public"}
                selectedPageId={selectedPageId}
                onSelect={onSelectPage}
                onEditTitle={onRenamePage}
                onEditSlug={onEditPageSlug}
                onMove={onMovePage}
                onRearrange={onRearrangePage}
                onSetVisibilityOverride={onSetPageVisibilityOverride}
                onDuplicate={onDuplicatePage}
                onUnpublish={onUnpublishPage}
                onDelete={onDeletePage}
              />
            ))}
          </SortableContext>
          {(section.children ?? []).map((child) => (
            <SectionNode
              key={child.id}
              section={child}
              pages={pages}
              selectedPageId={selectedPageId}
              onSelectPage={onSelectPage}
              depth={depth + 1}
              activeDragType={activeDragType}
              hierarchyMode={hierarchyMode}
              onAddPage={onAddPage}
              onAddSubSection={onAddSubSection}
              onImportHere={onImportHere}
              onRenameSection={onRenameSection}
              onMoveSection={onMoveSection}
              onDeleteSection={onDeleteSection}
              onChangeSectionType={onChangeSectionType}
              onSetSectionVisibility={onSetSectionVisibility}
              onRenamePage={onRenamePage}
              onEditPageSlug={onEditPageSlug}
              onMovePage={onMovePage}
              onSetPageVisibilityOverride={onSetPageVisibilityOverride}
              onDuplicatePage={onDuplicatePage}
              onUnpublishPage={onUnpublishPage}
              onRearrangePage={onRearrangePage}
              onDeletePage={onDeletePage}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReaderHierarchy({
  title,
  pages,
  topPages,
  rootSections,
  sectionsById,
  sectionDepthById,
  hierarchyMode,
  sensors,
  onDragStart,
  onDragEnd,
  activeDragType,
  activeDragLabel,
  hideVersionSections,
  visibilityFilter,
  onVisibilityFilterChange,
  selectedPageId,
  onSelectPage,
  onAddPage,
  onAddSubSection,
  onImportHere,
  onRenameSection,
  onMoveSection,
  onDeleteSection,
  onChangeSectionType,
  onSetSectionVisibility,
  onRenamePage,
  onEditPageSlug,
  onMovePage,
  onSetPageVisibilityOverride,
  onDuplicatePage,
  onUnpublishPage,
  onRearrangePage,
  onDeletePage,
}: {
  title: string;
  pages: Page[];
  topPages: Page[];
  rootSections: Section[];
  sectionsById: Map<number, Section>;
  sectionDepthById: Map<number, number>;
  hierarchyMode: "product" | "flat";
  sensors: ReturnType<typeof useSensors>;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  activeDragType: "page" | "section" | null;
  activeDragLabel: string;
  hideVersionSections?: boolean;
  visibilityFilter: VisibilityFilter;
  onVisibilityFilterChange: (value: VisibilityFilter) => void;
  selectedPageId: number | null;
  onSelectPage: (id: number) => void;
  onAddPage: (sectionId: number) => void;
  onAddSubSection: (parentId: number) => void;
  onImportHere: (section: Section) => void;
  onRenameSection: (section: Section) => void;
  onMoveSection: (section: Section) => void;
  onDeleteSection: (section: Section) => void;
  onChangeSectionType: (section: Section, sectionType: "section" | "tab" | "version") => void;
  onSetSectionVisibility: (section: Section, visibility: VisibilityLevel) => void;
  onRenamePage: (page: Page) => void;
  onEditPageSlug: (page: Page) => void;
  onMovePage: (page: Page) => void;
  onSetPageVisibilityOverride: (page: Page, visibility: VisibilityLevel | null) => void;
  onDuplicatePage: (page: Page) => void;
  onUnpublishPage: (page: Page) => void;
  onRearrangePage: (page: Page) => void;
  onDeletePage: (page: Page) => void;
}) {
  const filterVisibleSections = useCallback(
    (sections: Section[]) =>
      hideVersionSections
        ? sections.filter((section) => (section.section_type ?? "section") !== "version")
        : sections,
    [hideVersionSections],
  );
  const sortedTopPages = useMemo(
    () => [...topPages].sort((a, b) => a.display_order - b.display_order || a.title.localeCompare(b.title)),
    [topPages],
  );
  const sortedRootSections = useMemo(
    () => [...filterVisibleSections(rootSections)].sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)),
    [filterVisibleSections, rootSections],
  );

  return (
    <aside className="w-[240px] shrink-0 border-r bg-background/60 overflow-y-auto">
      <div className="px-4 py-3 border-b bg-background/80">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Hierarchy</p>
        <p className="text-sm font-semibold truncate mt-1">{title}</p>
        <Select value={visibilityFilter} onValueChange={(value) => onVisibilityFilterChange(value as VisibilityFilter)}>
          <SelectTrigger className="mt-2 h-8 text-xs focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:ring-0">
            <SelectValue placeholder="Visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All visibility</SelectItem>
            <SelectItem value="public">Public only</SelectItem>
            <SelectItem value="internal">Internal only</SelectItem>
            <SelectItem value="external">External only</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="px-2 py-2 space-y-0.5">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={sortedTopPages.map((p) => `page-${p.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {sortedTopPages.map((page) => (
              <PageItem
                key={page.id}
                page={page}
                visibility={resolveEffectivePageVisibility(page, sectionsById)}
                showVisibilityBadge={page.visibility_override !== null || resolveEffectivePageVisibility(page, sectionsById) !== "public"}
                selectedPageId={selectedPageId}
                onSelect={onSelectPage}
                onEditTitle={onRenamePage}
                onEditSlug={onEditPageSlug}
                onMove={onMovePage}
                onRearrange={onRearrangePage}
                onSetVisibilityOverride={onSetPageVisibilityOverride}
                onDuplicate={onDuplicatePage}
                onUnpublish={onUnpublishPage}
                onDelete={onDeletePage}
              />
            ))}
          </SortableContext>
          <SortableContext
            items={sortedRootSections.map((s) => `sect-${s.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {sortedRootSections.map((section) => (
              <SectionNode
                key={section.id}
                section={section}
                pages={pages}
                selectedPageId={selectedPageId}
                onSelectPage={onSelectPage}
                depth={sectionDepthById.get(section.id) ?? 0}
                activeDragType={activeDragType}
                hierarchyMode={hierarchyMode}
                onAddPage={onAddPage}
                onAddSubSection={onAddSubSection}
                onImportHere={onImportHere}
                onRenameSection={onRenameSection}
                onMoveSection={onMoveSection}
                onDeleteSection={onDeleteSection}
                onChangeSectionType={onChangeSectionType}
                onSetSectionVisibility={onSetSectionVisibility}
                onRenamePage={onRenamePage}
                onEditPageSlug={onEditPageSlug}
                onMovePage={onMovePage}
                onSetPageVisibilityOverride={onSetPageVisibilityOverride}
                onDuplicatePage={onDuplicatePage}
                onUnpublishPage={onUnpublishPage}
                onRearrangePage={onRearrangePage}
                onDeletePage={onDeletePage}
              />
            ))}
          </SortableContext>
          <DragOverlay>
            {activeDragType && (
              <div className={cn(
                "px-2 py-1.5 rounded-md text-xs font-medium shadow-lg border bg-background text-foreground",
                activeDragType === "section" ? "uppercase tracking-wide text-muted-foreground/70" : "",
              )}>
                {activeDragLabel}
              </div>
            )}
          </DragOverlay>
        </DndContext>
        {sortedTopPages.length === 0 && sortedRootSections.length === 0 && (
          <p className="px-2 py-2 text-xs text-muted-foreground">No sections/pages in this scope.</p>
        )}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [showAddPage, setShowAddPage] = useState(false);
  const [addPageSectionId, setAddPageSectionId] = useState<number | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [addSectionParentId, setAddSectionParentId] = useState<number | null>(null);
  const [addSectionPreferredType, setAddSectionPreferredType] = useState<"section" | "tab" | "version" | undefined>(undefined);
  const [addSectionCloneFromId, setAddSectionCloneFromId] = useState<number | null>(null);
  const [activeDragType, setActiveDragType] = useState<"page" | "section" | null>(null);
  const [activeDragLabel, setActiveDragLabel] = useState<string>("");
  const [showScanDrive, setShowScanDrive] = useState(false);
  const [scanTarget, setScanTarget] = useState<DriveImportTarget | null>(null);
  const [showConfigureTabs, setShowConfigureTabs] = useState(false);
  const [renamingSection, setRenamingSection] = useState<Section | null>(null);
  const [renamingPage, setRenamingPage] = useState<Page | null>(null);
  const [editingPageSlug, setEditingPageSlug] = useState<Page | null>(null);
  const [movingSection, setMovingSection] = useState<Section | null>(null);
  const [movingPage, setMovingPage] = useState<Page | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedSidebarProductId, setSelectedSidebarProductId] = useState<number | null>(null);
  const [selectedSidebarVersionId, setSelectedSidebarVersionId] = useState<number | null>(null);
  const [drivePanelOpen, setDrivePanelOpen] = useState(true);
  const [accountPanelOpen, setAccountPanelOpen] = useState(false);
  const [showExternalAccessPanel, setShowExternalAccessPanel] = useState(false);
  const [showInviteMember, setShowInviteMember] = useState(false);
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false);
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");

  const [currentOrgId, setCurrentOrgId] = useState<number | undefined>(getStoredOrgId() ?? undefined);
  const { data: org, isLoading: orgLoading } = useQuery({ queryKey: ["org", currentOrgId], queryFn: () => orgApi.get(currentOrgId) });
  const { data: sectionsData } = useQuery({ queryKey: ["sections", currentOrgId], queryFn: sectionsApi.list, enabled: !!org });
  const { data: pagesData } = useQuery({ queryKey: ["pages", currentOrgId], queryFn: () => pagesApi.list(), enabled: !!org });
  const { data: driveStatus } = useQuery({ queryKey: ["drive-status", currentOrgId], queryFn: driveApi.status, enabled: !!org });
  const { data: selectedPageFull } = useQuery({
    queryKey: ["page", selectedPageId],
    queryFn: () => pagesApi.get(selectedPageId!),
    enabled: selectedPageId !== null,
  });

  const handleWorkspaceChange = useCallback((orgId: number) => {
    setStoredOrgId(orgId);
    setCurrentOrgId(orgId);
    // Reset selection state
    setSelectedProduct(null);
    setSelectedPageId(null);
  }, []);

  const sections = sectionsData?.sections ?? [];
  const pages = pagesData?.pages ?? [];
  const selectedPage = selectedPageFull ?? (pages.find((p) => p.id === selectedPageId) ?? null);

  const sectionsById = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);
  const sectionDepthById = useMemo(() => {
    const depthMap = new Map<number, number>();
    const getDepth = (section: Section): number => {
      const cached = depthMap.get(section.id);
      if (cached !== undefined) return cached;
      if (section.parent_id === null) {
        depthMap.set(section.id, 0);
        return 0;
      }
      const parent = sectionsById.get(section.parent_id);
      const depth = parent ? getDepth(parent) + 1 : 0;
      depthMap.set(section.id, depth);
      return depth;
    };
    for (const section of sections) getDepth(section);
    return depthMap;
  }, [sections, sectionsById]);
  const pageMatchesVisibilityFilter = useCallback(
    (page: Page) =>
      visibilityFilter === "all" ||
      resolveEffectivePageVisibility(page, sectionsById) === visibilityFilter,
    [sectionsById, visibilityFilter],
  );
  const visiblePages = useMemo(
    () => pages.filter(pageMatchesVisibilityFilter),
    [pageMatchesVisibilityFilter, pages],
  );
  const allSectionTree = useMemo(() => buildSectionTree(sections), [sections]);
  const sectionTree = useMemo(() => {
    if (visibilityFilter === "all") return allSectionTree;
    const sectionIdsWithVisiblePages = new Set(
      visiblePages.filter((p) => p.section_id !== null).map((p) => p.section_id as number),
    );
    const filterNode = (node: Section): Section | null => {
      const filteredChildren =
        (node.children ?? [])
          .map((child) => filterNode(child))
          .filter((child): child is Section => child !== null);
      const nodeVisibility = (node.visibility ?? "public") as VisibilityLevel;
      const keepNode =
        nodeVisibility === visibilityFilter ||
        sectionIdsWithVisiblePages.has(node.id) ||
        filteredChildren.length > 0;
      if (!keepNode) return null;
      return { ...node, children: filteredChildren };
    };
    return allSectionTree
      .map((node) => filterNode(node))
      .filter((node): node is Section => node !== null);
  }, [allSectionTree, visibilityFilter, visiblePages]);
  const isProductHierarchy = (org?.hierarchy_mode ?? "product") !== "flat";
  const rootProducts = useMemo(
    () => allSectionTree.map((node) => ({ id: node.id, name: node.name })),
    [allSectionTree],
  );
  const childrenByParent = useMemo(() => {
    const map = new Map<number, Section[]>();
    for (const section of sections) {
      if (section.parent_id === null) continue;
      const list = map.get(section.parent_id) ?? [];
      list.push(section);
      map.set(section.parent_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
    }
    return map;
  }, [sections]);

  const selectedSectionPath = useMemo(() => {
    if (!selectedPage?.section_id) return [] as Section[];
    const path: Section[] = [];
    let cursor: Section | undefined = sectionsById.get(selectedPage.section_id);
    while (cursor) {
      path.unshift(cursor);
      cursor = cursor.parent_id ? sectionsById.get(cursor.parent_id) : undefined;
    }
    return path;
  }, [selectedPage?.section_id, sectionsById]);
  const selectedPageProductId = selectedSectionPath[0]?.id ?? null;
  const selectedPageVersionId =
    selectedSectionPath.find((section, idx) => idx > 0 && (section.section_type ?? "section") === "version")?.id ?? null;

  useEffect(() => {
    const currentExists =
      selectedSidebarProductId !== null &&
      rootProducts.some((product) => product.id === selectedSidebarProductId);

    if (selectedPageProductId && selectedPageProductId !== selectedSidebarProductId) {
      setSelectedSidebarProductId(selectedPageProductId);
      return;
    }

    if (!currentExists) {
      setSelectedSidebarProductId(rootProducts[0]?.id ?? null);
    }
  }, [rootProducts, selectedPageProductId, selectedSidebarProductId]);

  const selectedProduct = useMemo(() => {
    if (selectedSectionPath[0]) return selectedSectionPath[0];
    if (selectedSidebarProductId !== null) {
      return sectionsById.get(selectedSidebarProductId) ?? null;
    }
    return null;
  }, [sectionsById, selectedSectionPath, selectedSidebarProductId]);
  const productVersionsByProduct = useMemo(() => {
    const map = new Map<number, Section[]>();
    for (const section of sections) {
      if ((section.section_type ?? "section") !== "version") continue;
      if (section.parent_id === null) continue;
      const list = map.get(section.parent_id) ?? [];
      list.push(section);
      map.set(section.parent_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
    }
    return map;
  }, [sections]);
  const productVersions = useMemo(
    () => (selectedProduct ? productVersionsByProduct.get(selectedProduct.id) ?? [] : []),
    [productVersionsByProduct, selectedProduct],
  );
  const selectedVersion = useMemo(() => {
    if (!selectedProduct || productVersions.length === 0) return null;
    const fromPath = selectedSectionPath.find(
      (section, idx) =>
        idx > 0 &&
        (section.section_type ?? "section") === "version" &&
        section.parent_id === selectedProduct.id,
    );
    if (fromPath) return fromPath;
    if (selectedSidebarVersionId !== null) {
      const fromSidebar = productVersions.find((section) => section.id === selectedSidebarVersionId);
      if (fromSidebar) return fromSidebar;
    }
    return null;
  }, [productVersions, selectedProduct, selectedSectionPath, selectedSidebarVersionId]);
  const selectedImportTargetSection =
    selectedSectionPath[selectedSectionPath.length - 1] ?? selectedVersion ?? selectedProduct ?? null;
  const selectedTab =
    selectedSectionPath.find((s, idx) => idx > 0 && (s.section_type ?? "section") === "tab") ?? null;

  const productTabs = useMemo(() => {
    const parent = selectedVersion ?? selectedProduct;
    if (!parent) return [] as Section[];
    return sections
      .filter(
        (s) =>
          s.parent_id === parent.id &&
          (s.section_type ?? "section") === "tab",
      )
      .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
  }, [sections, selectedProduct, selectedVersion]);
  const filteredChildrenByParent = useMemo(() => {
    const map = new Map<number, Section[]>();
    const walk = (nodes: Section[]) => {
      for (const node of nodes) {
        for (const child of node.children ?? []) {
          const list = map.get(node.id) ?? [];
          list.push(child);
          map.set(node.id, list);
        }
        walk(node.children ?? []);
      }
    };
    walk(sectionTree);
    for (const list of map.values()) {
      list.sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
    }
    return map;
  }, [sectionTree]);
  const sortedVisibleChildren = useCallback(
    (parentId: number): Section[] =>
      [...(filteredChildrenByParent.get(parentId) ?? [])]
        .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)),
    [filteredChildrenByParent],
  );
  const pagesBySection = useMemo(() => {
    const map = new Map<number, Page[]>();
    for (const page of visiblePages) {
      if (page.section_id === null) continue;
      const list = map.get(page.section_id) ?? [];
      list.push(page);
      map.set(page.section_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.display_order - b.display_order || a.title.localeCompare(b.title));
    }
    return map;
  }, [visiblePages]);
  const activeHierarchyRoot = selectedTab ?? selectedVersion ?? selectedProduct;
  const readerHierarchyTopPages = useMemo(() => {
    if (!activeHierarchyRoot) return [] as Page[];
    return visiblePages
      .filter((page) => page.section_id === activeHierarchyRoot.id)
      .sort((a, b) => a.display_order - b.display_order || a.title.localeCompare(b.title));
  }, [activeHierarchyRoot, visiblePages]);
  const readerHierarchySections = useMemo(() => {
    if (!activeHierarchyRoot) return [] as Section[];
    if (selectedTab) {
      return sortedVisibleChildren(selectedTab.id);
    }
    const children = sortedVisibleChildren(activeHierarchyRoot.id);
    const nonTabChildren = children.filter((section) => (section.section_type ?? "section") !== "tab");
    return nonTabChildren.length > 0 ? nonTabChildren : children;
  }, [activeHierarchyRoot, selectedTab, sortedVisibleChildren]);
  const readerHierarchyTitle = selectedTab?.name ?? selectedVersion?.name ?? selectedProduct?.name ?? "Documentation";

  const getDescendantSectionIds = useCallback(
    (rootSectionId: number): Set<number> => {
      const ids = new Set<number>();
      const stack = [rootSectionId];
      while (stack.length) {
        const current = stack.pop()!;
        if (ids.has(current)) continue;
        ids.add(current);
        const children = childrenByParent.get(current) ?? [];
        for (const child of children) stack.push(child.id);
      }
      return ids;
    },
    [childrenByParent],
  );

  const findFirstPageInSection = useCallback(
    (rootSectionId: number): Page | null => {
      const ids = getDescendantSectionIds(rootSectionId);
      const first = pages
        .filter((p) => p.section_id !== null && ids.has(p.section_id))
        .sort((a, b) => a.display_order - b.display_order || a.title.localeCompare(b.title))[0];
      return first ?? null;
    },
    [getDescendantSectionIds, pages],
  );
  const findFirstPageInProductBase = useCallback(
    (productId: number): Page | null => {
      const ids = new Set<number>([productId]);
      const directChildren = childrenByParent.get(productId) ?? [];
      for (const child of directChildren) {
        if ((child.section_type ?? "section") === "version") continue;
        const descendantIds = getDescendantSectionIds(child.id);
        for (const id of descendantIds) ids.add(id);
      }
      const first = pages
        .filter((p) => p.section_id !== null && ids.has(p.section_id))
        .sort((a, b) => a.display_order - b.display_order || a.title.localeCompare(b.title))[0];
      return first ?? null;
    },
    [childrenByParent, getDescendantSectionIds, pages],
  );
  useEffect(() => {
    if (!selectedProduct) {
      if (selectedSidebarVersionId !== null) setSelectedSidebarVersionId(null);
      return;
    }
    if (productVersions.length === 0) {
      if (selectedSidebarVersionId !== null) setSelectedSidebarVersionId(null);
      return;
    }
    // Keep the version scope aligned with the currently selected page path.
    if (selectedSectionPath.length > 0 && selectedSectionPath[0]?.id === selectedProduct.id) {
      const nextVersionId =
        selectedPageVersionId && productVersions.some((section) => section.id === selectedPageVersionId)
          ? selectedPageVersionId
          : null;
      if (selectedSidebarVersionId !== nextVersionId) {
        setSelectedSidebarVersionId(nextVersionId);
      }
      return;
    }

    // No selected page: preserve a valid user-selected version, else stay on base scope.
    if (selectedSidebarVersionId !== null && !productVersions.some((section) => section.id === selectedSidebarVersionId)) {
      setSelectedSidebarVersionId(null);
    }
  }, [productVersions, selectedPageVersionId, selectedProduct, selectedSectionPath, selectedSidebarVersionId]);

  const displayedSectionTree = useMemo(() => {
    if (!isProductHierarchy) return sectionTree;
    if (selectedSidebarProductId === null) return sectionTree;
    const selectedProductNode = sectionTree.find((root) => root.id === selectedSidebarProductId);
    if (!selectedProductNode) return [] as Section[];
    if (!selectedVersion) return [selectedProductNode];
    const selectedVersionNode = (selectedProductNode.children ?? []).find((child) => child.id === selectedVersion.id);
    return selectedVersionNode ? [selectedVersionNode] : [];
  }, [isProductHierarchy, sectionTree, selectedSidebarProductId, selectedVersion]);
  const adminTreeSections = useMemo(() => {
    if (!isProductHierarchy) return displayedSectionTree;
    const selectedRoot = displayedSectionTree[0];
    if (!selectedRoot) return [] as Section[];
    if (selectedVersion) return selectedRoot.children ?? [];
    return selectedRoot.children ?? [];
  }, [displayedSectionTree, isProductHierarchy, selectedVersion]);
  const adminRootPages = useMemo(() => {
    if (!isProductHierarchy || selectedSidebarProductId === null) {
      return visiblePages.filter((page) => !page.section_id);
    }
    if (selectedVersion) return visiblePages.filter((page) => page.section_id === selectedVersion.id);
    return visiblePages.filter((page) => page.section_id === selectedSidebarProductId);
  }, [isProductHierarchy, selectedSidebarProductId, selectedVersion, visiblePages]);
  const adminSectionDepthBase = isProductHierarchy && selectedSidebarProductId !== null ? 1 : 0;
  const shouldShowAdminTree = !selectedPage;

  const handleSidebarProductSwitch = useCallback(
    (value: string) => {
      const productId = Number(value);
      if (!Number.isFinite(productId)) return;
      setSelectedSidebarProductId(productId);
      setSelectedSidebarVersionId(null);
      const firstPage = findFirstPageInProductBase(productId);
      setSelectedPageId(firstPage?.id ?? null);
    },
    [findFirstPageInProductBase],
  );
  const handleSidebarVersionSwitch = useCallback(
    (value: string) => {
      if (value === "__base__") {
        setSelectedSidebarVersionId(null);
        if (selectedProduct) {
          const firstBasePage = findFirstPageInProductBase(selectedProduct.id);
          setSelectedPageId(firstBasePage?.id ?? null);
        }
        return;
      }
      const versionId = Number(value);
      if (!Number.isFinite(versionId)) return;
      setSelectedSidebarVersionId(versionId);
      const firstPage = findFirstPageInSection(versionId);
      setSelectedPageId(firstPage?.id ?? null);
    },
    [findFirstPageInProductBase, findFirstPageInSection, selectedProduct],
  );
  const selectedSidebarProductValue =
    selectedSidebarProductId !== null
      ? String(selectedSidebarProductId)
      : (rootProducts[0] ? String(rootProducts[0].id) : "");
  const selectedSidebarVersionValue =
    selectedVersion?.id !== undefined && selectedVersion?.id !== null
      ? String(selectedVersion.id)
      : "__base__";
  const defaultAddPageSectionId =
    isProductHierarchy
      ? (selectedVersion?.id ?? selectedProduct?.id ?? null)
      : null;
  const canCreateVersionForSelectedProduct = isProductHierarchy && selectedProduct !== null;
  const openAddVersionDialog = useCallback(() => {
    if (!canCreateVersionForSelectedProduct || !selectedProduct) {
      toast({
        title: "Select a product first",
        description: "Choose a product from the selector, then create a version.",
        variant: "destructive",
      });
      return;
    }
    setAddSectionParentId(selectedProduct.id);
    setAddSectionPreferredType("version");
    setAddSectionCloneFromId(selectedVersion?.id ?? selectedProduct.id);
    setShowAddSection(true);
  }, [canCreateVersionForSelectedProduct, selectedProduct, toast]);

  const openImportDialogForTarget = useCallback((section: Section | null) => {
    if (section) {
      setScanTarget({
        id: section.id,
        name: section.name,
        type: inferImportTargetType(section),
      });
    } else {
      setScanTarget(null);
    }
    setShowScanDrive(true);
  }, []);

  // ── DnD setup ──────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const dragPage = useMutation({
    mutationFn: ({ id, section_id, display_order }: { id: number; section_id: number | null; display_order?: number }) =>
      pagesApi.update(id, { section_id, display_order }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pages"] }),
    onError: (err: Error) => toast({ title: "Move failed", description: err.message, variant: "destructive" }),
  });

  const dragSection = useMutation({
    mutationFn: ({ id, parent_id, display_order }: { id: number; parent_id?: number | null; display_order?: number }) =>
      sectionsApi.update(id, { parent_id, display_order }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sections"] }),
    onError: (err: Error) => toast({ title: "Move failed", description: err.message, variant: "destructive" }),
  });

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    const data = active.data.current as { type: string; pageId?: number; sectionId?: number };
    if (data.type === "page") {
      const page = pagesData?.pages.find((p) => p.id === data.pageId);
      setActiveDragType("page");
      setActiveDragLabel(page?.title ?? "Page");
    } else if (data.type === "section") {
      const section = sectionsData?.sections.find((s) => s.id === data.sectionId);
      setActiveDragType("section");
      setActiveDragLabel(section?.name ?? "Section");
    }
  }, [pagesData, sectionsData]);

  const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    setActiveDragType(null);
    setActiveDragLabel("");
    if (!over || active.id === over.id) return;

    const activeStr = String(active.id);
    const overStr = String(over.id);

    if (activeStr.startsWith("page-")) {
      const pageId = parseInt(activeStr.slice(5));
      const page = pagesData?.pages.find((p) => p.id === pageId);
      if (!page) return;

      if (overStr.startsWith("page-")) {
        // Reorder or move to a different section
        const overPageId = parseInt(overStr.slice(5));
        const overPage = pagesData?.pages.find((p) => p.id === overPageId);
        if (!overPage || (page.section_id === overPage.section_id && page.display_order === overPage.display_order)) return;
        dragPage.mutate({ id: page.id, section_id: overPage.section_id, display_order: overPage.display_order });

      } else if (overStr.startsWith("nest-")) {
        // Move page to a section
        const targetSectionId = parseInt(overStr.slice(5));
        if (page.section_id === targetSectionId) return;
        const targetPages = pagesData?.pages.filter((p) => p.section_id === targetSectionId) ?? [];
        dragPage.mutate({ id: page.id, section_id: targetSectionId, display_order: targetPages.length });
      }

    } else if (activeStr.startsWith("sect-")) {
      const sectionId = parseInt(activeStr.slice(5));
      const section = sectionsData?.sections.find((s) => s.id === sectionId);
      if (!section) return;

      if (overStr.startsWith("nest-")) {
        // Nest section inside another
        const targetId = parseInt(overStr.slice(5));
        if (targetId === sectionId) return;
        // Prevent nesting into own descendant
        const isDescendant = (checkId: number): boolean => {
          const children = sectionsData?.sections.filter((s) => s.parent_id === checkId) ?? [];
          return children.some((c) => c.id === targetId || isDescendant(c.id));
        };
        if (isDescendant(sectionId)) return;
        dragSection.mutate({ id: sectionId, parent_id: targetId });

      } else if (overStr.startsWith("sect-")) {
        // Reorder among siblings
        const overSectionId = parseInt(overStr.slice(5));
        const overSection = sectionsData?.sections.find((s) => s.id === overSectionId);
        if (!overSection || overSection.parent_id !== section.parent_id) return;
        dragSection.mutate({ id: sectionId, display_order: overSection.display_order });
      }
    }
  }, [pagesData, sectionsData, dragPage, dragSection]);
  // ──────────────────────────────────────────────────────────────────────────

  const createSection = useMutation({
    mutationFn: (name: string) => sectionsApi.create({ name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sections"] }); toast({ title: "Section created" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteSection = useMutation({
    mutationFn: (id: number) => sectionsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sections"] });
      qc.invalidateQueries({ queryKey: ["pages"] });
      toast({ title: "Section deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateSection = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => sectionsApi.update(id, { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sections"] }); setRenamingSection(null); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateSectionType = useMutation({
    mutationFn: ({ id, section_type }: { id: number; section_type: "section" | "tab" | "version" }) =>
      sectionsApi.update(id, { section_type }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sections"] });
      toast({ title: "Section type updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateSectionVisibility = useMutation({
    mutationFn: ({ id, visibility }: { id: number; visibility: VisibilityLevel }) =>
      sectionsApi.update(id, { visibility }),
    onSuccess: (_section, variables) => {
      qc.invalidateQueries({ queryKey: ["sections"] });
      toast({ title: "Section visibility updated", description: `Now ${visibilityLabel(variables.visibility)}.` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updatePage = useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) => pagesApi.update(id, { title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["page", selectedPageId] });
      setRenamingPage(null);
      toast({ title: "Title updated", description: "Google Doc title was updated too." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updatePageVisibility = useMutation({
    mutationFn: ({ id, visibility_override }: { id: number; visibility_override: VisibilityLevel | null }) =>
      pagesApi.update(id, { visibility_override }),
    onSuccess: (_page, variables) => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["page", variables.id] });
      if (variables.visibility_override === null) {
        toast({ title: "Page visibility reset", description: "Now inheriting from section." });
      } else {
        toast({
          title: "Page visibility updated",
          description: `Now ${visibilityLabel(variables.visibility_override)}.`,
        });
      }
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updatePageSlug = useMutation({
    mutationFn: ({ id, slug }: { id: number; slug: string }) => pagesApi.update(id, { slug }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["page", selectedPageId] });
      setEditingPageSlug(null);
      toast({ title: "URL slug updated", description: "Duplicate slugs are auto-resolved with a numeric suffix." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const syncAll = useMutation({
    mutationFn: driveApi.syncAll,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      toast({
        title: "Sync complete",
        description: `${result.synced} updated, ${result.skipped} unchanged${result.errors ? `, ${result.errors} failed` : ""}`,
        variant: result.errors ? "destructive" : "default",
      });
    },
    onError: (err: Error) => toast({ title: "Sync failed", description: err.message, variant: "destructive" }),
  });

  const syncPage = useMutation({
    mutationFn: (id: number) => pagesApi.sync(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["page", selectedPageId] });
      toast({ title: "Synced" });
    },
  });

  const publishPage = useMutation({
    mutationFn: (id: number) => pagesApi.publish(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["page", selectedPageId] });
      toast({ title: "Published" });
    },
  });

  const unpublishPage = useMutation({
    mutationFn: (id: number) => pagesApi.unpublish(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["page", selectedPageId] });
      toast({ title: "Unpublished" });
    },
  });

  const deletePage = useMutation({
    mutationFn: (id: number) => pagesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      setSelectedPageId(null);
      toast({ title: "Page deleted" });
    },
  });

  const duplicatePage = useMutation({
    mutationFn: (id: number) => pagesApi.duplicate(id),
    onSuccess: (newPage) => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      setSelectedPageId(newPage.id);
      toast({ title: "Page duplicated", description: "A Google Doc copy was created." });
    },
    onError: (err: Error) => toast({ title: "Duplicate failed", description: err.message, variant: "destructive" }),
  });

  const handleRearrangePage = useCallback((page: Page) => {
    toast({
      title: "Re-arrange page",
      description: `Drag "${page.title}" using the grip handle to reorder.`,
    });
  }, [toast]);

  const handleDeletePage = useCallback((page: Page) => {
    const confirmed = window.confirm(`Delete "${page.title}"?\n\nThis will also move the Google Doc to Drive trash.`);
    if (!confirmed) return;
    deletePage.mutate(page.id);
  }, [deletePage]);

  const handleUnpublishPage = useCallback((page: Page) => {
    if (!page.is_published) return;
    unpublishPage.mutate(page.id);
  }, [unpublishPage]);

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      setIsSigningOut(false);
      toast({
        title: "Sign out failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  }, [isSigningOut, signOut, toast]);

  const handleConnectDrive = useCallback(async () => {
    if (isConnectingDrive) return;
    setIsConnectingDrive(true);
    try {
      await startGoogleOAuth(currentOrgId ?? org?.id);
    } catch (err) {
      setIsConnectingDrive(false);
      toast({
        title: "Drive connection failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  }, [currentOrgId, isConnectingDrive, org?.id, toast]);

  const orgSlug = org?.slug ?? String(org?.id ?? "");
  const publicDocsUrl = `${API_BASE_URL}/docs/${orgSlug}`;
  const internalDocsUrl = `${API_BASE_URL}/internal-docs/${orgSlug}`;
  const externalDocsUrl = `${API_BASE_URL}/external-docs/${orgSlug}`;
  const bootstrapDocsSession = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/auth/docs-session`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
    } catch {
      // Continue as anonymous if docs session bootstrap fails.
    }
  }, []);
  const openPublishedDocs = useCallback(
    async (url: string) => {
      await bootstrapDocsSession();
      let finalUrl = url;
      // Always append auth_token as a one-time query param fallback.
      // Cross-origin cookie propagation (SameSite=Lax from fetch POST)
      // is unreliable across browsers, so the backend will read the token,
      // bootstrap the HttpOnly cookie, and 307-redirect to strip it.
      const token = getAuthToken();
      if (token) {
        const u = new URL(finalUrl);
        u.searchParams.set("auth_token", token);
        finalUrl = u.toString();
      }
      window.open(finalUrl, "_blank");
    },
    [bootstrapDocsSession],
  );
  const getPagePublishedUrl = useCallback(
    (page: Page | null | undefined): string | null => {
      if (!page || !orgSlug) return null;
      const effectiveVisibility = resolveEffectivePageVisibility(page, sectionsById);
      const baseUrl =
        effectiveVisibility === "internal"
          ? internalDocsUrl
          : effectiveVisibility === "external"
            ? externalDocsUrl
            : publicDocsUrl;
      return `${baseUrl}/p/${page.id}/${page.slug}`;
    },
    [externalDocsUrl, internalDocsUrl, orgSlug, publicDocsUrl, sectionsById],
  );
  const selectedPageEffectiveVisibility = selectedPage
    ? resolveEffectivePageVisibility(selectedPage, sectionsById)
    : null;
  const selectedPagePublishedUrl = getPagePublishedUrl(selectedPage);
  const copyPublishedLink = useCallback(async () => {
    if (!selectedPagePublishedUrl) return;
    try {
      await navigator.clipboard.writeText(selectedPagePublishedUrl);
      toast({
        title: "Link copied",
        description: selectedPagePublishedUrl,
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard permission denied. Copy the URL from 'View live'.",
        variant: "destructive",
      });
    }
  }, [selectedPagePublishedUrl, toast]);

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Loading workspace…</span>
        </div>
      </div>
    );
  }

  const orgInitials = org?.name?.slice(0, 2).toUpperCase() ?? "AC";
  const accountName = user?.name?.trim() || user?.email?.split("@")[0] || "Account";
  const accountEmail = user?.email ?? "";
  const driveConnected = !!driveStatus?.connected;
  const canManageDrive = org?.user_role === "owner" || org?.user_role === "admin";
  const canManageWorkspace = canManageDrive;

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside
        className={cn(
          "shrink-0 flex flex-col border-r bg-[#F9F8F6] dark:bg-muted/20 overflow-hidden transition-[width] duration-200",
          sidebarCollapsed ? "w-[64px]" : "w-[248px]",
        )}
      >

        {/* Org header */}
        <div className={cn("px-3 py-3 border-b bg-background", sidebarCollapsed ? "space-y-3" : "space-y-2")}>
          <div className={cn("flex items-center", sidebarCollapsed ? "flex-col gap-2" : "gap-2.5")}>
            {org?.logo_url ? (
              <img src={org.logo_url} alt="" className="w-7 h-7 rounded-lg object-contain flex-shrink-0" />
            ) : (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                style={{ background: org?.primary_color ?? "#6366f1" }}
              >
                {orgInitials}
              </div>
            )}
            {!sidebarCollapsed && (
              <WorkspaceSwitcher
                currentOrg={org ? { id: org.id, name: org.name, logo_url: org.logo_url, primary_color: org.primary_color } : null}
                onWorkspaceChange={handleWorkspaceChange}
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 text-muted-foreground hover:text-foreground",
                !sidebarCollapsed && "ml-auto",
              )}
              onClick={() => setSidebarCollapsed((v) => !v)}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          {!sidebarCollapsed ? (
            <div className="rounded-md border bg-muted/30 p-0.5 grid grid-cols-3 gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1 text-[11px] font-medium text-muted-foreground hover:text-foreground justify-center rounded-sm"
                onClick={() => void openPublishedDocs(internalDocsUrl)}
                title="Open internal docs"
              >
                Internal
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1 text-[11px] font-medium text-muted-foreground hover:text-foreground justify-center rounded-sm"
                onClick={() => void openPublishedDocs(externalDocsUrl)}
                title="Open external docs"
              >
                External
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1 text-[11px] font-medium text-muted-foreground hover:text-foreground justify-center rounded-sm"
                onClick={() => void openPublishedDocs(publicDocsUrl)}
                title="Open public docs"
              >
                Public
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 mx-auto text-[10px] text-muted-foreground"
                onClick={() => void openPublishedDocs(internalDocsUrl)}
                title="Open internal docs"
              >
                I
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 mx-auto text-[10px] text-muted-foreground"
                onClick={() => void openPublishedDocs(externalDocsUrl)}
                title="Open external docs"
              >
                E
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 mx-auto text-[10px] text-muted-foreground"
                onClick={() => void openPublishedDocs(publicDocsUrl)}
                title="Open public docs"
              >
                P
              </Button>
            </div>
          )}
        </div>

        {sidebarCollapsed ? (
          <div className="flex-1 flex flex-col items-center gap-1.5 py-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setShowConfigureTabs(true)}
              title="Configure content hierarchy"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setAddSectionParentId(null);
                setAddSectionPreferredType(undefined);
                setAddSectionCloneFromId(null);
                setShowAddSection(true);
              }}
              title="New product"
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => openImportDialogForTarget(null)}
              title="Import content"
            >
              <ArrowUpFromLine className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => openAddVersionDialog()}
              disabled={!canCreateVersionForSelectedProduct}
              title="New version"
            >
              <GitBranchPlus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => { setAddPageSectionId(defaultAddPageSectionId); setShowAddPage(true); }}
              title="New page"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <div className="mt-auto flex flex-col items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setShowInviteMember(true)}
                disabled={!org?.id}
                title="Invite members"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => syncAll.mutate()}
                disabled={!driveConnected || syncAll.isPending}
                title="Sync all pages"
              >
                {syncAll.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <RefreshCw className="h-4 w-4" />
                }
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={handleSignOut}
                disabled={isSigningOut}
                title="Log out"
              >
                {isSigningOut
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <LogOut className="h-4 w-4" />
                }
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Nav */}
            <div className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
              <div className="flex items-center justify-between px-2 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                  Content
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setShowConfigureTabs(true)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-accent"
                    title="Configure content hierarchy"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setAddSectionParentId(null);
                      setAddSectionPreferredType(undefined);
                      setAddSectionCloneFromId(null);
                      setShowAddSection(true);
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-accent"
                    title="New product"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-accent"
                        title="Import content"
                      >
                        <ArrowUpFromLine className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => openImportDialogForTarget(null)}>
                        <FolderOpen className="h-3 w-3 mr-2" />
                        Import to workspace root
                      </DropdownMenuItem>
                      {selectedImportTargetSection && (
                        <DropdownMenuItem onClick={() => openImportDialogForTarget(selectedImportTargetSection)}>
                          <ArrowUpFromLine className="h-3 w-3 mr-2" />
                          Import into "{selectedImportTargetSection.name}"
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    onClick={() => openAddVersionDialog()}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
                    disabled={!canCreateVersionForSelectedProduct}
                    title="New version"
                  >
                    <GitBranchPlus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { setAddPageSectionId(defaultAddPageSectionId); setShowAddPage(true); }}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-accent"
                    title="New page"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {isProductHierarchy && rootProducts.length > 0 && (
                <div className="px-2 mb-2 flex items-center gap-1">
                  <div className="flex-1">
                    <Select value={selectedSidebarProductValue} onValueChange={handleSidebarProductSwitch}>
                      <SelectTrigger className="h-7 text-[11px] focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:ring-0">
                        <SelectValue placeholder="Choose product" />
                      </SelectTrigger>
                      <SelectContent>
                        {rootProducts.map((product) => (
                          <SelectItem key={product.id} value={String(product.id)}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedProduct && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          title="Product options"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => setRenamingSection(selectedProduct)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Rename product
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={openAddVersionDialog} disabled={!canCreateVersionForSelectedProduct}>
                          <GitBranchPlus className="h-3.5 w-3.5 mr-2" />
                          New version
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            const confirmed = window.confirm(
                              `Delete product "${selectedProduct.name}"?\n\nIts Drive folder will be moved to trash.`,
                            );
                            if (!confirmed) return;
                            deleteSection.mutate(selectedProduct.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete product
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
              {isProductHierarchy && selectedProduct && productVersions.length > 0 && (
                <div className="px-2 mb-2 flex items-center gap-1">
                  <div className="flex-1">
                    <Select value={selectedSidebarVersionValue} onValueChange={handleSidebarVersionSwitch}>
                      <SelectTrigger className="h-7 text-[11px] focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:ring-0">
                        <SelectValue placeholder="Choose version" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__base__">{selectedProduct?.name || "Original"}</SelectItem>
                        {productVersions.map((version) => (
                          <SelectItem key={version.id} value={String(version.id)}>
                            {version.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedVersion && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          title="Version options"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => setRenamingSection(selectedVersion)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Rename version
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            const confirmed = window.confirm(
                              `Delete version "${selectedVersion.name}"?\n\nIts Drive folder will be moved to trash.`,
                            );
                            if (!confirmed) return;
                            deleteSection.mutate(selectedVersion.id);
                            setSelectedSidebarVersionId(null);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete version
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
              {shouldShowAdminTree && (
                adminTreeSections.length === 0 && adminRootPages.length === 0 ? (
                  <div className="px-2 py-4 text-center">
                    <p className="text-xs text-muted-foreground/60">
                      {visibilityFilter === "all" ? "No content yet" : "No content for this visibility"}
                    </p>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  >
                    {/* Unsectioned pages */}
                    <SortableContext
                      items={adminRootPages.map((p) => `page-${p.id}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      {adminRootPages.map((page) => (
                        <PageItem
                          key={page.id}
                          page={page}
                          visibility={resolveEffectivePageVisibility(page, sectionsById)}
                          showVisibilityBadge={page.visibility_override !== null || resolveEffectivePageVisibility(page, sectionsById) !== "public"}
                          selectedPageId={selectedPageId}
                          onSelect={setSelectedPageId}
                          onEditTitle={setRenamingPage}
                          onEditSlug={setEditingPageSlug}
                          onMove={setMovingPage}
                          onRearrange={handleRearrangePage}
                          onSetVisibilityOverride={(p, visibility) =>
                            updatePageVisibility.mutate({ id: p.id, visibility_override: visibility })
                          }
                          onDuplicate={(p) => duplicatePage.mutate(p.id)}
                          onUnpublish={handleUnpublishPage}
                          onDelete={handleDeletePage}
                        />
                      ))}
                    </SortableContext>

                    {/* Section tree */}
                    <SortableContext
                      items={adminTreeSections.map((s) => `sect-${s.id}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      {adminTreeSections.map((section) => (
                        <SectionNode
                          key={section.id}
                          section={section}
                          pages={visiblePages}
                          selectedPageId={selectedPageId}
                          onSelectPage={setSelectedPageId}
                          depth={adminSectionDepthBase}
                          activeDragType={activeDragType}
                          hierarchyMode={org?.hierarchy_mode === "flat" ? "flat" : "product"}
                          onAddPage={(sectionId) => { setAddPageSectionId(sectionId); setShowAddPage(true); }}
                          onAddSubSection={(parentId) => {
                            setAddSectionParentId(parentId);
                            setAddSectionPreferredType(undefined);
                            setAddSectionCloneFromId(null);
                            setShowAddSection(true);
                          }}
                          onImportHere={(section) => openImportDialogForTarget(section)}
                          onRenameSection={setRenamingSection}
                          onMoveSection={setMovingSection}
                          onDeleteSection={(s) => deleteSection.mutate(s.id)}
                          onChangeSectionType={(s, nextType) =>
                            updateSectionType.mutate({
                              id: s.id,
                              section_type: nextType,
                            })
                          }
                          onSetSectionVisibility={(s, visibility) =>
                            updateSectionVisibility.mutate({ id: s.id, visibility })
                          }
                          onRenamePage={setRenamingPage}
                          onEditPageSlug={setEditingPageSlug}
                          onMovePage={setMovingPage}
                          onSetPageVisibilityOverride={(p, visibility) =>
                            updatePageVisibility.mutate({ id: p.id, visibility_override: visibility })
                          }
                          onDuplicatePage={(p) => duplicatePage.mutate(p.id)}
                          onUnpublishPage={handleUnpublishPage}
                          onRearrangePage={handleRearrangePage}
                          onDeletePage={handleDeletePage}
                        />
                      ))}
                    </SortableContext>

                    {/* Ghost overlay while dragging */}
                    <DragOverlay>
                      {activeDragType && (
                        <div className={cn(
                          "px-2 py-1.5 rounded-md text-xs font-medium shadow-lg border bg-background text-foreground",
                          activeDragType === "section" ? "uppercase tracking-wide text-muted-foreground/70" : "",
                        )}>
                          {activeDragLabel}
                        </div>
                      )}
                    </DragOverlay>
                  </DndContext>
                )
              )}
            </div>

            {/* Sidebar footer */}
            <div className="border-t px-2 py-2 space-y-2 bg-background/30">
              <div className="rounded-md border bg-background/80">
                <button
                  type="button"
                  onClick={() => setDrivePanelOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-2 py-2 text-left"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Drive</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground/70 transition-transform", drivePanelOpen && "rotate-180")} />
                </button>
                {drivePanelOpen && (
                  <div className="px-1 pb-1 space-y-0.5">
                    {!driveConnected && (
                      <div className="px-1 pb-1">
                        {canManageDrive ? (
                          <>
                            <button
                              onClick={handleConnectDrive}
                              disabled={isConnectingDrive}
                              className="flex items-center w-full gap-2 px-2 py-2 rounded-md text-xs text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                            >
                              {isConnectingDrive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                              {isConnectingDrive ? "Connecting..." : "Connect Drive"}
                            </button>
                            <p className="px-2 pt-1 text-[11px] text-muted-foreground/70">
                              Required for import, sync, and Google Doc updates.
                            </p>
                          </>
                        ) : (
                          <p className="px-2 pt-1 text-[11px] text-muted-foreground/70">
                            Drive is managed by workspace owner/admin.
                          </p>
                        )}
                      </div>
                    )}
                    {driveConnected && !driveStatus?.drive_folder_id && canManageDrive && (
                      <button
                        onClick={() => openImportDialogForTarget(null)}
                        className="flex items-center w-full gap-2 px-2 py-2 rounded-md text-xs text-primary hover:bg-primary/10 transition-colors"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        Set root folder
                      </button>
                    )}
                    {driveConnected && !driveStatus?.drive_folder_id && !canManageDrive && (
                      <p className="px-2 py-1 text-[11px] text-muted-foreground/70">
                        Workspace root folder is not configured yet. Ask owner/admin to set it.
                      </p>
                    )}
                    <button
                      onClick={() => openImportDialogForTarget(null)}
                      disabled={!driveConnected}
                      className="flex items-center w-full gap-2 px-2 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <FolderOpen className="h-3.5 w-3.5 opacity-60" />
                      Import content
                    </button>
                    <button
                      disabled={!driveConnected || syncAll.isPending}
                      onClick={() => syncAll.mutate()}
                      className="flex items-center w-full gap-2 px-2 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {syncAll.isPending
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin opacity-60" />
                        : <RefreshCw className="h-3.5 w-3.5 opacity-60" />
                      }
                      Sync all pages
                    </button>
                    <div className="mx-1 mt-1 rounded-md border bg-background/70 px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Wifi className={cn("h-3 w-3", driveConnected ? "text-emerald-500" : "text-muted-foreground/50")} />
                          <span className="text-[11px] text-muted-foreground/70 truncate">
                            {driveConnected ? "Drive connected" : "Drive not connected"}
                          </span>
                        </div>
                        {driveConnected && driveStatus?.drive_folder_id && (
                          <button
                            onClick={() => window.open(`https://drive.google.com/drive/folders/${driveStatus.drive_folder_id}`, "_blank")}
                            className="text-[11px] text-muted-foreground/60 hover:text-foreground underline-offset-2 hover:underline shrink-0"
                            title={`Folder ID: ${driveStatus.drive_folder_id}`}
                          >
                            Root folder
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-md border bg-background/80">
                <button
                  type="button"
                  onClick={() => setAccountPanelOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-2 py-2 text-left"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Account</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground/70 transition-transform", accountPanelOpen && "rotate-180")} />
                </button>
                {accountPanelOpen && (
                  <div className="px-1 pb-1 space-y-1">
                    <div className="mx-1 rounded-md border bg-background/70 px-2 py-2">
                      <p className="text-xs font-medium truncate">{accountName}</p>
                      {accountEmail && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{accountEmail}</p>}
                    </div>
                    <button
                      onClick={() => setShowWorkspaceSettings(true)}
                      disabled={!canManageWorkspace}
                      className="flex items-center w-full gap-2 px-2 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Settings className="h-3.5 w-3.5 opacity-60" />
                      Workspace settings
                    </button>
                    <button
                      onClick={() => setShowInviteMember(true)}
                      disabled={!org?.id}
                      className="flex items-center w-full gap-2 px-2 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <UserPlus className="h-3.5 w-3.5 opacity-60" />
                      Invite members
                    </button>
                    <button
                      onClick={() => setShowExternalAccessPanel(true)}
                      disabled={!org?.id}
                      className="flex items-center w-full gap-2 px-2 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Users className="h-3.5 w-3.5 opacity-60" />
                      External access
                    </button>
                    <button
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                      className="flex items-center w-full gap-2 px-2 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-40"
                    >
                      {isSigningOut ? <Loader2 className="h-3.5 w-3.5 animate-spin opacity-60" /> : <LogOut className="h-3.5 w-3.5 opacity-60" />}
                      {isSigningOut ? "Signing out..." : "Log out"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </aside>

      {/* ── Main ──────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden flex flex-col min-w-0 bg-background">
        {selectedPage ? (
          <>
            {/* Toolbar */}
            <header className="flex items-center gap-3 px-6 py-2.5 border-b shrink-0 bg-background/80 backdrop-blur-sm">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="font-semibold text-sm truncate leading-snug">{selectedPage.title}</h1>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] px-1.5 py-0 h-[18px] font-semibold rounded",
                      selectedPage.status === "published"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/10"
                        : selectedPage.is_published
                          ? "bg-amber-500/10 text-amber-600 border-amber-200 hover:bg-amber-500/10"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {selectedPage.status === "published"
                      ? "Published"
                      : selectedPage.is_published
                        ? "Changes pending"
                        : "Draft"}
                  </Badge>
                  {selectedPage.last_synced_at && (
                    <span className="text-[11px] text-muted-foreground/50 hidden sm:block">
                      Synced {new Date(selectedPage.last_synced_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {selectedPage.is_published && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1.5 text-muted-foreground"
                    onClick={() => {
                      if (selectedPagePublishedUrl) void openPublishedDocs(selectedPagePublishedUrl);
                    }}
                  >
                    <ExternalLink className="h-3 w-3" /> View {selectedPageEffectiveVisibility ?? "live"}
                  </Button>
                )}
                {selectedPage.is_published && selectedPagePublishedUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1.5 text-muted-foreground"
                    onClick={() => void copyPublishedLink()}
                  >
                    <Copy className="h-3 w-3" /> Copy link
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1.5 text-muted-foreground"
                  disabled={syncPage.isPending}
                  onClick={() => syncPage.mutate(selectedPage.id)}
                >
                  {syncPage.isPending
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <RefreshCw className="h-3 w-3" />
                  }
                  Sync
                </Button>

                {selectedPage.is_published && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={unpublishPage.isPending}
                    onClick={() => unpublishPage.mutate(selectedPage.id)}
                  >
                    Unpublish
                  </Button>
                )}
                {selectedPage.status !== "published" && (
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    disabled={publishPage.isPending || !selectedPage.html_content || !selectedPage.section_id}
                    onClick={() => publishPage.mutate(selectedPage.id)}
                  >
                    {publishPage.isPending
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <ArrowUpFromLine className="h-3 w-3" />
                    }
                    Publish
                  </Button>
                )}
                {selectedPage.status !== "published" && !selectedPage.section_id && (
                  <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    Move page into a section to publish
                  </span>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => window.open(`https://docs.google.com/document/d/${selectedPage.google_doc_id}/edit`, "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-2 opacity-60" /> Open in Google Docs
                    </DropdownMenuItem>
                    {selectedPage.is_published && selectedPagePublishedUrl && (
                      <DropdownMenuItem onClick={() => void copyPublishedLink()}>
                        <Copy className="h-3.5 w-3.5 mr-2 opacity-60" /> Copy published link
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setRenamingPage(selectedPage)}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Title
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditingPageSlug(selectedPage)}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Edit URL slug
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setMovingPage(selectedPage)}>
                      <ArrowRightLeft className="h-3.5 w-3.5 mr-2" /> Move
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleRearrangePage(selectedPage)}>
                      <ListOrdered className="h-3.5 w-3.5 mr-2" /> Re-arrange
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        updatePageVisibility.mutate({ id: selectedPage.id, visibility_override: null })
                      }
                    >
                      {(selectedPage.visibility_override ?? null) === null ? "✓ " : ""}Use section visibility
                    </DropdownMenuItem>
                    {visibilityOptions.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() =>
                          updatePageVisibility.mutate({ id: selectedPage.id, visibility_override: opt.value })
                        }
                      >
                        {(selectedPage.visibility_override ?? null) === opt.value ? "✓ " : ""}{opt.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => duplicatePage.mutate(selectedPage.id)}>
                      <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!selectedPage.is_published}
                      className={cn(!selectedPage.is_published && "opacity-50")}
                      onClick={() => handleUnpublishPage(selectedPage)}
                    >
                      <Circle className="h-2.5 w-2.5 mr-2 fill-red-500 text-red-500" /> Unpublish
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => handleDeletePage(selectedPage)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete page
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            {selectedProduct && productTabs.length > 0 && (
              <div className="border-b px-6 py-2 bg-background">
                <div className="flex items-center gap-1 overflow-x-auto">
                  {productTabs.map((tab) => {
                    const isActive = selectedTab?.id === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          const firstPage = findFirstPageInSection(tab.id);
                          if (firstPage) {
                            setSelectedPageId(firstPage.id);
                          } else {
                            toast({
                              title: "No pages in tab",
                              description: `Add a page under "${tab.name}" to open this tab.`,
                            });
                          }
                        }}
                        className={cn(
                          "h-8 rounded-md px-3 text-xs font-medium whitespace-nowrap transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent",
                        )}
                      >
                        {tab.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 min-h-0 flex">
              <ReaderHierarchy
                title={readerHierarchyTitle}
                pages={visiblePages}
                topPages={readerHierarchyTopPages}
                rootSections={readerHierarchySections}
                sectionsById={sectionsById}
                sectionDepthById={sectionDepthById}
                hierarchyMode={org?.hierarchy_mode === "flat" ? "flat" : "product"}
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                activeDragType={activeDragType}
                activeDragLabel={activeDragLabel}
                hideVersionSections={Boolean(selectedProduct && !selectedVersion)}
                visibilityFilter={visibilityFilter}
                onVisibilityFilterChange={setVisibilityFilter}
                selectedPageId={selectedPageId}
                onSelectPage={setSelectedPageId}
                onAddPage={(sectionId) => { setAddPageSectionId(sectionId); setShowAddPage(true); }}
                onAddSubSection={(parentId) => {
                  setAddSectionParentId(parentId);
                  setAddSectionPreferredType(undefined);
                  setAddSectionCloneFromId(null);
                  setShowAddSection(true);
                }}
                onImportHere={(section) => openImportDialogForTarget(section)}
                onRenameSection={setRenamingSection}
                onMoveSection={setMovingSection}
                onDeleteSection={(s) => deleteSection.mutate(s.id)}
                onChangeSectionType={(s, nextType) =>
                  updateSectionType.mutate({
                    id: s.id,
                    section_type: nextType,
                  })
                }
                onSetSectionVisibility={(s, visibility) =>
                  updateSectionVisibility.mutate({ id: s.id, visibility })
                }
                onRenamePage={setRenamingPage}
                onEditPageSlug={setEditingPageSlug}
                onMovePage={setMovingPage}
                onSetPageVisibilityOverride={(p, visibility) =>
                  updatePageVisibility.mutate({ id: p.id, visibility_override: visibility })
                }
                onDuplicatePage={(p) => duplicatePage.mutate(p.id)}
                onUnpublishPage={handleUnpublishPage}
                onRearrangePage={handleRearrangePage}
                onDeletePage={handleDeletePage}
              />
              <div className="flex-1 min-w-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_16rem]">
                <div className="dashboard-doc-scroll overflow-y-auto">
                  {selectedPage.html_content ? (
                    <div
                      className="dashboard-doc-content prose prose-sm prose-neutral max-w-4xl mx-auto px-8 py-10 xl:px-10"
                      dangerouslySetInnerHTML={{ __html: selectedPage.html_content }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                      <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center">
                        <BookOpen className="h-5 w-5 opacity-40" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">No content yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">Sync this page to pull content from Google Docs</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 mt-1"
                        disabled={syncPage.isPending}
                        onClick={() => syncPage.mutate(selectedPage.id)}
                      >
                        {syncPage.isPending
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <RefreshCw className="h-3.5 w-3.5" />
                        }
                        Sync from Google Docs
                      </Button>
                    </div>
                  )}
                </div>
                <aside className="hidden xl:block border-l bg-background/60">
                  <div className="sticky top-0 h-[calc(100vh-108px)] overflow-y-auto p-4">
                    <TableOfContents
                      key={selectedPage.id}
                      html={selectedPage.html_content}
                      contentContainerSelector=".dashboard-doc-content"
                      scrollContainerSelector=".dashboard-doc-scroll"
                    />
                  </div>
                </aside>
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center flex-1 gap-5 px-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: `${org?.primary_color ?? "#6366f1"}15` }}
            >
              <BookOpen
                className="h-7 w-7"
                style={{ color: org?.primary_color ?? "#6366f1" }}
              />
            </div>
            <div className="text-center max-w-sm">
              <h2 className="font-semibold text-base tracking-tight">
                Welcome to {org?.name ?? "AccelDocs"}
              </h2>
              <p className="text-muted-foreground text-sm mt-1.5 leading-relaxed">
                Select a page from the sidebar, or get started by importing your Google Drive folder.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => openImportDialogForTarget(null)}>
                <FolderOpen className="h-3.5 w-3.5" /> Import content
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setShowConfigureTabs(true)}
              >
                <Settings className="h-3.5 w-3.5" /> Tabs (optional)
              </Button>
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => { setAddPageSectionId(defaultAddPageSectionId); setShowAddPage(true); }}>
                <Plus className="h-3.5 w-3.5" /> Add page
              </Button>
            </div>
          </div>
        )}
      </main>

      {showAddPage && <AddPageDialog sectionId={addPageSectionId} onClose={() => setShowAddPage(false)} />}
      {showAddSection && (
        <AddSectionDialog
          parentId={addSectionParentId}
          allSections={sections}
          hierarchyMode={org?.hierarchy_mode === "flat" ? "flat" : "product"}
          preferredType={addSectionPreferredType}
          cloneFromSectionId={addSectionCloneFromId}
          onClose={() => {
            setShowAddSection(false);
            setAddSectionParentId(null);
            setAddSectionPreferredType(undefined);
            setAddSectionCloneFromId(null);
          }}
        />
      )}
      {showScanDrive && (
        <ScanDriveDialog
          onClose={() => { setShowScanDrive(false); setScanTarget(null); }}
          onSuccess={() => {
            if (!scanTarget) setShowConfigureTabs(true);
          }}
          rootFolderId={org?.drive_folder_id ?? driveStatus?.drive_folder_id ?? null}
          driveConnected={driveConnected}
          canManageDrive={canManageDrive}
          target={scanTarget}
          allSections={sections}
        />
      )}
      {showConfigureTabs && (
        <ConfigureTabsDialog
          sections={sections}
          hierarchyMode={org?.hierarchy_mode === "flat" ? "flat" : "product"}
          onClose={() => setShowConfigureTabs(false)}
        />
      )}
      {showExternalAccessPanel && org?.id && (
        <ProjectSharePanel
          open={showExternalAccessPanel}
          onOpenChange={setShowExternalAccessPanel}
          projectId={String(selectedProduct?.id ?? org.id)}
          projectName={selectedProduct?.name ?? org.name}
          organizationSlug={org.slug ?? null}
          projectSlug={selectedProduct?.slug ?? null}
        />
      )}
      {showInviteMember && org && (
        <InviteMemberDialog
          open={showInviteMember}
          onOpenChange={setShowInviteMember}
          organizationName={org.name}
          organizationDomain={org.domain}
        />
      )}
      {showWorkspaceSettings && org && canManageWorkspace && (
        <WorkspaceSettingsDialog
          org={org}
          onClose={() => setShowWorkspaceSettings(false)}
        />
      )}
      {renamingSection && (
        <RenameDialog
          label="section"
          initialValue={renamingSection.name}
          onSave={(name) => updateSection.mutate({ id: renamingSection.id, name })}
          onClose={() => setRenamingSection(null)}
        />
      )}
      {renamingPage && (
        <RenameDialog
          label="page title"
          initialValue={renamingPage.title}
          onSave={(title) => updatePage.mutate({ id: renamingPage.id, title })}
          onClose={() => setRenamingPage(null)}
        />
      )}
      {editingPageSlug && (
        <RenameDialog
          label="URL slug"
          initialValue={editingPageSlug.slug}
          onSave={(slug) => updatePageSlug.mutate({ id: editingPageSlug.id, slug })}
          onClose={() => setEditingPageSlug(null)}
        />
      )}
      {movingSection && (
        <MoveSectionDialog
          section={movingSection}
          allSections={sections}
          onClose={() => setMovingSection(null)}
        />
      )}
      {movingPage && (
        <MovePageDialog
          page={movingPage}
          allSections={sections}
          allPages={pages}
          onClose={() => setMovingPage(null)}
        />
      )}
    </div>
  );
}
