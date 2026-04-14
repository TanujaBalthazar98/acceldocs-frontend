/**
 * AccelDocs Dashboard — clean architecture rebuild.
 */

import { useState, useCallback, useMemo, useEffect, useRef, type ChangeEvent } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { useLocation, useNavigate } from "react-router-dom";

import { orgApi, sectionsApi, pagesApi, driveApi, buildSectionTree } from "@/api";
import { driveErrorMessage } from "@/api/drive";
import type { AIProvider, Org, Section, Page, ImportTargetType, EngagementOverview } from "@/api/types";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  BarChart3,
  ClipboardCheck,
  Circle,
  Check,
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
  ArrowUp,
  ArrowDown,
  XCircle,
  Search,
  GitBranchPlus,
  UserPlus,
  Users,
  Wifi,
  Menu,
  X,
  PanelLeftOpen,
  Sparkles,
  Lock,
  Globe,
  Share2,
  PanelLeft,
  PanelRight,
  Columns3,
  Type,
  Link2,
  Megaphone,
  LayoutGrid,
  Palette,
  Image,
  Wand2,
  Bot,
  Code2,
  Eye,
  EyeOff,
  CheckCircle,
  MessageSquare,
  ThumbsUp,
  Clock3,
ChevronUp,
ChevronDown,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { API_BASE_URL, getAuthToken } from "@/api/client";
import { openGoogleDocWithAcl } from "@/lib/googleDocsAccess";
import { ProjectSharePanel } from "@/components/dashboard/ProjectSharePanel";
import { InviteMemberDialog } from "@/components/dashboard/InviteMemberDialog";
import { WorkspaceSwitcher, setStoredOrgId, getStoredOrgId } from "@/components/dashboard/WorkspaceSwitcher";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { ApprovalsPanel } from "@/components/dashboard/ApprovalsPanel";
import { AgentChatPanel } from "@/components/dashboard/AgentChatPanel";
import InlineAssistDialog from "@/components/dashboard/InlineAssistDialog";
import { NotificationCenter } from "@/components/dashboard/NotificationCenter";
import { TemplatePickerDialog } from "@/components/dashboard/TemplatePickerDialog";
import { APISettingsPanel } from "@/components/dashboard/APISettingsPanel";
import { invokeFunction } from "@/lib/api/functions";

type VisibilityLevel = "public" | "internal" | "external";
type VisibilityFilter = "all" | VisibilityLevel;
type LocalImportMode = "files" | "folder";
type DashboardPaneMode = "content" | "analytics" | "approvals" | "agent" | "developer";

type DriveImportTarget = {
  id: number;
  name: string;
  type: ImportTargetType;
};

type DropPosition = "before" | "inside" | "after";
type PageOrderUpdate = { id: number; section_id: number | null; display_order: number };
type SectionOrderUpdate = { id: number; parent_id: number | null; display_order: number };

type ParsedDashboardLocation = {
  mode: DashboardPaneMode;
  pageId: number | null;
  approvalId: string | null;
  workspaceId: number | null;
};

function parseNumberId(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSlugSegment(raw: string | null | undefined): string {
  const seed = String(raw || "").trim().toLowerCase();
  if (!seed) return "";
  return seed
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatRelativeTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "—";
  const diffMs = Date.now() - parsed;
  const absMs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (absMs < minute) return "just now";
  if (absMs < hour) return `${Math.round(absMs / minute)} min ago`;
  if (absMs < day) return `${Math.round(absMs / hour)} hr ago`;
  return `${Math.round(absMs / day)}d ago`;
}

function formatByteCount(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const scaled = bytes / Math.pow(1024, unitIndex);
  const precision = scaled >= 100 || unitIndex === 0 ? 0 : scaled >= 10 ? 1 : 2;
  return `${scaled.toFixed(precision)} ${units[unitIndex]}`;
}

function sortPagesByDisplayOrder(pages: Page[]): Page[] {
  return [...pages].sort(
    (a, b) =>
      (a.display_order - b.display_order) ||
      a.title.localeCompare(b.title) ||
      (a.id - b.id),
  );
}

function sortSectionsByDisplayOrder(sections: Section[]): Section[] {
  return [...sections].sort(
    (a, b) =>
      (a.display_order - b.display_order) ||
      a.name.localeCompare(b.name) ||
      (a.id - b.id),
  );
}

function resolveDropPosition(active: DragEndEvent["active"], over: DragEndEvent["over"]): DropPosition {
  const translated = active.rect.current.translated;
  const activeTop = translated?.top ?? active.rect.current.initial.top;
  const activeHeight = translated?.height ?? active.rect.current.initial.height;
  const activeCenterY = activeTop + activeHeight / 2;
  const overTop = over.rect.top;
  const overHeight = over.rect.height;
  const beforeThreshold = overTop + overHeight * 0.28;
  const afterThreshold = overTop + overHeight * 0.72;

  if (activeCenterY <= beforeThreshold) return "before";
  if (activeCenterY >= afterThreshold) return "after";
  return "inside";
}

function parseDashboardLocation(pathname: string, search: string): ParsedDashboardLocation {
  const query = new URLSearchParams(search);
  const segments = pathname.split("/").filter(Boolean);
  const afterDashboard = segments[0] === "dashboard" ? segments.slice(1) : [];
  const tabParam = (query.get("tab") || "").trim().toLowerCase();

  let mode: DashboardPaneMode = "content";
  let pageId: number | null = parseNumberId(query.get("pageId"));
  let approvalId: string | null = (query.get("approvalId") || "").trim() || null;

  const first = (afterDashboard[0] || "").trim().toLowerCase();
  if (first === "analytics") {
    mode = "analytics";
  } else if (first === "approvals") {
    mode = "approvals";
    approvalId = approvalId || (afterDashboard[1] || "").trim() || null;
  } else if (first === "agent") {
    mode = "agent";
  } else if (first === "developer") {
    mode = "developer";
  } else if (first === "content") {
    mode = "content";
    if ((afterDashboard[1] || "").trim().toLowerCase() === "p") {
      pageId = parseNumberId(afterDashboard[2]);
    } else {
      pageId = pageId ?? parseNumberId(afterDashboard[1]);
    }
  } else if (first === "page") {
    mode = "content";
    pageId = parseNumberId(afterDashboard[1]);
  } else if (tabParam === "analytics") {
    mode = "analytics";
  } else if (tabParam === "approvals") {
    mode = "approvals";
  } else if (tabParam === "agent") {
    mode = "agent";
  } else if (tabParam === "developer") {
    mode = "developer";
  } else if (tabParam === "content") {
    mode = "content";
  }

  const workspaceId = parseNumberId(query.get("workspaceId"));
  return { mode, pageId, approvalId, workspaceId };
}

function buildDashboardUrl(params: {
  mode: DashboardPaneMode;
  pageId: number | null;
  pageSlug?: string | null;
  approvalId: string | null;
  workspaceId: number | undefined;
}): string {
  let path = "/dashboard";
  if (params.mode === "analytics") {
    path = "/dashboard/analytics";
  } else if (params.mode === "approvals") {
    path = params.approvalId
      ? `/dashboard/approvals/${encodeURIComponent(params.approvalId)}`
      : "/dashboard/approvals";
  } else if (params.mode === "agent") {
    path = "/dashboard/agent";
  } else if (params.mode === "developer") {
    path = "/dashboard/developer";
  } else if (params.pageId !== null) {
    const slugPart = normalizeSlugSegment(params.pageSlug);
    path = slugPart
      ? `/dashboard/content/p/${params.pageId}/${encodeURIComponent(slugPart)}`
      : `/dashboard/content/p/${params.pageId}`;
  } else {
    path = "/dashboard/content";
  }

  const query = new URLSearchParams();
  if (typeof params.workspaceId === "number" && Number.isFinite(params.workspaceId)) {
    query.set("workspaceId", String(params.workspaceId));
  }
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

const visibilityOptions: Array<{ value: VisibilityLevel; label: string }> = [
  { value: "public", label: "Public" },
  { value: "internal", label: "Internal" },
  { value: "external", label: "External" },
];

const LOCAL_IMPORT_EXTENSIONS = [".md", ".txt", ".html", ".htm", ".doc", ".docx", ".pdf", ".rtf"] as const;
const LOCAL_IMPORT_EXTENSION_SET = new Set<string>(LOCAL_IMPORT_EXTENSIONS);
const LOCAL_IMPORT_ACCEPT = [...LOCAL_IMPORT_EXTENSIONS, ".json"].join(",");
const LOCAL_IMPORT_LABEL = LOCAL_IMPORT_EXTENSIONS.join(", ");
const LOCAL_IMPORT_SETTINGS_FILE = "settings.json";

function localFileExtension(filename: string): string {
  const lower = (filename || "").toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot < 0 || dot === lower.length - 1) return "";
  return lower.slice(dot);
}

function isSettingsManifestCandidate(file: File, mode: LocalImportMode): boolean {
  if (mode !== "folder") return false;
  const rel = ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name || "").toLowerCase();
  return rel.endsWith(`/${LOCAL_IMPORT_SETTINGS_FILE}`) || rel === LOCAL_IMPORT_SETTINGS_FILE;
}

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

function toDriveImportTarget(section: Section): DriveImportTarget {
  return {
    id: section.id,
    name: section.name,
    type: inferImportTargetType(section),
  };
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
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
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

  const createFromTemplate = useMutation({
    mutationFn: (vars: { title: string; content: string }) =>
      pagesApi.createFromTemplate({ title: vars.title, content: vars.content, section_id: sectionId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      toast({ title: "Page created from template" });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const isPending = create.isPending || createFromTemplate.isPending;

  return (
    <>
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

            {/* Template shortcut */}
            {!docId && (
              <div className="rounded-lg border border-dashed p-3 flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Start from a template</span>
                  {" "}— pre-built structures for common doc types
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  disabled={isPending}
                  onClick={() => setShowTemplatePicker(true)}
                >
                  Browse templates
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" disabled={(!resolvedId && !title.trim()) || isPending} onClick={() => create.mutate()}>
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {resolvedId ? "Add page" : "Create page"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TemplatePickerDialog
        open={showTemplatePicker}
        onOpenChange={setShowTemplatePicker}
        onSelectTemplate={(template) => {
          const templateTitle = title.trim() || template.name;
          createFromTemplate.mutate({ title: templateTitle, content: template.content });
          setShowTemplatePicker(false);
        }}
      />
    </>
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
  const [localImportProgress, setLocalImportProgress] = useState<{
    phase: "uploading" | "processing";
    loadedBytes: number;
    totalBytes: number | null;
  } | null>(null);
  const ROOT_DESTINATION_VALUE = "__workspace_root__";
  const [driveTargetId, setDriveTargetId] = useState<string>(
    target ? String(target.id) : ROOT_DESTINATION_VALUE,
  );
  const [localTargetId, setLocalTargetId] = useState<number | null>(target?.id ?? null);
  const filesInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const setFolderInputRef = useCallback((node: HTMLInputElement | null) => {
    folderInputRef.current = node;
    if (!node) return;
    node.setAttribute("webkitdirectory", "");
    node.setAttribute("directory", "");
  }, []);

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
  const selectedDriveTarget = useMemo(() => {
    if (driveTargetId === ROOT_DESTINATION_VALUE) return null;
    const parsed = Number(driveTargetId);
    if (!Number.isFinite(parsed)) return null;
    return destinationOptions.find((option) => option.id === parsed) ?? null;
  }, [destinationOptions, driveTargetId]);
  const localImportTarget = target ?? selectedLocalTarget;
  const driveImportTarget = selectedDriveTarget;
  const hasExistingTopLevelContent = useMemo(
    () => allSections.some((section) => section.parent_id === null),
    [allSections],
  );

  useEffect(() => {
    if (target) {
      setDriveFolderInput("");
      setSource("drive");
      setDriveTargetId(String(target.id));
      setLocalTargetId(target.id);
    } else {
      setDriveFolderInput(resolvedRootFolderId);
      setDriveTargetId(ROOT_DESTINATION_VALUE);
      setLocalTargetId((prev) => {
        if (prev !== null && destinationOptions.some((option) => option.id === prev)) return prev;
        return defaultLocalTargetId;
      });
    }
    setLocalFiles([]);
    setRelativePaths([]);
    setLocalImportProgress(null);
  }, [target, resolvedRootFolderId, defaultLocalTargetId, destinationOptions]);

  const rootFolderMissing = !resolvedRootFolderId;
  const parsedDriveFolderId = parseDriveFolderId(driveFolderInput);
  const canConfigureRootFolder = !rootFolderMissing || canManageDrive;
  const canImportDriveFolder = driveImportTarget
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
      if (driveImportTarget) {
        if (!parsedDriveFolderId) {
          throw new Error("Paste a Google Drive folder URL or ID to import into the selected destination.");
        }
        return driveApi.scan(parsedDriveFolderId, driveImportTarget.id, driveImportTarget.type);
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
        description: driveImportTarget
          ? `${result.sections_created} sections, ${result.pages_created} pages imported into ${driveImportTarget.name}`
          : `${result.sections_created} sections, ${result.pages_created} pages from "${result.folder_name}"`,
      });
      onClose();
      onSuccess();
    },
    onError: (err: Error) => toast({ title: "Import failed", description: driveErrorMessage(err), variant: "destructive" }),
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
        onProgress: (progress) => setLocalImportProgress(progress),
      });
    },
    onMutate: () => {
      setLocalImportProgress({
        phase: "uploading",
        loadedBytes: 0,
        totalBytes: null,
      });
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["sections"] });
      qc.invalidateQueries({ queryKey: ["pages"] });
      const skippedSuffix =
        typeof result.skipped_files === "number" && result.skipped_files > 0
          ? `, skipped ${result.skipped_files} unsupported`
          : "";
      const failedSuffix =
        typeof result.failed_files === "number" && result.failed_files > 0
          ? `, failed ${result.failed_files}`
          : "";
      toast({
        title: "Local import complete",
        description: `${result.uploaded_files} file(s), ${result.sections_created} sections, ${result.pages_created} pages in ${localImportTarget?.name ?? "selected destination"}${skippedSuffix}${failedSuffix}`,
      });
      if ((result.failed_files ?? 0) > 0) {
        toast({
          title: "Some files could not be uploaded",
          description:
            result.failed_file_errors?.[0] ??
            `${result.failed_files} file(s) failed to upload to Google Drive.`,
          variant: "destructive",
        });
      }
      if ((result.settings_manifest_warnings?.length ?? 0) > 0) {
        toast({
          title: "settings.json partially applied",
          description: result.settings_manifest_warnings?.[0] ?? "Some hierarchy rules could not be applied.",
          variant: "destructive",
        });
      }
      onClose();
      onSuccess();
    },
    onError: (err: Error) => toast({ title: "Import failed", description: err.message, variant: "destructive" }),
    onSettled: () => setLocalImportProgress(null),
  });

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>, mode: LocalImportMode) => {
    const selected = Array.from(event.target.files ?? []);
    const supported: File[] = [];
    const skipped: string[] = [];

    for (const file of selected) {
      const ext = localFileExtension(file.name);
      if (LOCAL_IMPORT_EXTENSION_SET.has(ext) || isSettingsManifestCandidate(file, mode)) {
        supported.push(file);
      } else {
        skipped.push(file.name);
      }
    }

    setLocalMode(mode);
    setLocalFiles(supported);
    if (mode === "folder") {
      const paths = supported.map((file) => {
        const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
        return (rel && rel.trim()) ? rel : file.name;
      });
      setRelativePaths(paths);
    } else {
      setRelativePaths(supported.map((file) => file.name));
    }

    if (skipped.length > 0) {
      toast({
        title: "Skipped unsupported files",
        description: `${skipped.length} file(s) were ignored (for example: ${skipped.slice(0, 2).join(", ")}).`,
      });
    }
    if (supported.length === 0 && selected.length > 0) {
      toast({
        title: "No supported files selected",
        description: `Allowed: ${LOCAL_IMPORT_LABEL}`,
        variant: "destructive",
      });
    }

    // Allow selecting the same files/folder again.
    event.target.value = "";
  };

  const isPending = scanFromDrive.isPending || importLocal.isPending;
  const localUploadPercent =
    localImportProgress?.phase === "uploading" && localImportProgress.totalBytes && localImportProgress.totalBytes > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((localImportProgress.loadedBytes / localImportProgress.totalBytes) * 100)),
        )
      : null;
  const estimatedImportedCount =
    localUploadPercent !== null && localFiles.length > 0
      ? Math.max(0, Math.min(localFiles.length, Math.floor((localUploadPercent / 100) * localFiles.length)))
      : null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Import content</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {source === "drive" ? (
            <div className="space-y-1.5 rounded-md border bg-muted/30 px-3 py-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Destination</Label>
              <Select value={driveTargetId} onValueChange={setDriveTargetId}>
                <SelectTrigger className="h-9 text-sm bg-background">
                  <SelectValue placeholder="Choose destination" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROOT_DESTINATION_VALUE}>Workspace root (new product)</SelectItem>
                  {destinationOptions.map((option) => (
                    <SelectItem key={option.id} value={String(option.id)}>
                      <span className="truncate">{option.path} ({importTargetTypeLabel(option.type)})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Import into Product, Version, Tab, or Section. Use workspace root only to add a brand-new top-level product.
              </p>
              {!driveImportTarget && hasExistingTopLevelContent && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                  Root import creates another top-level product. Pick a destination above to avoid orphaned content.
                </div>
              )}
            </div>
          ) : (
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
                    Files import into a Section. Folder import supports Product, Tab, or Section destinations. Optional <code>settings.json</code> in the folder root can define tab/section hierarchy.
                  </p>
                </>
              )}
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
                : `From computer supports: ${LOCAL_IMPORT_LABEL} (+ optional settings.json for folder hierarchy)`}
            </p>
          </div>

          {source === "drive" ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {driveImportTarget
                  ? "Drive folder URL or ID"
                  : rootFolderMissing
                    ? "Root folder URL or ID"
                    : "Connected root folder"}
              </Label>
              {driveImportTarget || rootFolderMissing ? (
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
                    {driveImportTarget
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
                    ref={setFolderInputRef}
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
        {source === "local" && importLocal.isPending && (
          <div className="rounded-md border bg-muted/30 px-3 py-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">
                {localImportProgress?.phase === "processing"
                  ? "Upload complete. Processing hierarchy..."
                  : "Uploading files..."}
              </span>
              {localImportProgress?.phase === "uploading" && localUploadPercent !== null && (
                <span className="text-muted-foreground">{localUploadPercent}%</span>
              )}
            </div>
            <Progress value={localImportProgress?.phase === "processing" ? 100 : (localUploadPercent ?? 8)} className="h-1.5" />
            <div className="text-[11px] text-muted-foreground">
              {localImportProgress?.phase === "processing"
                ? `Converting and creating pages for ${localFiles.length} file(s).`
                : localImportProgress?.totalBytes
                  ? `${formatByteCount(localImportProgress.loadedBytes)} / ${formatByteCount(localImportProgress.totalBytes)}${estimatedImportedCount !== null ? ` • ~${estimatedImportedCount}/${localFiles.length} files uploaded` : ""}`
                  : `Uploading ${localFiles.length} file(s)...`}
            </div>
          </div>
        )}
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

function PageSettingsDialog({ page, onClose }: { page: Page; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [hideToc, setHideToc] = useState(page.hide_toc ?? false);
  const [fullWidth, setFullWidth] = useState(page.full_width ?? false);
  const [customCss, setCustomCss] = useState(page.page_custom_css ?? "");
  const [featuredImage, setFeaturedImage] = useState(page.featured_image_url ?? "");

  const saveSettings = useMutation({
    mutationFn: () =>
      pagesApi.update(page.id, {
        hide_toc: hideToc,
        full_width: fullWidth,
        page_custom_css: customCss.trim() || null,
        featured_image_url: featuredImage.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["page", page.id] });
      qc.invalidateQueries({ queryKey: ["pages"] });
      toast({ title: "Page settings saved" });
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Page settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {/* Display toggles */}
          <div className="rounded-lg border border-border divide-y divide-border">
            <div className="flex items-center justify-between px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Hide table of contents</p>
                <p className="text-xs text-muted-foreground">Remove the TOC rail for this page</p>
              </div>
              <Switch checked={hideToc} onCheckedChange={setHideToc} />
            </div>
            <div className="flex items-center justify-between px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Full width layout</p>
                <p className="text-xs text-muted-foreground">Expand content to fill the page</p>
              </div>
              <Switch checked={fullWidth} onCheckedChange={setFullWidth} />
            </div>
          </div>

          {/* Featured image */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Featured image URL</Label>
            {featuredImage && (
              <div className="rounded-md border border-border overflow-hidden">
                <img
                  src={featuredImage}
                  alt=""
                  className="w-full h-32 object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
            <Input
              value={featuredImage}
              onChange={(e) => setFeaturedImage(e.target.value)}
              placeholder="https://example.com/image.png"
              className="text-xs"
            />
          </div>

          {/* Custom CSS */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Page CSS override</Label>
            <p className="text-[11px] text-muted-foreground -mt-0.5">Scoped to this page only. Overrides workspace-level styles.</p>
            <Textarea
              value={customCss}
              onChange={(e) => setCustomCss(e.target.value)}
              rows={4}
              placeholder=".doc-content { font-size: 15px; }"
              className="font-mono text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
            {saveSettings.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Landing Block Editor helpers
// ---------------------------------------------------------------------------

type BlockType = "cta" | "text" | "links" | "featured_sections" | "featured_pages";

interface LandingBlockEntry {
  id: string;
  type: BlockType;
  props: Record<string, any>;
}

const BLOCK_TYPE_META: Record<BlockType, { label: string; icon: typeof Type; description: string }> = {
  cta: { label: "Call to Action", icon: Megaphone, description: "Highlighted banner with button" },
  text: { label: "Text / HTML", icon: Type, description: "Rich text or HTML content block" },
  links: { label: "Link List", icon: Link2, description: "List of labelled links" },
  featured_sections: { label: "Featured Cards", icon: LayoutGrid, description: "Grid of cards with titles" },
  featured_pages: { label: "Featured Pages", icon: FileText, description: "Grid of page links" },
};

function newBlockId() {
  return Math.random().toString(36).slice(2, 10);
}

function LandingBlockEditor({
  blocks,
  onChange,
}: {
  blocks: LandingBlockEntry[];
  onChange: (blocks: LandingBlockEntry[]) => void;
}) {
  const [addingType, setAddingType] = useState<BlockType | null>(null);

  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const removeBlock = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
  };

  const updateBlock = (index: number, props: Record<string, any>) => {
    const next = [...blocks];
    next[index] = { ...next[index], props: { ...next[index].props, ...props } };
    onChange(next);
  };

  const addBlock = (type: BlockType) => {
    const defaults: Record<BlockType, Record<string, any>> = {
      cta: { title: "", description: "", button_text: "Get started", button_url: "" },
      text: { content: "" },
      links: { title: "", items: [{ label: "", url: "", description: "" }] },
      featured_sections: { title: "", items: [{ title: "", description: "", href: "" }], columns: 3 },
      featured_pages: { title: "", items: [{ title: "", description: "", href: "" }], columns: 3 },
    };
    onChange([...blocks, { id: newBlockId(), type, props: defaults[type] }]);
    setAddingType(null);
  };

  return (
    <div className="space-y-3">
      {blocks.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <LayoutGrid className="h-5 w-5 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground">No custom blocks yet. Add blocks below to customize your landing page.</p>
        </div>
      )}

      {blocks.map((block, index) => {
        const meta = BLOCK_TYPE_META[block.type];
        const Icon = meta?.icon ?? Type;
        return (
          <div key={block.id} className="rounded-lg border border-border bg-card">
            {/* Block header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/30 rounded-t-lg">
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium flex-1">{meta?.label ?? block.type}</span>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveBlock(index, -1)} disabled={index === 0}>
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1}>
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeBlock(index)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Block fields */}
            <div className="p-3 space-y-2.5">
              {block.type === "cta" && (
                <>
                  <Input className="h-8 text-xs" placeholder="Headline" value={block.props.title ?? ""} onChange={(e) => updateBlock(index, { title: e.target.value })} />
                  <Input className="h-8 text-xs" placeholder="Description (optional)" value={block.props.description ?? ""} onChange={(e) => updateBlock(index, { description: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input className="h-8 text-xs" placeholder="Button label" value={block.props.button_text ?? ""} onChange={(e) => updateBlock(index, { button_text: e.target.value })} />
                    <Input className="h-8 text-xs" placeholder="Button URL" value={block.props.button_url ?? ""} onChange={(e) => updateBlock(index, { button_url: e.target.value })} />
                  </div>
                </>
              )}

              {block.type === "text" && (
                <Textarea className="text-xs font-mono" rows={3} placeholder="<p>Your content here...</p>" value={block.props.content ?? ""} onChange={(e) => updateBlock(index, { content: e.target.value })} />
              )}

              {(block.type === "links" || block.type === "featured_sections" || block.type === "featured_pages") && (
                <>
                  <Input className="h-8 text-xs" placeholder="Section title (optional)" value={block.props.title ?? ""} onChange={(e) => updateBlock(index, { title: e.target.value })} />
                  {block.type !== "links" && (
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] text-muted-foreground">Columns</Label>
                      <Select value={String(block.props.columns ?? 3)} onValueChange={(v) => updateBlock(index, { columns: Number(v) })}>
                        <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {(block.props.items ?? []).map((item: any, itemIdx: number) => (
                      <div key={itemIdx} className="flex items-start gap-1.5">
                        <div className="flex-1 grid grid-cols-2 gap-1.5">
                          <Input className="h-7 text-[11px]" placeholder={block.type === "links" ? "Label" : "Title"} value={item.label ?? item.title ?? ""}
                            onChange={(e) => {
                              const items = [...(block.props.items ?? [])];
                              const key = block.type === "links" ? "label" : "title";
                              items[itemIdx] = { ...items[itemIdx], [key]: e.target.value };
                              updateBlock(index, { items });
                            }}
                          />
                          <Input className="h-7 text-[11px]" placeholder={block.type === "links" ? "URL" : "Link (optional)"} value={item.url ?? item.href ?? ""}
                            onChange={(e) => {
                              const items = [...(block.props.items ?? [])];
                              const key = block.type === "links" ? "url" : "href";
                              items[itemIdx] = { ...items[itemIdx], [key]: e.target.value };
                              updateBlock(index, { items });
                            }}
                          />
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => {
                          const items = (block.props.items ?? []).filter((_: any, i: number) => i !== itemIdx);
                          updateBlock(index, { items });
                        }}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 w-full text-muted-foreground" onClick={() => {
                      const template = block.type === "links"
                        ? { label: "", url: "", description: "" }
                        : { title: "", description: "", href: "" };
                      updateBlock(index, { items: [...(block.props.items ?? []), template] });
                    }}>
                      <Plus className="h-3 w-3" /> Add item
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}

      {/* Add block */}
      {addingType === null ? (
        <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5 border-dashed" onClick={() => setAddingType("cta")}>
          <Plus className="h-3.5 w-3.5" /> Add block
        </Button>
      ) : (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Choose block type</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.entries(BLOCK_TYPE_META) as [BlockType, typeof BLOCK_TYPE_META[BlockType]][]).map(([type, meta]) => {
              const Icon = meta.icon;
              return (
                <button
                  key={type}
                  onClick={() => addBlock(type)}
                  className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-accent/50 transition-colors text-left"
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs font-medium">{meta.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{meta.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => setAddingType(null)}>Cancel</Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkspaceSettingsDialog
// ---------------------------------------------------------------------------

function WorkspaceSettingsDialog({
  org,
  onClose,
}: {
  org: Org;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  // General
  const [workspaceName, setWorkspaceName] = useState(org.name ?? "");
  const [customDomain, setCustomDomain] = useState(org.custom_docs_domain ?? "");

  // Layout
  const [sidebarPosition, setSidebarPosition] = useState<"left" | "right">(org.sidebar_position ?? "left");
  const [showToc, setShowToc] = useState<boolean>(org.show_toc ?? true);
  const [codeTheme, setCodeTheme] = useState<string>(org.code_theme ?? "github-dark");
  const [maxContentWidth, setMaxContentWidth] = useState<"4xl" | "5xl" | "6xl" | "full">(org.max_content_width ?? "4xl");
  const [headerHtml, setHeaderHtml] = useState<string>(org.header_html ?? "");
  const [footerHtml, setFooterHtml] = useState<string>(org.footer_html ?? "");

  // Landing blocks
  const [landingBlocks, setLandingBlocks] = useState<LandingBlockEntry[]>(() => {
    if (!org.landing_blocks) return [];
    try {
      const parsed = JSON.parse(org.landing_blocks);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Branding
  const [primaryColor, setPrimaryColor] = useState(org.primary_color ?? "#6366f1");
  const [secondaryColor, setSecondaryColor] = useState(org.secondary_color ?? "");
  const [accentColor, setAccentColor] = useState(org.accent_color ?? "");
  const [fontHeading, setFontHeading] = useState(org.font_heading ?? "");
  const [fontBody, setFontBody] = useState(org.font_body ?? "");
  const [logoUrl, setLogoUrl] = useState(org.logo_url ?? "");
  const [tagline, setTagline] = useState(org.tagline ?? "");
  const [heroTitle, setHeroTitle] = useState(org.hero_title ?? "");
  const [heroDescription, setHeroDescription] = useState(org.hero_description ?? "");
  const [showSearchOnLanding, setShowSearchOnLanding] = useState(org.show_search_on_landing ?? true);
  const [showFeaturedProjects, setShowFeaturedProjects] = useState(org.show_featured_projects ?? true);
  const [analyticsPropertyId, setAnalyticsPropertyId] = useState(org.analytics_property_id ?? "");
  const [copyright, setCopyright] = useState(org.copyright ?? "");
  const [customCss, setCustomCss] = useState(org.custom_css ?? "");
  const [brandUrl, setBrandUrl] = useState("");

  const extractBrand = useMutation({
    mutationFn: () => orgApi.extractBrand(brandUrl.trim()),
    onSuccess: (result) => {
      if (result.name) setWorkspaceName(result.name);
      if (result.tagline) setTagline(result.tagline);
      if (result.logo_url) setLogoUrl(result.logo_url);
      if (result.primary_color) setPrimaryColor(result.primary_color);
      if (result.secondary_color) setSecondaryColor(result.secondary_color);
      if (result.accent_color) setAccentColor(result.accent_color);
      if (result.font_heading) setFontHeading(result.font_heading);
      if (result.font_body) setFontBody(result.font_body);

      toast({
        title: "Brand extracted",
        description: "Previewed settings have been filled. Review and save to apply.",
      });
    },
    onError: (err: Error) =>
      toast({ title: "Brand extraction failed", description: err.message, variant: "destructive" }),
  });

  const save = useMutation({
    mutationFn: async () =>
      orgApi.update({
        name: workspaceName.trim(),
        custom_docs_domain: customDomain.trim() || null,
        sidebar_position: sidebarPosition,
        show_toc: showToc,
        code_theme: codeTheme.trim() || null,
        max_content_width: maxContentWidth,
        header_html: headerHtml.trim() || null,
        footer_html: footerHtml.trim() || null,
        landing_blocks: landingBlocks.length > 0 ? JSON.stringify(landingBlocks) : null,
        primary_color: primaryColor.trim() || null,
        secondary_color: secondaryColor.trim() || null,
        accent_color: accentColor.trim() || null,
        font_heading: fontHeading.trim() || null,
        font_body: fontBody.trim() || null,
        logo_url: logoUrl.trim() || null,
        tagline: tagline.trim() || null,
        hero_title: heroTitle.trim() || null,
        hero_description: heroDescription.trim() || null,
        show_search_on_landing: showSearchOnLanding,
        show_featured_projects: showFeaturedProjects,
        analytics_property_id: analyticsPropertyId.trim() || null,
        copyright: copyright.trim() || null,
        custom_css: customCss.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org"] });
      qc.invalidateQueries({ queryKey: ["org", org.id] });
      qc.invalidateQueries({ queryKey: ["org-list"] });
      toast({ title: "Settings saved" });
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const canSave = workspaceName.trim().length > 0 && !save.isPending;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="text-base">Docs settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="branding" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="mx-6 w-fit grid grid-cols-5 h-8">
            <TabsTrigger value="branding" className="text-xs px-3 h-7">Branding</TabsTrigger>
            <TabsTrigger value="layout" className="text-xs px-3 h-7">Layout</TabsTrigger>
            <TabsTrigger value="landing" className="text-xs px-3 h-7">Landing</TabsTrigger>
            <TabsTrigger value="advanced" className="text-xs px-3 h-7">Advanced</TabsTrigger>
            <TabsTrigger value="ai" className="text-xs px-3 h-7">AI</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* ---- BRANDING TAB ---- */}
            <TabsContent value="branding" className="mt-0 space-y-5">
              <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
                <Label className="text-xs font-medium">Extract brand from website</Label>
                <p className="text-[11px] text-muted-foreground -mt-0.5">
                  Paste your website URL to auto-fill logo, colors, fonts, and tagline.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    value={brandUrl}
                    onChange={(e) => setBrandUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && brandUrl.trim() && !extractBrand.isPending) {
                        extractBrand.mutate();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0"
                    disabled={!brandUrl.trim() || extractBrand.isPending}
                    onClick={() => extractBrand.mutate()}
                  >
                    {extractBrand.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    <span className="ml-1">Analyze</span>
                  </Button>
                </div>
              </div>

              {/* Colors */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Brand colors</Label>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { label: "Primary", value: primaryColor, set: setPrimaryColor },
                    { label: "Secondary", value: secondaryColor, set: setSecondaryColor },
                    { label: "Accent", value: accentColor, set: setAccentColor },
                  ] as const).map(({ label, value, set }) => (
                    <div key={label} className="space-y-1">
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={value || "#6366f1"}
                          onChange={(e) => set(e.target.value)}
                          className="h-8 w-8 rounded border border-border cursor-pointer shrink-0 p-0"
                        />
                        <Input
                          value={value}
                          onChange={(e) => set(e.target.value)}
                          placeholder="#6366f1"
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fonts */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Heading font</Label>
                  <Select value={fontHeading || "__default"} onValueChange={(v) => setFontHeading(v === "__default" ? "" : v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default">System default</SelectItem>
                      <SelectItem value="Inter">Inter</SelectItem>
                      <SelectItem value="DM Sans">DM Sans</SelectItem>
                      <SelectItem value="Plus Jakarta Sans">Plus Jakarta Sans</SelectItem>
                      <SelectItem value="Outfit">Outfit</SelectItem>
                      <SelectItem value="Space Grotesk">Space Grotesk</SelectItem>
                      <SelectItem value="Manrope">Manrope</SelectItem>
                      <SelectItem value="Sora">Sora</SelectItem>
                      <SelectItem value="Poppins">Poppins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Body font</Label>
                  <Select value={fontBody || "__default"} onValueChange={(v) => setFontBody(v === "__default" ? "" : v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default">System default</SelectItem>
                      <SelectItem value="Inter">Inter</SelectItem>
                      <SelectItem value="DM Sans">DM Sans</SelectItem>
                      <SelectItem value="Plus Jakarta Sans">Plus Jakarta Sans</SelectItem>
                      <SelectItem value="Nunito Sans">Nunito Sans</SelectItem>
                      <SelectItem value="Source Sans 3">Source Sans 3</SelectItem>
                      <SelectItem value="Lato">Lato</SelectItem>
                      <SelectItem value="Open Sans">Open Sans</SelectItem>
                      <SelectItem value="IBM Plex Sans">IBM Plex Sans</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Logo + Tagline */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Logo URL</Label>
                  <div className="flex items-center gap-2">
                    {logoUrl && (
                      <img src={logoUrl} alt="" className="h-8 w-8 object-contain rounded border border-border shrink-0" />
                    )}
                    <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.svg" className="text-xs" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tagline</Label>
                  <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Your tagline or slogan" className="text-xs" />
                </div>
              </div>

              {/* Hero */}
              <div className="space-y-3 p-3 rounded-lg border border-border">
                <p className="text-xs font-medium">Hero section</p>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Title</Label>
                  <Input value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} placeholder="Welcome to Our Docs" className="text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Description</Label>
                  <Textarea value={heroDescription} onChange={(e) => setHeroDescription(e.target.value)} placeholder="Explore our documentation..." rows={2} className="text-xs" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium">Show search bar</p>
                    <p className="text-[10px] text-muted-foreground">Search bar on landing page</p>
                  </div>
                  <Switch checked={showSearchOnLanding} onCheckedChange={setShowSearchOnLanding} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium">Show featured projects</p>
                    <p className="text-[10px] text-muted-foreground">Project cards grid on landing</p>
                  </div>
                  <Switch checked={showFeaturedProjects} onCheckedChange={setShowFeaturedProjects} />
                </div>
              </div>

              {/* Analytics + Copyright */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Analytics ID</Label>
                  <Input value={analyticsPropertyId} onChange={(e) => setAnalyticsPropertyId(e.target.value)} placeholder="G-XXXXXXXXXX" className="text-xs font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Copyright</Label>
                  <Input value={copyright} onChange={(e) => setCopyright(e.target.value)} placeholder="2026 Acme Inc." className="text-xs" />
                </div>
              </div>

              {/* Custom CSS */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Custom CSS</Label>
                <p className="text-[11px] text-muted-foreground -mt-0.5">Applied globally to your published docs site.</p>
                <Textarea value={customCss} onChange={(e) => setCustomCss(e.target.value)} rows={3} placeholder=".docs-content { font-size: 15px; }" className="font-mono text-[11px]" />
              </div>
            </TabsContent>

            {/* ---- LAYOUT TAB ---- */}
            <TabsContent value="layout" className="mt-0 space-y-5">
              {/* Workspace name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Workspace name</Label>
                <Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="My Workspace" autoFocus />
              </div>

              {/* Sidebar position — visual toggle */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Sidebar position</Label>
                <p className="text-[11px] text-muted-foreground -mt-1">Where the navigation sidebar appears on your docs site.</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["left", "right"] as const).map((pos) => {
                    const active = sidebarPosition === pos;
                    return (
                      <button
                        key={pos}
                        onClick={() => setSidebarPosition(pos)}
                        className={cn(
                          "flex items-center gap-2.5 p-3 rounded-lg border-2 transition-all",
                          active ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                        )}
                      >
                        {pos === "left" ? <PanelLeft className="h-4 w-4 shrink-0" /> : <PanelRight className="h-4 w-4 shrink-0" />}
                        <div className="text-left">
                          <p className="text-xs font-medium capitalize">{pos}</p>
                          <p className="text-[10px] text-muted-foreground">{pos === "left" ? "Standard layout" : "Content-first"}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* TOC toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="text-xs font-medium">Table of contents</p>
                  <p className="text-[11px] text-muted-foreground">Show a "On this page" rail beside doc content.</p>
                </div>
                <Switch checked={showToc} onCheckedChange={setShowToc} />
              </div>

              {/* Code theme + Content width */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Code block theme</Label>
                  <Select value={codeTheme} onValueChange={setCodeTheme}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="github-dark">GitHub Dark</SelectItem>
                      <SelectItem value="github-light">GitHub Light</SelectItem>
                      <SelectItem value="one-dark-pro">One Dark Pro</SelectItem>
                      <SelectItem value="dracula">Dracula</SelectItem>
                      <SelectItem value="nord">Nord</SelectItem>
                      <SelectItem value="material-theme">Material</SelectItem>
                      <SelectItem value="min-light">Min Light</SelectItem>
                      <SelectItem value="catppuccin-mocha">Catppuccin Mocha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Content width</Label>
                  <Select value={maxContentWidth} onValueChange={(v) => setMaxContentWidth(v as any)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4xl">Standard</SelectItem>
                      <SelectItem value="5xl">Wide</SelectItem>
                      <SelectItem value="6xl">Extra wide</SelectItem>
                      <SelectItem value="full">Full width</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* ---- LANDING PAGE TAB ---- */}
            <TabsContent value="landing" className="mt-0 space-y-4">
              <div>
                <p className="text-xs font-medium">Landing page blocks</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Add and arrange content blocks shown below the hero section on your docs landing page.
                  The hero (title, search, logo) is always shown first.
                </p>
              </div>
              <LandingBlockEditor blocks={landingBlocks} onChange={setLandingBlocks} />
            </TabsContent>

            {/* ---- ADVANCED TAB ---- */}
            <TabsContent value="advanced" className="mt-0 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Custom docs domain</Label>
                <Input value={customDomain} onChange={(e) => setCustomDomain(e.target.value.toLowerCase())} placeholder="docs.example.com" />
                <p className="text-[11px] text-muted-foreground">Point your CNAME to us, then enter it here. Leave empty for default URL.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Header HTML</Label>
                <p className="text-[11px] text-muted-foreground -mt-0.5">Rendered above the page content. Useful for announcement banners.</p>
                <Textarea value={headerHtml} onChange={(e) => setHeaderHtml(e.target.value)} rows={3} placeholder='<div class="bg-blue-50 text-center py-2 text-sm">New: v2.0 is live!</div>' className="font-mono text-[11px]" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Footer HTML</Label>
                <p className="text-[11px] text-muted-foreground -mt-0.5">Rendered below the page content. Copyright, links, etc.</p>
                <Textarea value={footerHtml} onChange={(e) => setFooterHtml(e.target.value)} rows={3} placeholder='<footer class="text-center text-sm py-4">2026 Acme Inc.</footer>' className="font-mono text-[11px]" />
              </div>
            </TabsContent>

            <TabsContent value="ai" className="mt-0">
              <AISettingsPanel />
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="px-6 py-3 border-t">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={!canSave}>
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// AISettingsPanel — BYOK (Bring Your Own Key) for AI features
// ---------------------------------------------------------------------------

const AI_PROVIDERS: { value: AIProvider; label: string; hint: string; needsBaseUrl: boolean }[] = [
  { value: "gemini", label: "Google Gemini", hint: "Free tier (gemini-2.0-flash)", needsBaseUrl: false },
  { value: "anthropic", label: "Anthropic Claude", hint: "High quality (claude-sonnet)", needsBaseUrl: false },
  { value: "groq", label: "Groq", hint: "Free tier (Llama 4 Scout)", needsBaseUrl: false },
  { value: "openai_compat", label: "OpenAI-compatible", hint: "Ollama, vLLM, or any OpenAI API", needsBaseUrl: true },
];

function AISettingsPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    orgApi.getAISettings()
      .then((data) => {
        if (data.ai_provider) setProvider(data.ai_provider);
        setHasKey(data.ai_has_key);
        setModel(data.ai_model || "");
        setBaseUrl(data.ai_base_url || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!provider) return;
    setSaving(true);
    try {
      const payload: Record<string, string> = { ai_provider: provider };
      if (apiKey.trim()) payload.ai_api_key = apiKey.trim();
      if (model.trim()) payload.ai_model = model.trim();
      if (baseUrl.trim()) payload.ai_base_url = baseUrl.trim();
      const data = await orgApi.updateAISettings(payload);
      setHasKey(data.ai_has_key);
      setApiKey("");
      toast({ title: "AI settings saved" });
    } catch (err: any) {
      toast({ title: "Failed to save", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Remove AI configuration? AI features will be disabled.")) return;
    setSaving(true);
    try {
      await orgApi.deleteAISettings();
      setProvider("gemini");
      setApiKey("");
      setModel("");
      setBaseUrl("");
      setHasKey(false);
      toast({ title: "AI settings removed" });
    } catch (err: any) {
      toast({ title: "Failed", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground py-6"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...</div>;
  }

  const selected = AI_PROVIDERS.find((p) => p.value === provider);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bot className="w-4 h-4 text-muted-foreground" />
        <div>
          <p className="text-xs font-medium">AI Agent Configuration</p>
          <p className="text-[11px] text-muted-foreground">Add your LLM API key to enable AI chat, inline assistant, and template generation.</p>
        </div>
      </div>

      {hasKey && (
        <div className="flex items-center gap-1 text-[11px] text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 w-fit">
          <CheckCircle className="w-3 h-3" /> API key configured
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Provider</Label>
          <Select value={provider} onValueChange={(v) => setProvider(v as AIProvider)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_PROVIDERS.map((p) => (
                <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected && <p className="text-[11px] text-muted-foreground">{selected.hint}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">API Key</Label>
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              placeholder={hasKey ? "Key saved (enter new to replace)" : "Enter your API key"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="h-8 text-xs font-mono pr-8"
              autoComplete="off"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowKey((v) => !v)}
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">Encrypted at rest. Never exposed via the API.</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Model (optional)</Label>
          <Input
            placeholder={
              provider === "gemini" ? "gemini-2.0-flash" :
              provider === "anthropic" ? "claude-sonnet-4-5-20250514" :
              provider === "groq" ? "llama-4-scout-17b-16e-instruct" : "model name"
            }
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="h-8 text-xs"
          />
          <p className="text-[11px] text-muted-foreground">Leave blank for the default model.</p>
        </div>

        {selected?.needsBaseUrl && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Base URL</Label>
            <Input
              placeholder="http://localhost:11434/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="h-8 text-xs font-mono"
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-1">
        {hasKey ? (
          <button type="button" className="text-[11px] text-destructive hover:underline" onClick={handleDelete} disabled={saving}>
            Remove AI config
          </button>
        ) : <span />}
        <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving || !provider}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          {saving ? "Saving..." : "Save AI Settings"}
        </Button>
      </div>
    </div>
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
  titleOverride,
  hideTypePicker,
  allowDestinationPicker,
  onCreated,
  onClose,
}: {
  parentId?: number | null;
  allSections: Section[];
  hierarchyMode: "product" | "flat";
  preferredType?: "section" | "tab" | "version";
  cloneFromSectionId?: number | null;
  titleOverride?: string;
  hideTypePicker?: boolean;
  allowDestinationPicker?: boolean;
  onCreated?: (section: Section) => void;
  onClose: () => void;
}) {
  const ROOT_DESTINATION_VALUE = "__create_root__";
  const [name, setName] = useState("");
  const [sectionType, setSectionType] = useState<"section" | "tab" | "version">(preferredType ?? "section");
  const [destinationValue, setDestinationValue] = useState<string>(
    parentId == null ? ROOT_DESTINATION_VALUE : String(parentId),
  );
  const [visibility, setVisibility] = useState<VisibilityLevel>("public");
  const { toast } = useToast();
  const qc = useQueryClient();
  const parentMap = useMemo(() => new Map(allSections.map((s) => [s.id, s.parent_id])), [allSections]);
  const sectionsById = useMemo(() => new Map(allSections.map((section) => [section.id, section])), [allSections]);

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

  const destinationParentId = useMemo(() => {
    if (!allowDestinationPicker) return parentId ?? null;
    if (destinationValue === ROOT_DESTINATION_VALUE) return null;
    const parsed = Number(destinationValue);
    return Number.isFinite(parsed) ? parsed : null;
  }, [allowDestinationPicker, destinationValue, parentId]);
  const buildPath = useCallback((section: Section): string => {
    const names: string[] = [section.name];
    let cursor = section.parent_id;
    while (cursor != null) {
      const parent = sectionsById.get(cursor);
      if (!parent) break;
      names.unshift(parent.name);
      cursor = parent.parent_id;
    }
    return names.join(" / ");
  }, [sectionsById]);
  const destinationOptions = useMemo(
    () =>
      allSections
        .map((section) => ({
          id: section.id,
          type: inferImportTargetType(section),
          path: buildPath(section),
        }))
        .sort((a, b) => a.path.localeCompare(b.path)),
    [allSections, buildPath],
  );

  const isRootCreate = destinationParentId == null;
  const parentDepth = getDepth(destinationParentId);
  const isProductMode = hierarchyMode === "product";
  const parentSection = destinationParentId != null ? allSections.find((section) => section.id === destinationParentId) ?? null : null;
  const parentType = parentSection?.section_type ?? "section";
  const canCreateTab = isProductMode
    ? (!isRootCreate && (parentDepth === 0 || parentType === "version"))
    : isRootCreate;
  const canCreateVersion = isProductMode && !isRootCreate && parentDepth === 0;

  useEffect(() => {
    setSectionType(preferredType ?? "section");
  }, [preferredType, parentId]);

  useEffect(() => {
    setDestinationValue(parentId == null ? ROOT_DESTINATION_VALUE : String(parentId));
  }, [parentId]);

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
        parent_id: destinationParentId,
        section_type: isRootCreate ? (isProductMode ? "section" : sectionType) : sectionType,
        visibility,
        clone_from_section_id: !isRootCreate && sectionType === "version" ? (cloneFromSectionId ?? destinationParentId ?? null) : undefined,
      }),
    onSuccess: (createdSection) => {
      qc.invalidateQueries({ queryKey: ["sections"] });
      const createdLabel = isRootCreate
        ? (isProductMode ? "Product" : sectionType === "tab" ? "Tab" : sectionType === "version" ? "Version" : "Section")
        : sectionType === "tab"
          ? "Tab"
          : sectionType === "version"
            ? "Version"
          : "Section";
      onCreated?.(createdSection);
      toast({ title: `${createdLabel} created` });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const sectionOptionLabel = isRootCreate && isProductMode
    ? "Product"
    : parentType === "section"
      ? "Sub-section"
      : "Section";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">
            {titleOverride ?? (isRootCreate
              ? (isProductMode ? "New product" : "New section")
              : canCreateTab
                ? "New item"
                : "New section")}
          </DialogTitle>
        </DialogHeader>
        <div className="py-1">
          <div className="space-y-3">
            {allowDestinationPicker && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Create in</Label>
                <Select value={destinationValue} onValueChange={setDestinationValue}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Choose destination" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ROOT_DESTINATION_VALUE}>
                      {isProductMode ? "Workspace root (new product)" : "Workspace root"}
                    </SelectItem>
                    {destinationOptions.map((option) => (
                      <SelectItem key={option.id} value={String(option.id)}>
                        {option.path} ({importTargetTypeLabel(option.type)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Choose destination first, then pick type (tab/section/sub-section/version).
                </p>
              </div>
            )}
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
            {isRootCreate && !allowDestinationPicker ? (
              <p className="text-xs text-muted-foreground">
                {isProductMode
                  ? "Products render as top-level entries and can contain optional tabs and sections."
                  : "Top-level sections render directly in docs. You can convert a section to Tab from its action menu if needed."}
              </p>
            ) : !hideTypePicker ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select value={sectionType} onValueChange={(v) => setSectionType(v as "section" | "tab" | "version")}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="section">{sectionOptionLabel}</SelectItem>
                    {canCreateTab && <SelectItem value="tab">Tab</SelectItem>}
                    {canCreateVersion && <SelectItem value="version">Version</SelectItem>}
                  </SelectContent>
                </Select>
                {(!canCreateTab || !canCreateVersion) && (
                  <p className="text-[11px] text-muted-foreground">
                    {isProductMode
                      ? "Tabs are allowed under product/version. Versions are allowed only directly under a product."
                      : "Tabs are allowed only at the top level in flat mode."}
                  </p>
                )}
              </div>
            ) : null}
            {!isRootCreate && hideTypePicker && (
              <p className="text-xs text-muted-foreground">
                Creating a {sectionType === "version" ? "version" : sectionType} in the selected destination.
              </p>
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
  canManage,
  canMove,
  canManageVisibility,
  canPublish,
  canDelete,
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
  canManage: boolean;
  canMove: boolean;
  canManageVisibility: boolean;
  canPublish: boolean;
  canDelete: boolean;
  onEditTitle: (page: Page) => void;
  onEditSlug: (page: Page) => void;
  onMove: (page: Page, direction: "up" | "down") => void;
  onRearrange: (page: Page) => void;
  onSetVisibilityOverride: (page: Page, visibility: VisibilityLevel | null) => void;
  onDuplicate: (page: Page) => void;
  onUnpublish: (page: Page) => void;
  onDelete: (page: Page) => void;
}) {
  const currentOverride = page.visibility_override ?? null;
  return (
    <DropdownMenuContent align="end" className="w-44">
      {canManage && (
        <>
          <DropdownMenuItem onClick={() => onEditTitle(page)}>
            <Pencil className="h-3 w-3 mr-2" /> Edit Title
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEditSlug(page)}>
            <Pencil className="h-3 w-3 mr-2" /> Edit URL slug
          </DropdownMenuItem>
        </>
      )}
      {canMove && (
        <>
          <DropdownMenuItem onClick={() => onMove(page)}>
            <ArrowRightLeft className="h-3 w-3 mr-2" /> Move
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRearrange(page)}>
            <ListOrdered className="h-3 w-3 mr-2" /> Re-arrange
          </DropdownMenuItem>
        </>
      )}
      {canManageVisibility && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onSetVisibilityOverride(page, null)}>
            {currentOverride === null ? "✓ " : ""}Use section visibility
          </DropdownMenuItem>
          {visibilityOptions.map((opt) => (
            <DropdownMenuItem key={opt.value} onClick={() => onSetVisibilityOverride(page, opt.value)}>
              {currentOverride === opt.value ? "✓ " : ""}{opt.label}
            </DropdownMenuItem>
          ))}
        </>
      )}
      {canManage && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onDuplicate(page)}>
            <Copy className="h-3 w-3 mr-2" /> Duplicate
          </DropdownMenuItem>
        </>
      )}
      {canPublish && (
        <DropdownMenuItem
          disabled={!page.is_published}
          className={cn(!page.is_published && "opacity-50")}
          onClick={() => onUnpublish(page)}
        >
          <Circle className="h-2.5 w-2.5 mr-2 fill-red-500 text-red-500" /> Unpublish
        </DropdownMenuItem>
      )}
      {canDelete && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={() => onDelete(page)}>
            <Trash2 className="h-3 w-3 mr-2" /> Delete
          </DropdownMenuItem>
        </>
      )}
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
  canManageActions,
  canMove,
  canManageVisibility,
  canPublish,
  canDelete,
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
  canManageActions: boolean;
  canMove: boolean;
  canManageVisibility: boolean;
  canPublish: boolean;
  canDelete: boolean;
  onSelect: (id: number) => void;
  onEditTitle: (page: Page) => void;
  onEditSlug: (page: Page) => void;
  onMove: (page: Page, direction: "up" | "down") => void;
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
  const dragListeners = canMove ? listeners : undefined;
  const dragAttributes = canMove ? attributes : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="group relative flex items-center"
    >
      <button
        {...dragListeners} {...dragAttributes}
        className={cn(
          "shrink-0 p-0.5 ml-1 hover:!opacity-100 touch-none rounded hover:bg-accent",
          canMove
            ? "opacity-40 group-hover:opacity-70 cursor-grab active:cursor-grabbing"
            : "opacity-0 pointer-events-none",
        )}
        tabIndex={-1}
        title="Drag to reorder"
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
      {(canManageActions || canMove || canManageVisibility || canDelete || canPublish) && (
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
            canManage={canManageActions}
            canMove={canMove}
            canManageVisibility={canManageVisibility}
            canPublish={canPublish}
            canDelete={canDelete}
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
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionNode — sortable + nest-droppable header
// ---------------------------------------------------------------------------

function SectionNode({
  section, pages, selectedPageId, onSelectPage, depth,
  onAddPage, onAddSubSection, onImportHere, onRenameSection, onMoveSection, onDeleteSection, onChangeSectionType, onSetSectionVisibility, onRenamePage, onEditPageSlug, onMovePage, onSetPageVisibilityOverride, onDuplicatePage, onUnpublishPage, onRearrangePage, onDeletePage,
  canEditContent,
  canMoveContent,
  canEditVisibilitySettings,
  canPublishContent,
  canDeleteContent,
  canDeleteSection,
  canOpenImportDialog,
  activeDragType,
  hierarchyMode,
  hideVersionSections,
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
  canEditContent: boolean;
  canMoveContent: boolean;
  canEditVisibilitySettings: boolean;
  canPublishContent: boolean;
  canDeleteContent: boolean;
  canDeleteSection: boolean;
  canOpenImportDialog: boolean;
  activeDragType: "page" | "section" | null;
  hierarchyMode: "product" | "flat";
  hideVersionSections?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const sectionPages = useMemo(
    () => sortPagesByDisplayOrder(pages.filter((p) => p.section_id === section.id)),
    [pages, section.id],
  );
  const pageIds = useMemo(
    () => sectionPages.map((p) => `page-${p.id}`),
    [sectionPages],
  );

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
  const sectionDragListeners = canMoveContent ? sortListeners : undefined;
  const sectionDragAttributes = canMoveContent ? sortAttrs : undefined;

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
  const childSections = useMemo(() => {
    const filtered =
      hideVersionSections
        ? (section.children ?? []).filter((child) => (child.section_type ?? "section") !== "version")
        : (section.children ?? []);
    return sortSectionsByDisplayOrder(filtered);
  }, [hideVersionSections, section.children]);

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
          {...sectionDragListeners} {...sectionDragAttributes}
          className={cn(
            "shrink-0 p-0.5 hover:!opacity-100 touch-none rounded hover:bg-accent",
            canMoveContent
              ? "opacity-40 group-hover:opacity-70 cursor-grab active:cursor-grabbing"
              : "opacity-0 pointer-events-none",
          )}
          tabIndex={-1}
          title="Drag to reorder"
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

        {canEditContent && (
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
              {canOpenImportDialog && (
                <DropdownMenuItem onClick={() => onImportHere(section)}>
                  <ArrowUpFromLine className="h-3 w-3 mr-2" />
                  Import here
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {canEditContent && (
                <>
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
                </>
              )}
              <DropdownMenuItem onClick={() => onRenameSection(section)}>
                <Pencil className="h-3 w-3 mr-2" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMoveSection(section)}>
                <ChevronsUpDown className="h-3 w-3 mr-2" /> Move to...
              </DropdownMenuItem>
              {canEditVisibilitySettings && (
                <>
                  <DropdownMenuSeparator />
                  {visibilityOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => onSetSectionVisibility(section, opt.value)}
                    >
                      {currentSectionVisibility === opt.value ? "✓ " : ""}{opt.label}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              {canDeleteSection && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => onDeleteSection(section)}>
                    <Trash2 className="h-3 w-3 mr-2" /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        )}
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
                canManageActions={canEditContent}
                canMove={canMoveContent}
                canManageVisibility={canEditVisibilitySettings}
                canPublish={canPublishContent}
                canDelete={canDeleteContent}
                onSelect={onSelectPage}
                onEditTitle={onRenamePage}
                onEditSlug={onEditPageSlug}
                onMove={() => {}}
                onRearrange={onRearrangePage}
                onSetVisibilityOverride={onSetPageVisibilityOverride}
                onDuplicate={onDuplicatePage}
                onUnpublish={onUnpublishPage}
                onDelete={onDeletePage}
              />
            ))}
          </SortableContext>
          <SortableContext
            items={childSections.map((child) => `sect-${child.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {childSections.map((child) => (
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
                canEditContent={canEditContent}
                canMoveContent={canMoveContent}
                canEditVisibilitySettings={canEditVisibilitySettings}
                canPublishContent={canPublishContent}
                canDeleteContent={canDeleteContent}
                canDeleteSection={canDeleteSection}
                canOpenImportDialog={canOpenImportDialog}
                hideVersionSections={hideVersionSections}
              />
            ))}
          </SortableContext>
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
  visibilityFilter,
  onVisibilityFilterChange,
  pageSearchQuery,
  onPageSearchChange,
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
  canEditContent,
  canMoveContent,
  canEditVisibilitySettings,
  canPublishContent,
  canDeleteContent,
  canDeleteSection,
  canOpenImportDialog,
  hideVersionSections,
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
  hideVersionSections: boolean;
  visibilityFilter: VisibilityFilter;
  onVisibilityFilterChange: (value: VisibilityFilter) => void;
  pageSearchQuery: string;
  onPageSearchChange: (value: string) => void;
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
  canEditContent: boolean;
  canMoveContent: boolean;
  canEditVisibilitySettings: boolean;
  canPublishContent: boolean;
  canDeleteContent: boolean;
  canDeleteSection: boolean;
  canOpenImportDialog: boolean;
}) {
  const filterVisibleSections = useCallback(
    (sections: Section[]) =>
      sections.filter((section) => (section.section_type ?? "section") !== "version"),
    [],
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
    <aside className="w-[240px] shrink-0 border-r bg-background/60 flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b bg-background/80 shrink-0">
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
        <div className="relative mt-2">
          <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
          <Input
            value={pageSearchQuery}
            onChange={(event) => onPageSearchChange(event.target.value)}
            placeholder="Search pages"
            className="h-8 text-xs pl-7 pr-10"
          />
          {pageSearchQuery && (
            <button
              type="button"
              onClick={() => onPageSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-0.5">
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
                canManageActions={canEditContent}
                canMove={canMoveContent}
                canManageVisibility={canEditVisibilitySettings}
                canPublish={canPublishContent}
                canDelete={canDeleteContent}
                onSelect={onSelectPage}
                onEditTitle={onRenamePage}
                onEditSlug={onEditPageSlug}
                onMove={() => {}}
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
                canEditContent={canEditContent}
                canMoveContent={canMoveContent}
                canEditVisibilitySettings={canEditVisibilitySettings}
                canPublishContent={canPublishContent}
              canDeleteContent={canDeleteContent}
              canDeleteSection={canDeleteSection}
              canOpenImportDialog={canOpenImportDialog}
              hideVersionSections={hideVersionSections}
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

type AnalyticsSnapshot = {
  totalPages: number;
  publishedCount: number;
  draftCount: number;
  coveragePct: number;
  publicPublishedCount: number;
  externalPublishedCount: number;
  internalPublishedCount: number;
  outwardReachCount: number;
  outwardReachPct: number;
  updatedLast7Days: number;
  updatedLast30Days: number;
  freshnessPct: number;
  stalePublishedCount: number;
  staleDraftCount: number;
  syncLagCount: number;
  syncedLast7Days: number;
  recentPages: Page[];
};

function DocumentationImpactPanel({
  snapshot,
  onOpenPage,
}: {
  snapshot: AnalyticsSnapshot;
  onOpenPage: (pageId: number) => void;
}) {
  return (
    <section className="rounded-xl border bg-background/85 shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Documentation impact</h3>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="rounded-lg border bg-background/70 p-3">
            <p className="text-[11px] text-muted-foreground">Reader coverage</p>
            <p className="text-lg font-semibold">
              {snapshot.publishedCount}/{snapshot.totalPages}
            </p>
            <p className="text-[11px] text-muted-foreground">{snapshot.coveragePct}% live</p>
          </div>
          <div className="rounded-lg border bg-background/70 p-3">
            <p className="text-[11px] text-muted-foreground">Audience reach</p>
            <p className="text-lg font-semibold">{snapshot.outwardReachCount}</p>
            <p className="text-[11px] text-muted-foreground">
              {snapshot.publicPublishedCount} public · {snapshot.externalPublishedCount} external
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-3">
            <p className="text-[11px] text-muted-foreground">Freshness (30d)</p>
            <p className="text-lg font-semibold">
              {snapshot.updatedLast30Days}/{snapshot.totalPages}
            </p>
            <p className="text-[11px] text-muted-foreground">{snapshot.freshnessPct}% updated recently</p>
          </div>
          <div className="rounded-lg border bg-background/70 p-3">
            <p className="text-[11px] text-muted-foreground">Publish backlog</p>
            <p className="text-lg font-semibold">{snapshot.draftCount}</p>
            <p className="text-[11px] text-muted-foreground">
              {snapshot.staleDraftCount} older than 14 days
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-3">
            <p className="text-[11px] text-muted-foreground">Internal live docs</p>
            <p className="text-lg font-semibold">{snapshot.internalPublishedCount}</p>
            <p className="text-[11px] text-muted-foreground">
              {snapshot.outwardReachPct}% of live docs are outward-facing
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-3">
            <p className="text-[11px] text-muted-foreground">Stale live docs</p>
            <p className="text-lg font-semibold">{snapshot.stalePublishedCount}</p>
            <p className="text-[11px] text-muted-foreground">Not updated in 30 days</p>
          </div>
          <div className="rounded-lg border bg-background/70 p-3">
            <p className="text-[11px] text-muted-foreground">Sync lag</p>
            <p className="text-lg font-semibold">{snapshot.syncLagCount}</p>
            <p className="text-[11px] text-muted-foreground">Live docs changed after last sync</p>
          </div>
          <div className="rounded-lg border bg-background/70 p-3">
            <p className="text-[11px] text-muted-foreground">Activity (7 days)</p>
            <p className="text-lg font-semibold">{snapshot.updatedLast7Days}</p>
            <p className="text-[11px] text-muted-foreground">Synced: {snapshot.syncedLast7Days}</p>
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recently updated</p>
            <p className="text-[11px] text-muted-foreground">Synced (7d): {snapshot.syncedLast7Days}</p>
          </div>
          {snapshot.recentPages.length === 0 ? (
            <p className="text-xs text-muted-foreground">No pages yet.</p>
          ) : (
            <div className="space-y-1.5">
              {snapshot.recentPages.map((page) => (
                <button
                  key={`analytics-recent-${page.id}`}
                  type="button"
                  onClick={() => onOpenPage(page.id)}
                  className="w-full flex items-center justify-between rounded-md border px-2.5 py-2 text-left hover:bg-accent/50 transition-colors"
                >
                  <span className="text-sm truncate pr-2">{page.title}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {new Date(page.updated_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FeedbackInsightsPanel({
  data,
  loading,
  onOpenPage,
}: {
  data: EngagementOverview | undefined;
  loading: boolean;
  onOpenPage: (pageId: number) => void;
}) {
  const summary = data?.summary;
  const helpfulRate =
    summary && summary.total_feedback > 0
      ? Math.round((summary.helpful / summary.total_feedback) * 100)
      : 0;
  const activeDiscussions =
    (data?.pages ?? []).filter((item) => item.total_comments > 0).length;

  return (
    <section className="rounded-xl border bg-background/85 shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Feedback & comments</h3>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="rounded-lg border bg-background/70 p-3">
            <p className="text-[11px] text-muted-foreground">Feedback votes</p>
            <p className="text-lg font-semibold">{summary?.total_feedback ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">{helpfulRate}% helpful</p>
          </div>
          <div className="rounded-lg border bg-background/70 p-3">
            <p className="text-[11px] text-muted-foreground">Comments</p>
            <p className="text-lg font-semibold">{summary?.total_comments ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">{activeDiscussions} active page threads</p>
          </div>
          <div className="rounded-lg border bg-background/70 p-3">
            <p className="text-[11px] text-muted-foreground">Pages with feedback</p>
            <p className="text-lg font-semibold">{summary?.pages_with_feedback ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">Pages discussed: {summary?.commented_pages ?? 0}</p>
          </div>
          <div className="rounded-lg border bg-background/70 p-3">
            <p className="text-[11px] text-muted-foreground">Helpful vs not helpful</p>
            <p className="text-lg font-semibold">
              {summary?.helpful ?? 0} / {summary?.not_helpful ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground">Signal from readers</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-lg border bg-background/70">
            <div className="border-b px-3 py-2.5 flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Top discussed pages</p>
              <ThumbsUp className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="p-2 space-y-1.5 max-h-64 overflow-auto">
              {loading ? (
                <p className="text-xs text-muted-foreground px-2 py-3">Loading feedback…</p>
              ) : (data?.pages ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-3">No feedback or comments yet.</p>
              ) : (
                (data?.pages ?? []).map((item) => (
                  <button
                    key={`feedback-page-${item.page_id}`}
                    type="button"
                    onClick={() => onOpenPage(item.page_id)}
                    className="w-full rounded-md border px-2.5 py-2 text-left hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{item.page_title}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{formatRelativeTimestamp(item.last_activity_at)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{item.total_comments} comments</span>
                      <span>{item.total_feedback} votes</span>
                      <span>{item.helpful_ratio ?? 0}% helpful</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-background/70">
            <div className="border-b px-3 py-2.5 flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent comments</p>
              <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="p-2 space-y-1.5 max-h-64 overflow-auto">
              {loading ? (
                <p className="text-xs text-muted-foreground px-2 py-3">Loading comments…</p>
              ) : (data?.recent_comments ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-3">No recent comments.</p>
              ) : (
                (data?.recent_comments ?? []).map((item) => (
                  <button
                    key={`feedback-comment-${item.id}`}
                    type="button"
                    onClick={() => onOpenPage(item.page_id)}
                    className="w-full rounded-md border px-2.5 py-2 text-left hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{item.page_title || "Untitled page"}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{formatRelativeTimestamp(item.created_at)}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground truncate">{item.display_name}</p>
                    <p className="mt-1 text-xs text-foreground/90 line-clamp-2">{item.body}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const routeState = useMemo(
    () => parseDashboardLocation(location.pathname, location.search),
    [location.pathname, location.search],
  );

  const [selectedPageId, setSelectedPageId] = useState<number | null>(routeState.pageId);
  const [showAddPage, setShowAddPage] = useState(false);
  const [addPageSectionId, setAddPageSectionId] = useState<number | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [addSectionParentId, setAddSectionParentId] = useState<number | null>(null);
  const [addSectionPreferredType, setAddSectionPreferredType] = useState<"section" | "tab" | "version" | undefined>(undefined);
  const [addSectionCloneFromId, setAddSectionCloneFromId] = useState<number | null>(null);
  const [addSectionDialogTitle, setAddSectionDialogTitle] = useState<string | undefined>(undefined);
  const [addSectionHideTypePicker, setAddSectionHideTypePicker] = useState(false);
  const [addSectionAllowDestinationPicker, setAddSectionAllowDestinationPicker] = useState(false);
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
  const [pageSettingsPage, setPageSettingsPage] = useState<Page | null>(null);
  const [inlineAssistOpen, setInlineAssistOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileHierarchyOpen, setMobileHierarchyOpen] = useState(false);
  const [selectedSidebarProductId, setSelectedSidebarProductId] = useState<number | null>(null);
  const [selectedSidebarVersionId, setSelectedSidebarVersionId] = useState<number | null>(null);
  const [selectedSidebarTabId, setSelectedSidebarTabId] = useState<number | null>(null);
  const [drivePanelOpen, setDrivePanelOpen] = useState(true);
  const [accountPanelOpen, setAccountPanelOpen] = useState(false);
  const [showExternalAccessPanel, setShowExternalAccessPanel] = useState(false);
  const [showInviteMember, setShowInviteMember] = useState(false);
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false);
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [pageSearchQuery, setPageSearchQuery] = useState("");
  const [dashboardPaneMode, setDashboardPaneMode] = useState<DashboardPaneMode>(routeState.mode);
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(routeState.approvalId);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const routeModeRef = useRef<DashboardPaneMode>(routeState.mode);
  const routePageIdRef = useRef<number | null>(routeState.pageId);
  const routeApprovalIdRef = useRef<string | null>(routeState.approvalId);

  const [currentOrgId, setCurrentOrgId] = useState<number | undefined>(
    routeState.workspaceId ?? getStoredOrgId() ?? undefined,
  );
  const routeWorkspaceIdRef = useRef<number | null>(routeState.workspaceId);

  // Only react when the URL workspace id actually changes (e.g. browser back/forward or deep-link),
  // so a local workspace switch isn't immediately overwritten by stale query params.
  useEffect(() => {
    if (routeState.workspaceId === routeWorkspaceIdRef.current) return;
    routeWorkspaceIdRef.current = routeState.workspaceId;
    if (routeState.workspaceId !== null) {
      setStoredOrgId(routeState.workspaceId);
      setCurrentOrgId(routeState.workspaceId);
      setSelectedPageId(null);
      setSelectedApprovalId(null);
    }
  }, [routeState.workspaceId]);

  useEffect(() => {
    if (routeState.mode !== routeModeRef.current) {
      routeModeRef.current = routeState.mode;
      setDashboardPaneMode(routeState.mode);
    }

    if (routeState.pageId !== routePageIdRef.current) {
      routePageIdRef.current = routeState.pageId;
      if (routeState.mode === "content" && routeState.pageId !== null) {
        setSelectedPageId(routeState.pageId);
      }
    }

    if (routeState.approvalId !== routeApprovalIdRef.current) {
      routeApprovalIdRef.current = routeState.approvalId;
      setSelectedApprovalId(routeState.approvalId);
    }
  }, [routeState.approvalId, routeState.mode, routeState.pageId]);

  const { data: org, isLoading: orgLoading } = useQuery({ queryKey: ["org", currentOrgId], queryFn: () => orgApi.get(currentOrgId) });

  // If we loaded an org but currentOrgId wasn't set (first login / missing localStorage),
  // backfill it so X-Org-Id header is sent on all subsequent API calls.
  useEffect(() => {
    if (org?.id && currentOrgId === undefined) {
      setStoredOrgId(org.id);
      setCurrentOrgId(org.id);
    }
  }, [org?.id, currentOrgId]);

  const { data: sectionsData } = useQuery({ queryKey: ["sections", currentOrgId], queryFn: sectionsApi.list, enabled: !!org && currentOrgId !== undefined, staleTime: 5_000 });
  const { data: pagesData } = useQuery({ queryKey: ["pages", currentOrgId], queryFn: () => pagesApi.list(), enabled: !!org && currentOrgId !== undefined });
  const { data: driveStatus } = useQuery({ queryKey: ["drive-status", currentOrgId], queryFn: driveApi.status, enabled: !!org && currentOrgId !== undefined });
  const { data: approvalsCountData } = useQuery({
    queryKey: ["approvals-count", currentOrgId],
    enabled: !!org,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await invokeFunction<{ ok?: boolean; count?: number }>("approvals-count", { body: {} });
      if (error || !data?.ok) return 0;
      return typeof data.count === "number" ? data.count : 0;
    },
  });
  const { data: selectedPageFull } = useQuery({
    queryKey: ["page", selectedPageId],
    queryFn: () => pagesApi.get(selectedPageId!),
    enabled: selectedPageId !== null,
  });
  const { data: engagementOverview, isLoading: engagementOverviewLoading } = useQuery({
    queryKey: ["pages-engagement-overview", currentOrgId],
    queryFn: () => pagesApi.engagementOverview(12),
    enabled: !!org && currentOrgId !== undefined && dashboardPaneMode === "analytics",
    staleTime: 30_000,
  });

  const handleWorkspaceChange = useCallback((orgId: number) => {
    setStoredOrgId(orgId);
    setCurrentOrgId(orgId);
    // Reset selection state
    setSelectedProduct(null);
    setSelectedPageId(null);
    setSelectedApprovalId(null);
    setDashboardPaneMode("content");
  }, []);

  const sections = sectionsData?.sections ?? [];
  const pages = pagesData?.pages ?? [];
  useEffect(() => {
    if (typeof approvalsCountData === "number") {
      setPendingReviewCount(approvalsCountData);
    }
  }, [approvalsCountData]);
  const selectedPage = selectedPageFull ?? (pages.find((p) => p.id === selectedPageId) ?? null);
  const selectedPageReviewSubmitterId =
    selectedPageFull?.review_submitted_by_id ?? selectedPage?.review_submitted_by_id ?? null;
  const isSelectedPageOwnSubmission =
    selectedPage?.status === "review" &&
    typeof selectedPageReviewSubmitterId === "number" &&
    user?.id === selectedPageReviewSubmitterId;

  useEffect(() => {
    const desiredUrl = buildDashboardUrl({
      mode: dashboardPaneMode,
      pageId: selectedPageId,
      pageSlug: selectedPage?.slug,
      approvalId: selectedApprovalId,
      workspaceId: currentOrgId,
    });
    const currentUrl = `${location.pathname}${location.search}`;
    if (currentUrl !== desiredUrl) {
      const sameSemanticRoute =
        routeState.mode === dashboardPaneMode &&
        routeState.pageId === selectedPageId &&
        routeState.approvalId === selectedApprovalId &&
        routeState.workspaceId === (typeof currentOrgId === "number" ? currentOrgId : null);
      navigate(desiredUrl, { replace: sameSemanticRoute });
    }
  }, [
    currentOrgId,
    dashboardPaneMode,
    location.pathname,
    location.search,
    navigate,
    routeState.approvalId,
    routeState.mode,
    routeState.pageId,
    routeState.workspaceId,
    selectedApprovalId,
    selectedPage?.slug,
    selectedPageId,
  ]);

  const hasWorkspaceContent = sections.length > 0 || pages.length > 0;
  const currentUserRole = org?.user_role ?? "viewer";
  const canEditContent = currentUserRole === "owner" || currentUserRole === "admin" || currentUserRole === "editor";
  const canCreateContent = canEditContent;
  const canDeleteContent = canEditContent;
  const canDeleteSection = canEditContent;
  const canMoveContent = canEditContent;
  const canPublishContent = canEditContent;
  const canReviewContent = currentUserRole === "owner" || currentUserRole === "admin" || currentUserRole === "reviewer";
  const canSyncContent = canEditContent;
  const canEditVisibilitySettings = canEditContent;
  const canManageStructure = canEditContent;
  const canManageDrive = currentUserRole === "owner" || currentUserRole === "admin";
  const canManageWorkspace = canManageDrive;
  const canInviteMembers = canManageDrive;
  const canManageExternalAccess = canManageDrive;
  const canConfigureHierarchy = canManageWorkspace;
  const canOpenImportDialog = canEditContent;
  const driveConnected = !!driveStatus?.connected;

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
  const normalizedPageSearch = useMemo(
    () => pageSearchQuery.trim().toLowerCase(),
    [pageSearchQuery],
  );
  const pageSearchIndex = useMemo(() => {
    const index = new Map<number, string>();
    for (const page of visiblePages) {
      const parts: string[] = [page.title, page.slug];
      let cursorSectionId = page.section_id;
      while (cursorSectionId !== null) {
        const section = sectionsById.get(cursorSectionId);
        if (!section) break;
        parts.push(section.name, section.slug);
        cursorSectionId = section.parent_id;
      }
      index.set(page.id, parts.join(" ").toLowerCase());
    }
    return index;
  }, [sectionsById, visiblePages]);
  const treeVisiblePages = useMemo(() => {
    if (!normalizedPageSearch) return visiblePages;
    return visiblePages.filter((page) => (pageSearchIndex.get(page.id) ?? "").includes(normalizedPageSearch));
  }, [normalizedPageSearch, pageSearchIndex, visiblePages]);
  const allSectionTree = useMemo(() => buildSectionTree(sections), [sections]);
  const sectionTree = useMemo(() => {
    const sectionIdsWithVisiblePages = new Set(
      treeVisiblePages.filter((p) => p.section_id !== null).map((p) => p.section_id as number),
    );
    const filterNode = (node: Section): Section | null => {
      const filteredChildren =
        (node.children ?? [])
          .map((child) => filterNode(child))
          .filter((child): child is Section => child !== null);
      const nodeVisibility = (node.visibility ?? "public") as VisibilityLevel;
      const matchesVisibility =
        visibilityFilter === "all" ||
        nodeVisibility === visibilityFilter ||
        sectionIdsWithVisiblePages.has(node.id) ||
        filteredChildren.length > 0;
      const sectionSearchText = `${node.name} ${node.slug}`.toLowerCase();
      const matchesSearch =
        !normalizedPageSearch ||
        sectionSearchText.includes(normalizedPageSearch) ||
        sectionIdsWithVisiblePages.has(node.id) ||
        filteredChildren.length > 0;
      if (!matchesVisibility || !matchesSearch) return null;
      return { ...node, children: filteredChildren };
    };
    return allSectionTree
      .map((node) => filterNode(node))
      .filter((node): node is Section => node !== null);
  }, [allSectionTree, normalizedPageSearch, treeVisiblePages, visibilityFilter]);
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
  const importQuickTargets = useMemo(() => {
    const targets: Array<{ contextLabel: string; target: DriveImportTarget }> = [];
    const seen = new Set<number>();

    const pushTarget = (section: Section | null | undefined, contextLabel: string) => {
      if (!section || seen.has(section.id)) return;
      seen.add(section.id);
      targets.push({
        contextLabel,
        target: toDriveImportTarget(section),
      });
    };

    if (selectedImportTargetSection && inferImportTargetType(selectedImportTargetSection) === "section") {
      pushTarget(selectedImportTargetSection, "current section");
    }
    pushTarget(selectedTab, "current tab");
    pushTarget(selectedVersion, "current version");
    pushTarget(selectedProduct, "current product");

    return targets;
  }, [selectedImportTargetSection, selectedProduct, selectedTab, selectedVersion]);

  const productTabs = useMemo(() => {
    if (!selectedProduct) return [] as Section[];
    return sections
      .filter(
        (s) =>
          s.parent_id === selectedProduct.id &&
          (s.section_type ?? "section") === "tab",
      )
      .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
  }, [sections, selectedProduct]);
  const versionTabs = useMemo(() => {
    if (!selectedVersion) return [] as Section[];
    return sections
      .filter(
        (s) =>
          s.parent_id === selectedVersion.id &&
          (s.section_type ?? "section") === "tab",
      )
      .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
  }, [sections, selectedVersion]);
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
    for (const page of treeVisiblePages) {
      if (page.section_id === null) continue;
      const list = map.get(page.section_id) ?? [];
      list.push(page);
      map.set(page.section_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.display_order - b.display_order || a.title.localeCompare(b.title));
    }
    return map;
  }, [treeVisiblePages]);
  const activeHierarchyRoot = selectedVersion ?? selectedProduct ?? selectedTab;
  const readerHierarchyTopPages = useMemo(() => {
    if (!activeHierarchyRoot) return [] as Page[];
    return treeVisiblePages
      .filter((page) => page.section_id === activeHierarchyRoot.id)
      .sort((a, b) => a.display_order - b.display_order || a.title.localeCompare(b.title));
  }, [activeHierarchyRoot, treeVisiblePages]);
  const readerHierarchySections = useMemo(() => {
    if (!activeHierarchyRoot) return [] as Section[];
    const children = sortedVisibleChildren(activeHierarchyRoot.id).filter(
      (section) => (section.section_type ?? "section") !== "version",
    );
    const base = children;
    // When viewing a version, also include product-level non-version siblings (e.g. FAQ)
    if (selectedVersion && selectedProduct && selectedVersion.id !== selectedProduct.id) {
      const productChildren = sortedVisibleChildren(selectedProduct.id);
      const siblings = productChildren.filter(
        (s) => (s.section_type ?? "section") !== "version" && !base.some((b) => b.id === s.id),
      );
      return [...base, ...siblings];
    }
    return base;
  }, [activeHierarchyRoot, selectedProduct, selectedVersion, sortedVisibleChildren]);
  const readerHierarchyTitle = selectedVersion?.name ?? selectedTab?.name ?? selectedProduct?.name ?? "Documentation";

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
      // If selected page belongs to a specific version, follow it.
      if (
        selectedPageVersionId &&
        productVersions.some((section) => section.id === selectedPageVersionId) &&
        selectedSidebarVersionId !== selectedPageVersionId
      ) {
        setSelectedSidebarVersionId(selectedPageVersionId);
        return; // only return after following a version
      }
      // Product-level page (not under any version) — fall through to clear stale version.
    }

    // No selected page: preserve a valid user-selected version, else stay on base scope.
    if (selectedSidebarVersionId !== null && !productVersions.some((section) => section.id === selectedSidebarVersionId)) {
      setSelectedSidebarVersionId(null);
    }
  }, [productVersions, selectedPageVersionId, selectedProduct, selectedSectionPath, selectedSidebarVersionId]);
  useEffect(() => {
    if (!isProductHierarchy) return;
    if (!selectedProduct) return;
    if (selectedPage) return;
    if (selectedSidebarVersionId !== null) return;
    if (productVersions.length === 0) return;
    const firstBasePage = findFirstPageInProductBase(selectedProduct.id);
    if (firstBasePage) return;
    const fallbackVersion = productVersions[0];
    if (!fallbackVersion) return;
    setSelectedSidebarVersionId(fallbackVersion.id);
  }, [
    findFirstPageInProductBase,
    isProductHierarchy,
    productVersions,
    selectedPage,
    selectedProduct,
    selectedSidebarVersionId,
  ]);

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
    const stripVersionSections = (list: Section[]) =>
      list.filter((section) => (section.section_type ?? "section") !== "version");
    const selectedRoot = displayedSectionTree[0];
    if (!selectedRoot) return [] as Section[];

    // When a tab is selected, show sections under that tab
    if (selectedSidebarTabId) {
      const selectedTabNode = selectedRoot.children?.find((child) => child.id === selectedSidebarTabId);
      if (selectedTabNode) {
        return selectedTabNode.children ?? [];
      }
      return [];
    }

    // When a version is selected but no tab, show tabs as top-level items
    if (selectedVersion) {
      const versionChildren = stripVersionSections(selectedRoot.children ?? []);
      // Also include non-version siblings from the product level (e.g. FAQ imported directly under the product)
      const productNode = sectionTree.find((root) => root.id === selectedSidebarProductId);
      const productLevelSections = (productNode?.children ?? []).filter(
        (child) => (child.section_type ?? "section") !== "version" && !versionChildren.some((vc) => vc.id === child.id),
      );
      return stripVersionSections([...versionChildren, ...productLevelSections]);
    }

    return stripVersionSections(selectedRoot.children ?? []);
  }, [displayedSectionTree, isProductHierarchy, sectionTree, selectedSidebarProductId, selectedVersion, selectedSidebarTabId]);
  const adminRootPages = useMemo(() => {
    if (!isProductHierarchy || selectedSidebarProductId === null) {
      return treeVisiblePages.filter((page) => !page.section_id);
    }
    if (selectedSidebarTabId) return treeVisiblePages.filter((page) => page.section_id === selectedSidebarTabId);
    if (selectedVersion) return treeVisiblePages.filter((page) => page.section_id === selectedVersion.id);
    return treeVisiblePages.filter((page) => page.section_id === selectedSidebarProductId);
  }, [isProductHierarchy, selectedSidebarProductId, selectedVersion, selectedSidebarTabId, treeVisiblePages]);
  const adminSectionDepthBase = isProductHierarchy && selectedSidebarProductId !== null ? 1 : 0;
  const shouldShowAdminTree = !selectedPage;
  const analyticsSnapshot = useMemo<AnalyticsSnapshot>(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const parseDate = (value: string | null | undefined): number => {
      if (!value) return 0;
      const timestamp = Date.parse(value);
      return Number.isFinite(timestamp) ? timestamp : 0;
    };

    const pageTimestamp = (page: Page): number => {
      const updated = parseDate(page.updated_at);
      if (updated > 0) return updated;
      return parseDate(page.created_at);
    };

    const isPublished = (page: Page): boolean => page.is_published || page.status === "published";
    const publishedPages = pages.filter(isPublished);
    const draftPages = pages.filter((page) => !isPublished(page));

    const publicPublishedCount = publishedPages.filter(
      (page) => resolveEffectivePageVisibility(page, sectionsById) === "public",
    ).length;
    const externalPublishedCount = publishedPages.filter(
      (page) => resolveEffectivePageVisibility(page, sectionsById) === "external",
    ).length;
    const internalPublishedCount = publishedPages.filter(
      (page) => resolveEffectivePageVisibility(page, sectionsById) === "internal",
    ).length;

    const outwardReachCount = publicPublishedCount + externalPublishedCount;
    const updatedLast7Days = pages.filter((page) => pageTimestamp(page) >= sevenDaysAgo).length;
    const updatedLast30Days = pages.filter((page) => pageTimestamp(page) >= thirtyDaysAgo).length;
    const stalePublishedCount = publishedPages.filter((page) => pageTimestamp(page) > 0 && pageTimestamp(page) < thirtyDaysAgo).length;
    const staleDraftCount = draftPages.filter((page) => pageTimestamp(page) > 0 && pageTimestamp(page) < fourteenDaysAgo).length;
    const syncLagCount = publishedPages.filter((page) => {
      const updatedAt = pageTimestamp(page);
      const syncedAt = parseDate(page.last_synced_at);
      return updatedAt > 0 && syncedAt > 0 && updatedAt > syncedAt;
    }).length;
    const syncedLast7Days = pages.filter((page) => parseDate(page.last_synced_at) >= sevenDaysAgo).length;

    const coveragePct = pages.length > 0 ? Math.round((publishedPages.length / pages.length) * 100) : 0;
    const freshnessPct = pages.length > 0 ? Math.round((updatedLast30Days / pages.length) * 100) : 0;
    const outwardReachPct = publishedPages.length > 0 ? Math.round((outwardReachCount / publishedPages.length) * 100) : 0;

    const recentPages = [...pages]
      .sort((a, b) => pageTimestamp(b) - pageTimestamp(a))
      .slice(0, 5);

    return {
      totalPages: pages.length,
      publishedCount: publishedPages.length,
      draftCount: draftPages.length,
      coveragePct,
      publicPublishedCount,
      externalPublishedCount,
      internalPublishedCount,
      outwardReachCount,
      outwardReachPct,
      updatedLast7Days,
      updatedLast30Days,
      freshnessPct,
      stalePublishedCount,
      staleDraftCount,
      syncLagCount,
      syncedLast7Days,
      recentPages,
    };
  }, [pages, sectionsById]);
  const handleSelectPage = useCallback((pageId: number | null) => {
    setSelectedPageId(pageId);
    setSelectedApprovalId(null);
    setDashboardPaneMode("content");
    // Close mobile overlays when a page is selected
    if (isMobile) {
      setMobileSidebarOpen(false);
      setMobileHierarchyOpen(false);
    }
  }, [isMobile]);

  const handleSidebarProductSwitch = useCallback(
    (value: string) => {
      const productId = Number(value);
      if (!Number.isFinite(productId)) return;
      setSelectedSidebarProductId(productId);
      const firstPage = findFirstPageInProductBase(productId);
      if (firstPage) {
        setSelectedSidebarVersionId(null);
        handleSelectPage(firstPage.id);
        return;
      }
      const versions = productVersionsByProduct.get(productId) ?? [];
      if (versions.length > 0) {
        const fallbackVersion = versions[0];
        setSelectedSidebarVersionId(fallbackVersion.id);
        const firstVersionPage = findFirstPageInSection(fallbackVersion.id);
        handleSelectPage(firstVersionPage?.id ?? null);
        return;
      }
      setSelectedSidebarVersionId(null);
      handleSelectPage(null);
    },
    [findFirstPageInProductBase, findFirstPageInSection, handleSelectPage, productVersionsByProduct],
  );
  const handleSidebarVersionSwitch = useCallback(
    (value: string) => {
      setSelectedSidebarTabId(null);
      if (value === "__base__") {
        setSelectedSidebarVersionId(null);
        if (selectedProduct) {
          const firstBasePage = findFirstPageInProductBase(selectedProduct.id);
          handleSelectPage(firstBasePage?.id ?? null);
        }
        return;
      }
      const versionId = Number(value);
      if (!Number.isFinite(versionId)) return;
      setSelectedSidebarVersionId(versionId);
      const firstPage = findFirstPageInSection(versionId);
      handleSelectPage(firstPage?.id ?? null);
    },
    [findFirstPageInProductBase, findFirstPageInSection, handleSelectPage, selectedProduct],
  );
  const handleSidebarTabSwitch = useCallback(
    (tabId: number | null) => {
      setSelectedSidebarTabId(tabId);
      if (tabId !== null) {
        const firstPage = findFirstPageInSection(tabId);
        handleSelectPage(firstPage?.id ?? null);
      }
    },
    [findFirstPageInSection, handleSelectPage],
  );
  const selectedSidebarProductValue =
    selectedSidebarProductId !== null
      ? String(selectedSidebarProductId)
      : (rootProducts[0] ? String(rootProducts[0].id) : "");
  const selectedSidebarVersionValue =
    selectedVersion?.id !== undefined && selectedVersion?.id !== null
      ? String(selectedVersion.id)
      : "__base__";
  const selectedSectionForSubSection = useMemo(() => {
    if (selectedPage?.section_id) {
      return sectionsById.get(selectedPage.section_id) ?? null;
    }
    const deepest = selectedSectionPath[selectedSectionPath.length - 1];
    if (!deepest) return null;
    return deepest.parent_id !== null ? deepest : null;
  }, [sectionsById, selectedPage?.section_id, selectedSectionPath]);
  const createTargetParent = selectedTab ?? selectedVersion ?? selectedProduct ?? null;
  const canCreateTabInCurrentContext = isProductHierarchy
    ? !!(selectedVersion ?? selectedProduct)
    : true;
  const canCreateSectionInCurrentContext = isProductHierarchy
    ? createTargetParent !== null
    : true;
  const canCreateSubSectionInCurrentContext = selectedSectionForSubSection !== null;
  const defaultAddPageSectionId =
    isProductHierarchy
      ? (selectedVersion?.id ?? selectedProduct?.id ?? null)
      : null;
  const canCreateVersionForSelectedProduct = isProductHierarchy && selectedProduct !== null;
  const latestVersionCloneSourceId = useMemo(() => {
    if (productVersions.length === 0) return null;
    const latest = [...productVersions].sort(
      (a, b) => (a.display_order - b.display_order) || (a.id - b.id),
    ).at(-1);
    return latest?.id ?? null;
  }, [productVersions]);
  const notifyPermissionDenied = useCallback(
    (actionLabel: string) => {
      toast({
        title: "Permission denied",
        description: `Your role (${currentUserRole}) cannot ${actionLabel}.`,
        variant: "destructive",
      });
    },
    [currentUserRole, toast],
  );
  const handleSectionCreated = useCallback((created: Section) => {
    // Ensure newly created nodes are visible immediately in the current tree view.
    setPageSearchQuery("");
    setVisibilityFilter("all");
    setDashboardPaneMode("content");
    setSelectedPageId(null);
    setSelectedApprovalId(null);

    if (created.parent_id === null) {
      setSelectedSidebarProductId(created.id);
      setSelectedSidebarVersionId(null);
      return;
    }

    let cursor = sectionsById.get(created.parent_id);
    let productId: number | null = null;
    let versionId: number | null = null;

    while (cursor) {
      if (cursor.parent_id === null) {
        productId = cursor.id;
        break;
      }
      if (versionId === null && (cursor.section_type ?? "section") === "version") {
        versionId = cursor.id;
      }
      cursor = cursor.parent_id ? sectionsById.get(cursor.parent_id) : undefined;
    }

    if (productId !== null) {
      setSelectedSidebarProductId(productId);
    }
    if ((created.section_type ?? "section") === "version") {
      setSelectedSidebarVersionId(created.id);
    } else if (versionId !== null) {
      setSelectedSidebarVersionId(versionId);
    } else {
      setSelectedSidebarVersionId(null);
    }
  }, [sectionsById]);
  const openConfigureHierarchyDialog = useCallback(() => {
    if (!canConfigureHierarchy) {
      notifyPermissionDenied("configure hierarchy");
      return;
    }
    setShowConfigureTabs(true);
  }, [canConfigureHierarchy, notifyPermissionDenied]);
  const openAddSectionDialogInternal = useCallback((params: {
    parentId: number | null;
    preferredType?: "section" | "tab" | "version";
    cloneFromSectionId?: number | null;
    title?: string;
    hideTypePicker?: boolean;
    allowDestinationPicker?: boolean;
    deniedActionLabel?: string;
  }) => {
    if (!canManageStructure) {
      notifyPermissionDenied(params.deniedActionLabel ?? "manage hierarchy");
      return;
    }
    setAddSectionParentId(params.parentId);
    setAddSectionPreferredType(params.preferredType);
    setAddSectionCloneFromId(params.cloneFromSectionId ?? null);
    setAddSectionDialogTitle(params.title);
    setAddSectionHideTypePicker(params.hideTypePicker ?? false);
    setAddSectionAllowDestinationPicker(params.allowDestinationPicker ?? false);
    setShowAddSection(true);
  }, [canManageStructure, notifyPermissionDenied]);
  const openAddProductDialog = useCallback(() => {
    openAddSectionDialogInternal({
      parentId: null,
      title: "New product",
      deniedActionLabel: "create products",
    });
  }, [openAddSectionDialogInternal]);
  const openCreateItemDialog = useCallback(() => {
    openAddSectionDialogInternal({
      parentId: selectedImportTargetSection?.id ?? selectedVersion?.id ?? selectedProduct?.id ?? null,
      title: "Create item",
      deniedActionLabel: "create content",
      allowDestinationPicker: true,
    });
  }, [openAddSectionDialogInternal, selectedImportTargetSection, selectedProduct, selectedVersion]);
  const openAddSectionDialog = useCallback((parentId: number) => {
    openAddSectionDialogInternal({
      parentId,
      preferredType: "section",
      title: "New sub-section",
      hideTypePicker: false,
      deniedActionLabel: "create sections",
    });
  }, [openAddSectionDialogInternal]);
  const openAddTabDialog = useCallback(() => {
    if (!canCreateTabInCurrentContext) {
      toast({
        title: "Choose destination first",
        description: "Select a product or version to create a tab.",
        variant: "destructive",
      });
      return;
    }
    const parent = selectedVersion ?? selectedProduct;
    if (!parent) return;
    openAddSectionDialogInternal({
      parentId: parent.id,
      preferredType: "tab",
      title: `New tab in "${parent.name}"`,
      hideTypePicker: true,
      deniedActionLabel: "create tabs",
    });
  }, [canCreateTabInCurrentContext, openAddSectionDialogInternal, selectedProduct, selectedVersion, toast]);
  const openAddSectionInContextDialog = useCallback(() => {
    if (!canCreateSectionInCurrentContext) {
      toast({
        title: "Choose destination first",
        description: "Select where this section should be created.",
        variant: "destructive",
      });
      return;
    }
    if (!isProductHierarchy && !createTargetParent) {
      openAddSectionDialogInternal({
        parentId: null,
        preferredType: "section",
        title: "New section",
        hideTypePicker: true,
        deniedActionLabel: "create sections",
      });
      return;
    }
    if (!createTargetParent) return;
    openAddSectionDialogInternal({
      parentId: createTargetParent.id,
      preferredType: "section",
      title: `New section in "${createTargetParent.name}"`,
      hideTypePicker: true,
      deniedActionLabel: "create sections",
    });
  }, [canCreateSectionInCurrentContext, createTargetParent, isProductHierarchy, openAddSectionDialogInternal, toast]);
  const openAddSubSectionInContextDialog = useCallback(() => {
    if (!selectedSectionForSubSection) {
      toast({
        title: "Choose a section first",
        description: "Open a page inside a section, then create a sub-section.",
        variant: "destructive",
      });
      return;
    }
    openAddSectionDialogInternal({
      parentId: selectedSectionForSubSection.id,
      preferredType: "section",
      title: `New sub-section in "${selectedSectionForSubSection.name}"`,
      hideTypePicker: true,
      deniedActionLabel: "create sections",
    });
  }, [openAddSectionDialogInternal, selectedSectionForSubSection, toast]);
  const openAddPageDialog = useCallback((sectionId: number | null = defaultAddPageSectionId) => {
    if (!canCreateContent) {
      notifyPermissionDenied("create pages");
      return;
    }
    setAddPageSectionId(sectionId);
    setShowAddPage(true);
  }, [canCreateContent, defaultAddPageSectionId, notifyPermissionDenied]);
  const openAddVersionDialog = useCallback(() => {
    if (!canCreateContent) {
      notifyPermissionDenied("create versions");
      return;
    }
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
    setAddSectionCloneFromId(latestVersionCloneSourceId ?? selectedProduct.id);
    setAddSectionDialogTitle(`New version for "${selectedProduct.name}"`);
    setAddSectionHideTypePicker(true);
    setShowAddSection(true);
  }, [canCreateContent, canCreateVersionForSelectedProduct, latestVersionCloneSourceId, notifyPermissionDenied, selectedProduct, toast]);

  const openImportDialogForTarget = useCallback((targetInput: Section | DriveImportTarget | null) => {
    if (!canOpenImportDialog) {
      notifyPermissionDenied("import content");
      return;
    }
    const resolvedTarget: DriveImportTarget | null =
      targetInput == null
        ? null
        : "type" in targetInput
          ? targetInput
          : toDriveImportTarget(targetInput);
    if (!resolvedTarget) {
      setScanTarget(null);
      setShowScanDrive(true);
      return;
    }
    setScanTarget(resolvedTarget);
    setShowScanDrive(true);
  }, [canOpenImportDialog, notifyPermissionDenied]);

  // ── DnD setup ──────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reorderPages = useMutation({
    mutationFn: async (updates: PageOrderUpdate[]) => {
      for (const update of updates) {
        const { id, ...payload } = update;
        await pagesApi.update(id, payload);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pages"] }),
    onError: (err: Error) => toast({ title: "Move failed", description: err.message, variant: "destructive" }),
  });

  const reorderSections = useMutation({
    mutationFn: async (updates: SectionOrderUpdate[]) => {
      for (const update of updates) {
        const { id, ...payload } = update;
        await sectionsApi.update(id, payload);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sections"] }),
    onError: (err: Error) => toast({ title: "Move failed", description: err.message, variant: "destructive" }),
  });

  const orderedPagesForSection = useCallback(
    (sectionId: number | null): Page[] => {
      const siblings = pagesData?.pages.filter((p) => p.section_id === sectionId) ?? [];
      return sortPagesByDisplayOrder(siblings);
    },
    [pagesData?.pages],
  );

  const orderedSectionsForParent = useCallback(
    (parentId: number | null): Section[] => {
      const siblings = sectionsData?.sections.filter((s) => s.parent_id === parentId) ?? [];
      return sortSectionsByDisplayOrder(siblings);
    },
    [sectionsData?.sections],
  );

  const buildPageOrderUpdates = useCallback(
    (ordered: Page[], sectionId: number | null): PageOrderUpdate[] =>
      ordered.flatMap((item, index) => {
        const nextSectionId = sectionId;
        if (item.section_id === nextSectionId && item.display_order === index) return [];
        return [{ id: item.id, section_id: nextSectionId, display_order: index }];
      }),
    [],
  );

  const buildSectionOrderUpdates = useCallback(
    (ordered: Section[], parentId: number | null): SectionOrderUpdate[] =>
      ordered.flatMap((item, index) => {
        const nextParentId = parentId;
        if (item.parent_id === nextParentId && item.display_order === index) return [];
        return [{ id: item.id, parent_id: nextParentId, display_order: index }];
      }),
    [],
  );

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    if (!canMoveContent) return;
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
  }, [canMoveContent, pagesData, sectionsData]);

  const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    if (!canMoveContent) {
      setActiveDragType(null);
      setActiveDragLabel("");
      return;
    }
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
        const overPageId = parseInt(overStr.slice(5));
        const overPage = pagesData?.pages.find((p) => p.id === overPageId);
        if (!overPage) return;
        const dropPosition = resolveDropPosition(active, over);

        const sourceSectionId = page.section_id ?? null;
        const targetSectionId = overPage.section_id ?? null;

        if (sourceSectionId === targetSectionId) {
          const sourcePages = orderedPagesForSection(sourceSectionId);
          const sourceIndex = sourcePages.findIndex((p) => p.id === page.id);
          const targetIndex = sourcePages.findIndex((p) => p.id === overPage.id);
          if (sourceIndex === -1 || targetIndex === -1) return;
          const withoutSource = sourcePages.filter((p) => p.id !== page.id);
          const targetIndexInWithoutSource = withoutSource.findIndex((p) => p.id === overPage.id);
          if (targetIndexInWithoutSource === -1) return;
          const insertIndex =
            targetIndexInWithoutSource + (dropPosition === "after" ? 1 : 0);
          if (sourceIndex === insertIndex || sourceIndex === insertIndex - 1) return;
          const reordered = [...withoutSource];
          reordered.splice(Math.min(reordered.length, Math.max(0, insertIndex)), 0, page);
          const updates = buildPageOrderUpdates(reordered, sourceSectionId);
          if (updates.length === 0) return;
          reorderPages.mutate(updates);
          return;
        }

        const targetPages = orderedPagesForSection(targetSectionId);
        const targetIndex = targetPages.findIndex((p) => p.id === overPage.id);
        const targetInsertIndex =
          (targetIndex === -1 ? targetPages.length : targetIndex) + (dropPosition === "after" ? 1 : 0);
        const sourceWithout = orderedPagesForSection(sourceSectionId).filter((p) => p.id !== page.id);
        const targetWith = [...targetPages];
        const insertAt = Math.min(targetWith.length, Math.max(0, targetInsertIndex));
        targetWith.splice(insertAt, 0, page);
        const updates = [
          ...buildPageOrderUpdates(sourceWithout, sourceSectionId),
          ...buildPageOrderUpdates(targetWith, targetSectionId),
        ];
        if (updates.length === 0) return;
        reorderPages.mutate(updates);

      } else if (overStr.startsWith("nest-") || overStr.startsWith("sect-")) {
        const targetSectionId = parseInt(overStr.slice(5), 10);
        const dropPosition = resolveDropPosition(active, over);
        const targetPages = orderedPagesForSection(targetSectionId);
        const targetIndex = dropPosition === "before" ? 0 : targetPages.length;
        const sourceSectionId = page.section_id ?? null;

        if (sourceSectionId === targetSectionId) {
          const withoutSource = targetPages.filter((p) => p.id !== page.id);
          const insertAt = Math.min(withoutSource.length, Math.max(0, targetIndex));
          const reordered = [...withoutSource];
          reordered.splice(insertAt, 0, page);
          const updates = buildPageOrderUpdates(reordered, sourceSectionId);
          if (updates.length === 0) return;
          reorderPages.mutate(updates);
          return;
        }

        const sourceWithout = orderedPagesForSection(sourceSectionId).filter((p) => p.id !== page.id);
        const targetWith = [...targetPages];
        const insertAt = Math.min(targetWith.length, Math.max(0, targetIndex));
        targetWith.splice(insertAt, 0, page);
        const updates = [
          ...buildPageOrderUpdates(sourceWithout, sourceSectionId),
          ...buildPageOrderUpdates(targetWith, targetSectionId),
        ];
        if (updates.length === 0) return;
        reorderPages.mutate(updates);
      }

    } else if (activeStr.startsWith("sect-")) {
      const sectionId = parseInt(activeStr.slice(5));
      const section = sectionsData?.sections.find((s) => s.id === sectionId);
      if (!section) return;

      if (overStr.startsWith("nest-")) {
        const targetId = parseInt(overStr.slice(5), 10);
        if (targetId === sectionId) return;
        // Prevent nesting into own descendant
        const isDescendant = (checkId: number): boolean => {
          const children = sectionsData?.sections.filter((s) => s.parent_id === checkId) ?? [];
          return children.some((c) => c.id === targetId || isDescendant(c.id));
        };
        if (isDescendant(sectionId)) return;
        const dropPosition = resolveDropPosition(active, over);

        if (dropPosition === "inside") {
          const sourceParentId = section.parent_id ?? null;
          const targetChildren = orderedSectionsForParent(targetId).filter((s) => s.id !== sectionId);
          const targetWith = [...targetChildren, section];
          const updates =
            sourceParentId === targetId
              ? buildSectionOrderUpdates(targetWith, targetId)
              : [
                ...buildSectionOrderUpdates(
                  orderedSectionsForParent(sourceParentId).filter((s) => s.id !== sectionId),
                  sourceParentId,
                ),
                ...buildSectionOrderUpdates(targetWith, targetId),
              ];
          if (updates.length === 0) return;
          reorderSections.mutate(updates);
          return;
        }

        const targetSection = sectionsData?.sections.find((s) => s.id === targetId);
        if (!targetSection) return;
        const targetParentId = targetSection.parent_id ?? null;
        const siblingSections = orderedSectionsForParent(targetParentId).filter((s) => s.id !== sectionId);
        const targetIndex = siblingSections.findIndex((s) => s.id === targetId);
        if (targetIndex === -1) return;
        const insertIndex = targetIndex + (dropPosition === "after" ? 1 : 0);
        const sourceParentId = section.parent_id ?? null;
        const targetWith = [...siblingSections];
        const insertAt = Math.min(targetWith.length, Math.max(0, insertIndex));
        targetWith.splice(insertAt, 0, section);
        const updates =
          sourceParentId === targetParentId
            ? buildSectionOrderUpdates(targetWith, targetParentId)
            : [
              ...buildSectionOrderUpdates(
                orderedSectionsForParent(sourceParentId).filter((s) => s.id !== sectionId),
                sourceParentId,
              ),
              ...buildSectionOrderUpdates(targetWith, targetParentId),
            ];
        if (updates.length === 0) return;
        reorderSections.mutate(updates);

      } else if (overStr.startsWith("sect-")) {
        const overSectionId = parseInt(overStr.slice(5), 10);
        const overSection = sectionsData?.sections.find((s) => s.id === overSectionId);
        if (!overSection || overSection.parent_id !== section.parent_id) return;
        const siblingSections = orderedSectionsForParent(section.parent_id ?? null);
        const sourceIndex = siblingSections.findIndex((s) => s.id === sectionId);
        const targetIndex = siblingSections.findIndex((s) => s.id === overSectionId);
        if (sourceIndex === -1 || targetIndex === -1) return;
        const dropPosition = resolveDropPosition(active, over);
        const withoutSource = siblingSections.filter((s) => s.id !== sectionId);
        const targetIndexInWithoutSource = withoutSource.findIndex((s) => s.id === overSectionId);
        if (targetIndexInWithoutSource === -1) return;
        const insertIndex = targetIndexInWithoutSource + (dropPosition === "after" ? 1 : 0);
        if (sourceIndex === insertIndex || sourceIndex === insertIndex - 1) return;
        const reordered = [...withoutSource];
        reordered.splice(Math.min(reordered.length, Math.max(0, insertIndex)), 0, section);
        const updates = buildSectionOrderUpdates(reordered, section.parent_id ?? null);
        if (updates.length === 0) return;
        reorderSections.mutate(updates);
      }
    }
  }, [
    canMoveContent,
    pagesData,
    sectionsData,
    orderedPagesForSection,
    orderedSectionsForParent,
    buildPageOrderUpdates,
    buildSectionOrderUpdates,
    reorderPages,
    reorderSections,
  ]);
  // ──────────────────────────────────────────────────────────────────────────

  const createSection = useMutation({
    mutationFn: (name: string) => sectionsApi.create({ name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sections"] }); toast({ title: "Section created" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteSection = useMutation({
    mutationFn: (id: number) => sectionsApi.delete(id),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["sections"] });
      qc.invalidateQueries({ queryKey: ["pages"] });
      if (result.drive_errors?.length) {
        toast({
          title: "Section deleted",
          description: "Warning: some Drive items could not be trashed. Reconnect Drive if this persists.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Section deleted" });
      }
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
      if (result.removed_pages || result.removed_sections) {
        qc.invalidateQueries({ queryKey: ["sections"] });
      }
      const parts = [`${result.synced} updated`, `${result.skipped} unchanged`];
      if (result.removed_pages) parts.push(`${result.removed_pages} removed`);
      if (result.removed_sections) parts.push(`${result.removed_sections} sections cleaned up`);
      if (result.errors) parts.push(`${result.errors} failed`);
      toast({
        title: "Sync complete",
        description: parts.join(", "),
        variant: result.errors ? "destructive" : "default",
      });
    },
    onError: (err: Error) => toast({ title: "Sync failed", description: driveErrorMessage(err), variant: "destructive" }),
  });

  const syncPage = useMutation({
    mutationFn: (id: number) => pagesApi.sync(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["page", selectedPageId] });
      toast({ title: "Synced" });
    },
  });

  const submitPageForReview = useMutation({
    mutationFn: (id: number) => pagesApi.submitReview(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["page", selectedPageId] });
      toast({ title: "Submitted for review" });
    },
    onError: (err: Error) => toast({ title: "Submit failed", description: err.message, variant: "destructive" }),
  });

  const approvePage = useMutation({
    mutationFn: (id: number) => pagesApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["page", selectedPageId] });
      toast({ title: "Approved and published" });
    },
    onError: (err: Error) => toast({ title: "Approve failed", description: err.message, variant: "destructive" }),
  });

  const rejectPage = useMutation({
    mutationFn: (id: number) => pagesApi.reject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["page", selectedPageId] });
      toast({ title: "Changes requested", description: "Page moved back to draft." });
    },
    onError: (err: Error) => toast({ title: "Reject failed", description: err.message, variant: "destructive" }),
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
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      setSelectedPageId(null);
      if (result.drive_trashed === false && result.drive_error) {
        toast({ title: "Page deleted", description: "Warning: the Google Doc could not be trashed — " + result.drive_error, variant: "destructive" });
      } else {
        toast({ title: "Page deleted" });
      }
    },
  });

  const duplicatePage = useMutation({
    mutationFn: (id: number) => pagesApi.duplicate(id),
    onSuccess: (newPage) => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      handleSelectPage(newPage.id);
      toast({ title: "Page duplicated", description: "A Google Doc copy was created." });
    },
    onError: (err: Error) => toast({ title: "Duplicate failed", description: err.message, variant: "destructive" }),
  });

  const handleDeleteSection = useCallback((section: Section) => {
    if (!canDeleteSection) {
      notifyPermissionDenied("delete sections");
      return;
    }
    const label = section.parent_id === null ? "product" : (section.section_type ?? "section");
    const confirmed = window.confirm(`Delete ${label} "${section.name}"?\n\nIts Drive folder will be moved to trash.`);
    if (!confirmed) return;
    deleteSection.mutate(section.id);
    if ((section.section_type ?? "section") === "version" && selectedSidebarVersionId === section.id) {
      setSelectedSidebarVersionId(null);
      setSelectedSidebarTabId(null);
    } else if ((section.section_type ?? "section") === "tab" && selectedSidebarTabId === section.id) {
      setSelectedSidebarTabId(null);
    }
  }, [canDeleteSection, deleteSection, notifyPermissionDenied, selectedSidebarVersionId, selectedSidebarTabId]);

  const handleSectionTypeChange = useCallback((section: Section, nextType: "section" | "tab" | "version") => {
    if (!canManageStructure) {
      notifyPermissionDenied("change section type");
      return;
    }
    updateSectionType.mutate({ id: section.id, section_type: nextType });
  }, [canManageStructure, notifyPermissionDenied, updateSectionType]);

  const handleSectionVisibilityChange = useCallback((section: Section, visibility: VisibilityLevel) => {
    if (!canEditVisibilitySettings) {
      notifyPermissionDenied("change visibility");
      return;
    }
    updateSectionVisibility.mutate({ id: section.id, visibility });
  }, [canEditVisibilitySettings, notifyPermissionDenied, updateSectionVisibility]);

  const handlePageVisibilityOverride = useCallback((page: Page, visibility: VisibilityLevel | null) => {
    if (!canEditVisibilitySettings) {
      notifyPermissionDenied("change visibility");
      return;
    }
    updatePageVisibility.mutate({ id: page.id, visibility_override: visibility });
  }, [canEditVisibilitySettings, notifyPermissionDenied, updatePageVisibility]);

  const handleDuplicatePage = useCallback((page: Page) => {
    if (!canCreateContent) {
      notifyPermissionDenied("duplicate pages");
      return;
    }
    duplicatePage.mutate(page.id);
  }, [canCreateContent, duplicatePage, notifyPermissionDenied]);

  const handleSyncAllPages = useCallback(() => {
    if (!canSyncContent) {
      notifyPermissionDenied("sync pages");
      return;
    }
    if (!driveConnected || syncAll.isPending) return;
    syncAll.mutate();
  }, [canSyncContent, driveConnected, notifyPermissionDenied, syncAll]);

  const handleSyncCurrentPage = useCallback((pageId: number) => {
    if (!canSyncContent) {
      notifyPermissionDenied("sync pages");
      return;
    }
    syncPage.mutate(pageId);
  }, [canSyncContent, notifyPermissionDenied, syncPage]);

  const handleSubmitCurrentPageForReview = useCallback((page: Page) => {
    if (!canPublishContent) {
      notifyPermissionDenied("submit pages for review");
      return;
    }
    submitPageForReview.mutate(page.id);
  }, [canPublishContent, notifyPermissionDenied, submitPageForReview]);

  const handleApproveCurrentPage = useCallback((page: Page) => {
    if (!canReviewContent) {
      notifyPermissionDenied("approve pages");
      return;
    }
    approvePage.mutate(page.id);
  }, [approvePage, canReviewContent, notifyPermissionDenied]);

  const handleRejectCurrentPage = useCallback((page: Page) => {
    if (!canReviewContent) {
      notifyPermissionDenied("reject pages");
      return;
    }
    rejectPage.mutate(page.id);
  }, [canReviewContent, notifyPermissionDenied, rejectPage]);

  const handleRearrangePage = useCallback((page: Page) => {
    if (!canMoveContent) {
      notifyPermissionDenied("rearrange pages");
      return;
    }
    toast({
      title: "Re-arrange page",
      description: `Drag "${page.title}" using the grip handle to reorder.`,
    });
  }, [canMoveContent, notifyPermissionDenied, toast]);

  const handleDeletePage = useCallback((page: Page) => {
    if (!canDeleteContent) {
      notifyPermissionDenied("delete pages");
      return;
    }
    const confirmed = window.confirm(`Delete "${page.title}"?\n\nThis will also move the Google Doc to Drive trash.`);
    if (!confirmed) return;
    deletePage.mutate(page.id);
  }, [canDeleteContent, deletePage, notifyPermissionDenied]);

  const handleUnpublishPage = useCallback((page: Page) => {
    if (!canPublishContent) {
      notifyPermissionDenied("unpublish pages");
      return;
    }
    if (!page.is_published) return;
    unpublishPage.mutate(page.id);
  }, [canPublishContent, notifyPermissionDenied, unpublishPage]);

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
  const normalizedCustomDocsOrigin = useMemo(() => {
    const raw = (org?.custom_docs_domain ?? "").trim();
    if (!raw) return null;
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const parsed = new URL(candidate);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return null;
    }
  }, [org?.custom_docs_domain]);
  const publicDocsUrl = normalizedCustomDocsOrigin
    ? `${normalizedCustomDocsOrigin}/docs/${orgSlug}`
    : `${API_BASE_URL}/docs/${orgSlug}`;
  const internalDocsUrl = `${API_BASE_URL}/internal-docs/${orgSlug}`;
  const externalDocsUrl = `${API_BASE_URL}/external-docs/${orgSlug}`;
  const publishedSlugCountsByVisibility = useMemo(() => {
    const counts = new Map<string, number>();
    for (const candidate of pages) {
      const isLive = candidate.is_published || candidate.status === "published";
      if (!isLive) continue;
      const visibility = resolveEffectivePageVisibility(candidate, sectionsById);
      const key = `${visibility}:${candidate.slug}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [pages, sectionsById]);
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
      const collisionKey = `${effectiveVisibility}:${page.slug}`;
      const hasSlugCollision = (publishedSlugCountsByVisibility.get(collisionKey) ?? 0) > 1;
      if (hasSlugCollision) {
        return `${baseUrl}/p/${page.id}/${page.slug}`;
      }
      return `${baseUrl}/${page.slug}`;
    },
    [
      externalDocsUrl,
      internalDocsUrl,
      orgSlug,
      publicDocsUrl,
      publishedSlugCountsByVisibility,
      sectionsById,
    ],
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

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-stone-100 via-background to-amber-50/70 dark:from-background dark:via-background dark:to-background">

      {/* ── Mobile sidebar overlay backdrop ─────────────────────── */}
      {isMobile && mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside
        className={cn(
          "shrink-0 flex flex-col border-r border-border/60 bg-[linear-gradient(180deg,#fdfcf9_0%,#f6f4ee_100%)] dark:bg-muted/20 overflow-hidden transition-all duration-300 backdrop-blur-sm shadow-[inset_-1px_0_0_rgba(255,255,255,0.5)]",
          // Mobile: fixed overlay sidebar
          isMobile
            ? cn(
                "fixed inset-y-0 left-0 z-50 w-[248px]",
                mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
              )
            : cn(
                "relative",
                sidebarCollapsed ? "w-[64px]" : "w-[248px]",
              ),
        )}
      >

        {/* Org header */}
        <div className={cn("px-3 py-3 border-b border-border/70 bg-white/75 dark:bg-background/50 backdrop-blur", sidebarCollapsed ? "space-y-3" : "space-y-2")}>
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
            {(!sidebarCollapsed || isMobile) && (
              <WorkspaceSwitcher
                currentOrg={org ? { id: org.id, name: org.name, logo_url: org.logo_url, primary_color: org.primary_color } : null}
                onWorkspaceChange={handleWorkspaceChange}
              />
            )}
            {(!sidebarCollapsed || isMobile) && (
              <NotificationCenter
                organizationId={org?.id ? String(org.id) : null}
                userRole={currentUserRole || undefined}
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 text-muted-foreground hover:text-foreground",
                !sidebarCollapsed && "ml-auto",
              )}
              onClick={() => {
                if (isMobile) {
                  setMobileSidebarOpen(false);
                } else {
                  setSidebarCollapsed((v) => !v);
                }
              }}
              title={isMobile ? "Close sidebar" : sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isMobile ? <X className="h-4 w-4" /> : sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          {(!sidebarCollapsed || isMobile) ? (
            <div className="rounded-xl border border-border/70 bg-gradient-to-b from-white/85 to-white/65 dark:from-background/60 dark:to-background/40 p-0.5 grid grid-cols-3 gap-0.5 shadow-sm">
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
                className="h-7 w-7 mx-auto text-muted-foreground hover:text-foreground"
                onClick={() => void openPublishedDocs(internalDocsUrl)}
                title="Open internal docs"
              >
                <Lock className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 mx-auto text-muted-foreground hover:text-foreground"
                onClick={() => void openPublishedDocs(externalDocsUrl)}
                title="Open external docs"
              >
                <Share2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 mx-auto text-muted-foreground hover:text-foreground"
                onClick={() => void openPublishedDocs(publicDocsUrl)}
                title="Open public docs"
              >
                <Globe className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {sidebarCollapsed && !isMobile ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Scrollable icon buttons */}
            <div className="flex-1 overflow-y-auto flex flex-col items-center gap-1.5 py-3">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 shrink-0 rounded-lg disabled:opacity-40 disabled:pointer-events-none",
                  dashboardPaneMode === "content"
                    ? "text-primary bg-primary/10 hover:bg-primary/15"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setDashboardPaneMode("content")}
                title="Content view"
              >
                <FileText className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 shrink-0 rounded-lg disabled:opacity-40 disabled:pointer-events-none",
                  dashboardPaneMode === "analytics"
                    ? "text-primary bg-primary/10 hover:bg-primary/15"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setDashboardPaneMode("analytics")}
                title="Analytics view"
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 shrink-0 rounded-lg disabled:opacity-40 disabled:pointer-events-none relative",
                  dashboardPaneMode === "approvals"
                    ? "text-primary bg-primary/10 hover:bg-primary/15"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setDashboardPaneMode("approvals")}
                title="Approvals"
              >
                <ClipboardCheck className="h-4 w-4" />
                {pendingReviewCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 text-[9px] font-semibold">
                    {pendingReviewCount > 99 ? "99+" : pendingReviewCount}
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 shrink-0 rounded-lg disabled:opacity-40 disabled:pointer-events-none",
                  dashboardPaneMode === "agent"
                    ? "text-primary bg-primary/10 hover:bg-primary/15"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setDashboardPaneMode("agent")}
                title="AI Agent"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 shrink-0 rounded-lg disabled:opacity-40 disabled:pointer-events-none",
                  dashboardPaneMode === "developer"
                    ? "text-primary bg-primary/10 hover:bg-primary/15"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setDashboardPaneMode("developer")}
                disabled={!canManageWorkspace}
                title="Developer tools"
              >
                <Code2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
                onClick={openConfigureHierarchyDialog}
                disabled={!canConfigureHierarchy}
                title="Configure content hierarchy"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
                    disabled={!canManageStructure}
                    title="Create content"
                  >
                    <FolderPlus className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="w-64">
                  <DropdownMenuItem onClick={openCreateItemDialog}>
                    <Sparkles className="h-3.5 w-3.5 mr-2" />
                    Create item (choose type)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={openAddProductDialog}>
                    <FolderPlus className="h-3.5 w-3.5 mr-2" />
                    New product (root)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openAddVersionDialog} disabled={!canCreateVersionForSelectedProduct}>
                    <GitBranchPlus className="h-3.5 w-3.5 mr-2" />
                    New version
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openAddTabDialog} disabled={!canCreateTabInCurrentContext}>
                    <LayoutGrid className="h-3.5 w-3.5 mr-2" />
                    New tab
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openAddSectionInContextDialog} disabled={!canCreateSectionInCurrentContext}>
                    <PanelLeft className="h-3.5 w-3.5 mr-2" />
                    New section
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openAddSubSectionInContextDialog} disabled={!canCreateSubSectionInCurrentContext}>
                    <PanelRight className="h-3.5 w-3.5 mr-2" />
                    New sub-section
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openAddPageDialog(defaultAddPageSectionId)} disabled={!canCreateContent}>
                    <Plus className="h-3.5 w-3.5 mr-2" />
                    New page
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
                onClick={() => openImportDialogForTarget(null)}
                disabled={!canOpenImportDialog}
                title="Import content"
              >
                <ArrowUpFromLine className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
                onClick={() => openAddVersionDialog()}
                disabled={!canCreateContent || !canCreateVersionForSelectedProduct}
                title="New version"
              >
                <GitBranchPlus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
                onClick={() => openAddPageDialog(defaultAddPageSectionId)}
                disabled={!canCreateContent}
                title="New page"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {/* Pinned bottom — menu popover */}
            <div className="shrink-0 flex flex-col items-center py-3 border-t">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                    title="Menu"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="right" align="end" className="w-56 p-1">
                  {/* Drive section */}
                  <p className="px-2 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Drive</p>
                  {!driveConnected && canManageDrive && (
                    <button
                      onClick={handleConnectDrive}
                      disabled={isConnectingDrive}
                      className="flex items-center w-full gap-2 px-2 py-1.5 rounded-sm text-xs text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                    >
                      {isConnectingDrive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                      {isConnectingDrive ? "Connecting..." : "Connect Drive"}
                    </button>
                  )}
                  {!driveConnected && !canManageDrive && (
                    <p className="px-2 py-1 text-[11px] text-muted-foreground/70">Drive managed by owner/admin.</p>
                  )}
                  <button
                    onClick={() => openImportDialogForTarget(null)}
                    disabled={!driveConnected || !canOpenImportDialog}
                    className="flex items-center w-full gap-2 px-2 py-1.5 rounded-sm text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Import content
                  </button>
                  <button
                    disabled={!driveConnected || !canSyncContent || syncAll.isPending}
                    onClick={handleSyncAllPages}
                    className="flex items-center w-full gap-2 px-2 py-1.5 rounded-sm text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {syncAll.isPending
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RefreshCw className="h-3.5 w-3.5" />
                    }
                    Sync all pages
                  </button>
                  {driveConnected && (
                    <div className="mx-1 mt-1 rounded-md border bg-muted/30 px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <Wifi className="h-3 w-3 text-emerald-500" />
                        <span className="text-[11px] text-muted-foreground/70">Drive connected</span>
                      </div>
                    </div>
                  )}

                  {/* Account section */}
                  <div className="border-t mt-2 pt-1">
                    <p className="px-2 pt-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Account</p>
                    <div className="px-2 py-1.5 mb-1 rounded-sm bg-muted/30">
                      <p className="text-xs font-medium truncate">{accountName}</p>
                      {accountEmail && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{accountEmail}</p>}
                    </div>
                    <button
                      onClick={() => setShowWorkspaceSettings(true)}
                      disabled={!canManageWorkspace}
                      className="flex items-center w-full gap-2 px-2 py-1.5 rounded-sm text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Workspace settings
                    </button>
                    <button
                      onClick={() => setShowInviteMember(true)}
                      disabled={!org?.id || !canInviteMembers}
                      className="flex items-center w-full gap-2 px-2 py-1.5 rounded-sm text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Invite members
                    </button>
                    <button
                      onClick={() => setShowExternalAccessPanel(true)}
                      disabled={!org?.id || !canManageExternalAccess}
                      className="flex items-center w-full gap-2 px-2 py-1.5 rounded-sm text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Users className="h-3.5 w-3.5" />
                      External access
                    </button>
                  </div>

                  {/* Log out */}
                  <div className="border-t mt-1 pt-1">
                    <button
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                      className="flex items-center w-full gap-2 px-2 py-1.5 rounded-sm text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
                    >
                      {isSigningOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                      {isSigningOut ? "Signing out..." : "Log out"}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        ) : (
          <>
            {/* Nav */}
            <div className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
              <div className="px-2 mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1.5">View</p>
                <div className="grid grid-cols-2 rounded-xl border border-border/70 bg-gradient-to-b from-white/80 to-white/60 dark:from-background/60 dark:to-background/40 p-1 gap-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setDashboardPaneMode("content")}
                    className={cn(
                      "h-7 rounded-md text-[11px] font-semibold transition-colors inline-flex items-center justify-center",
                      dashboardPaneMode === "content"
                        ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Content
                  </button>
                  <button
                    type="button"
                    onClick={() => setDashboardPaneMode("analytics")}
                    className={cn(
                      "h-7 rounded-md text-[11px] font-semibold transition-colors inline-flex items-center justify-center",
                      dashboardPaneMode === "analytics"
                        ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Analytics
                  </button>
                  <button
                    type="button"
                    onClick={() => setDashboardPaneMode("approvals")}
                    className={cn(
                      "h-7 rounded-md text-[11px] font-semibold transition-colors inline-flex items-center justify-center gap-1",
                      dashboardPaneMode === "approvals"
                        ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Approvals
                    {pendingReviewCount > 0 && (
                      <span className="ml-0.5 inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 text-[9px] font-semibold">
                        {pendingReviewCount > 99 ? "99+" : pendingReviewCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDashboardPaneMode("agent")}
                    className={cn(
                      "h-7 rounded-md text-[11px] font-semibold transition-colors inline-flex items-center justify-center gap-1",
                      dashboardPaneMode === "agent"
                        ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Sparkles className="h-3 w-3" />
                    Agent
                  </button>
                  <button
                    type="button"
                    onClick={() => setDashboardPaneMode("developer")}
                    disabled={!canManageWorkspace}
                    className={cn(
                      "h-7 rounded-md text-[11px] font-semibold transition-colors inline-flex items-center justify-center gap-1 disabled:opacity-40 disabled:pointer-events-none",
                      dashboardPaneMode === "developer"
                        ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Code2 className="h-3 w-3" />
                    Dev
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between px-2 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                  Content
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={openConfigureHierarchyDialog}
                    disabled={!canConfigureHierarchy}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
                    title="Configure content hierarchy"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        disabled={!canManageStructure}
                        className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
                        title="Create content"
                      >
                        <FolderPlus className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuItem onClick={openCreateItemDialog}>
                        <Sparkles className="h-3.5 w-3.5 mr-2" />
                        Create item (choose type)
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={openAddProductDialog}>
                        <FolderPlus className="h-3.5 w-3.5 mr-2" />
                        New product (root)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={openAddVersionDialog} disabled={!canCreateVersionForSelectedProduct}>
                        <GitBranchPlus className="h-3.5 w-3.5 mr-2" />
                        New version
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={openAddTabDialog} disabled={!canCreateTabInCurrentContext}>
                        <LayoutGrid className="h-3.5 w-3.5 mr-2" />
                        New tab
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={openAddSectionInContextDialog} disabled={!canCreateSectionInCurrentContext}>
                        <PanelLeft className="h-3.5 w-3.5 mr-2" />
                        New section
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={openAddSubSectionInContextDialog} disabled={!canCreateSubSectionInCurrentContext}>
                        <PanelRight className="h-3.5 w-3.5 mr-2" />
                        New sub-section
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openAddPageDialog(defaultAddPageSectionId)} disabled={!canCreateContent}>
                        <Plus className="h-3.5 w-3.5 mr-2" />
                        New page
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
                        disabled={!canOpenImportDialog}
                        title="Import content"
                      >
                        <ArrowUpFromLine className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80">
                      <DropdownMenuLabel className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                        Import destination
                      </DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => openImportDialogForTarget(null)} className="items-start gap-2 py-2">
                        <FolderOpen className="h-3 w-3 mr-2" />
                        <div className="leading-tight">
                          <p className="text-sm">Choose destination in import dialog</p>
                          <p className="text-[11px] text-muted-foreground">Product, version, tab, section, or workspace root</p>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openImportDialogForTarget(null)} className="items-start gap-2 py-2">
                        <FolderPlus className="h-3 w-3 mr-2" />
                        <div className="leading-tight">
                          <p className="text-sm">Import to workspace root</p>
                          <p className="text-[11px] text-muted-foreground">Use this only to create a new top-level product</p>
                        </div>
                      </DropdownMenuItem>
                      {importQuickTargets.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                            Quick import
                          </DropdownMenuLabel>
                          {importQuickTargets.map(({ contextLabel, target }) => (
                            <DropdownMenuItem
                              key={`import-target-${target.id}`}
                              onClick={() => openImportDialogForTarget(target)}
                              className="items-start gap-2 py-2"
                            >
                              <ArrowUpFromLine className="h-3 w-3 mr-2" />
                              <div className="leading-tight">
                                <p className="text-sm capitalize">Import into {contextLabel}</p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {target.name} ({importTargetTypeLabel(target.type)})
                                </p>
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    onClick={() => openAddVersionDialog()}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
                    disabled={!canCreateContent || !canCreateVersionForSelectedProduct}
                    title="New version"
                  >
                    <GitBranchPlus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => openAddPageDialog(defaultAddPageSectionId)}
                    disabled={!canCreateContent}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
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
                  {selectedProduct && canManageStructure && (
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
                          disabled={!canDeleteSection}
                          onClick={() => handleDeleteSection(selectedProduct)}
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
                  {selectedVersion && canManageStructure && (
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
                          disabled={!canDeleteSection}
                          onClick={() => handleDeleteSection(selectedVersion)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete version
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
              {isProductHierarchy && selectedVersion && versionTabs.length > 0 && (
                <div className="px-2 pb-2">
                  <div className="flex flex-wrap gap-1 items-center">
                    {versionTabs.map((tab) => (
                      <div key={tab.id} className="relative group">
                        <button
                          onClick={() => handleSidebarTabSwitch(selectedSidebarTabId === tab.id ? null : tab.id)}
                          className={cn(
                            "pr-6 px-2 py-1 text-[11px] rounded-md transition-colors",
                            selectedSidebarTabId === tab.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-accent hover:bg-accent/80 text-foreground",
                          )}
                        >
                          {tab.name}
                        </button>
                        {canManageStructure && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                title="Tab options"
                              >
                                <MoreHorizontal className="h-3 w-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => setRenamingSection(tab)}>
                                <Pencil className="h-3.5 w-3.5 mr-2" />
                                Rename tab
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                disabled={!canDeleteSection}
                                onClick={() => handleDeleteSection(tab)}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Delete tab
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {shouldShowAdminTree && (
                adminTreeSections.length === 0 && adminRootPages.length === 0 ? (
                  <div className="px-2 py-4 text-center">
                    <p className="text-xs text-muted-foreground/60">
                      {normalizedPageSearch
                        ? "No pages match this search"
                        : visibilityFilter === "all"
                          ? "No content yet"
                          : "No content for this visibility"}
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
                          canManageActions={canEditContent}
                          canMove={canMoveContent}
                          canManageVisibility={canEditVisibilitySettings}
                          canPublish={canPublishContent}
                          canDelete={canDeleteContent}
                          onSelect={handleSelectPage}
                          onEditTitle={setRenamingPage}
                          onEditSlug={setEditingPageSlug}
                          onMove={setMovingPage}
                          onRearrange={handleRearrangePage}
                          onSetVisibilityOverride={handlePageVisibilityOverride}
                          onDuplicate={handleDuplicatePage}
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
                          pages={treeVisiblePages}
                          selectedPageId={selectedPageId}
                          onSelectPage={handleSelectPage}
                          depth={adminSectionDepthBase}
                          activeDragType={activeDragType}
                          hierarchyMode={org?.hierarchy_mode === "flat" ? "flat" : "product"}
                          onAddPage={(sectionId) => openAddPageDialog(sectionId)}
                          onAddSubSection={openAddSectionDialog}
                          onImportHere={(section) => openImportDialogForTarget(section)}
                          onRenameSection={setRenamingSection}
                          onMoveSection={setMovingSection}
                          onDeleteSection={handleDeleteSection}
                          onChangeSectionType={handleSectionTypeChange}
                          onSetSectionVisibility={handleSectionVisibilityChange}
                          onRenamePage={setRenamingPage}
                          onEditPageSlug={setEditingPageSlug}
                          onMovePage={setMovingPage}
                          onSetPageVisibilityOverride={handlePageVisibilityOverride}
                          onDuplicatePage={handleDuplicatePage}
                          onUnpublishPage={handleUnpublishPage}
                          onRearrangePage={handleRearrangePage}
                          onDeletePage={handleDeletePage}
                          canEditContent={canEditContent}
                          canMoveContent={canMoveContent}
                          canEditVisibilitySettings={canEditVisibilitySettings}
                          canPublishContent={canPublishContent}
                          canDeleteContent={canDeleteContent}
                          canDeleteSection={canDeleteSection}
                          canOpenImportDialog={canOpenImportDialog}
                          hideVersionSections={isProductHierarchy}
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
              {!shouldShowAdminTree && normalizedPageSearch && (
                <div className="px-2 pb-2 space-y-1">
                  {treeVisiblePages.slice(0, 8).map((page) => (
                    <button
                      key={`search-result-${page.id}`}
                      type="button"
                      onClick={() => handleSelectPage(page.id)}
                      className={cn(
                        "w-full text-left text-[11px] rounded-md border px-2 py-1.5 truncate transition-colors",
                        selectedPageId === page.id
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "hover:bg-accent/60 border-border text-muted-foreground",
                      )}
                      title={page.title}
                    >
                      {page.title}
                    </button>
                  ))}
                  {treeVisiblePages.length > 8 && (
                    <p className="px-1 text-[10px] text-muted-foreground/70">
                      Showing first 8 matches.
                    </p>
                  )}
                </div>
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
                      disabled={!driveConnected || !canOpenImportDialog}
                      className="flex items-center w-full gap-2 px-2 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <FolderOpen className="h-3.5 w-3.5 opacity-60" />
                      Import content
                    </button>
                    <button
                      disabled={!driveConnected || !canSyncContent || syncAll.isPending}
                      onClick={handleSyncAllPages}
                      className="flex items-center w-full gap-2 px-2 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {syncAll.isPending
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin opacity-60" />
                        : <RefreshCw className="h-3.5 w-3.5 opacity-60" />
                      }
                      Sync all pages
                    </button>
                    {driveConnected && driveStatus && !driveStatus.has_write_access && (
                      <div className="mx-1 mt-1 rounded-md border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 px-2 py-1.5">
                        <p className="text-[11px] text-amber-700 dark:text-amber-400">
                          Drive has read-only access. Reconnect to enable create/delete/move.
                        </p>
                      </div>
                    )}
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
                      disabled={!org?.id || !canInviteMembers}
                      className="flex items-center w-full gap-2 px-2 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <UserPlus className="h-3.5 w-3.5 opacity-60" />
                      Invite members
                    </button>
                    <button
                      onClick={() => setShowExternalAccessPanel(true)}
                      disabled={!org?.id || !canManageExternalAccess}
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
      <main className="flex-1 overflow-hidden flex flex-col min-w-0 bg-gradient-to-b from-background to-background/90">
        {dashboardPaneMode === "agent" ? (
          <AgentChatPanel
            onPageCreated={(pageId) => {
              handleSelectPage(pageId);
              setDashboardPaneMode("content");
            }}
            isMobile={isMobile}
            onOpenSidebar={() => setMobileSidebarOpen(true)}
          />
        ) : dashboardPaneMode === "developer" ? (
          org ? (
            <APISettingsPanel
              organizationId={String(org.id)}
              orgSlug={org.slug || org.domain || null}
              onBack={() => setDashboardPaneMode("content")}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )
        ) : dashboardPaneMode === "approvals" ? (
          <ApprovalsPanel
            userRole={currentUserRole}
            onClose={() => setDashboardPaneMode("content")}
            onOpenDocument={(docId) => {
              const parsed = Number(docId);
              if (!Number.isFinite(parsed)) return;
              handleSelectPage(parsed);
              setDashboardPaneMode("content");
            }}
            onCountChange={setPendingReviewCount}
            isMobile={isMobile}
            onOpenSidebar={() => setMobileSidebarOpen(true)}
          />
        ) : dashboardPaneMode === "analytics" ? (
          <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-6 sm:py-8">
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="rounded-2xl border border-border/70 bg-white/70 dark:bg-background/70 shadow-sm px-4 sm:px-5 py-4 backdrop-blur">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      {isMobile && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => setMobileSidebarOpen(true)}
                        >
                          <Menu className="h-4 w-4" />
                        </Button>
                      )}
                      <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">Workspace analytics</p>
                    </div>
                    <h2 className="text-lg font-semibold mt-1">Documentation impact for {org?.name ?? "your workspace"}</h2>
                    <p className="text-sm text-muted-foreground mt-1">Track coverage, freshness, and publishing momentum in one place.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => setDashboardPaneMode("content")}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Back to content
                  </Button>
                </div>
              </div>
              <DocumentationImpactPanel
                snapshot={analyticsSnapshot}
                onOpenPage={(pageId) => {
                  handleSelectPage(pageId);
                }}
              />
              <FeedbackInsightsPanel
                data={engagementOverview}
                loading={engagementOverviewLoading}
                onOpenPage={(pageId) => {
                  handleSelectPage(pageId);
                }}
              />
            </div>
          </div>
        ) : selectedPage ? (
          <>
            {/* Toolbar */}
            <header className="flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-2.5 border-b border-border/70 shrink-0 bg-white/70 dark:bg-background/70 backdrop-blur">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setMobileSidebarOpen(true)}
                >
                  <Menu className="h-4 w-4" />
                </Button>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="font-semibold text-sm truncate leading-snug">{selectedPage.title}</h1>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] px-1.5 py-0 h-[18px] font-semibold rounded",
                      selectedPage.status === "published"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/10"
                        : selectedPage.status === "review"
                          ? "bg-amber-500/10 text-amber-700 border-amber-200 hover:bg-amber-500/10"
                          : selectedPage.status === "rejected"
                            ? "bg-rose-500/10 text-rose-700 border-rose-200 hover:bg-rose-500/10"
                            : selectedPage.is_published
                              ? "bg-amber-500/10 text-amber-600 border-amber-200 hover:bg-amber-500/10"
                              : "bg-muted text-muted-foreground"
                    )}
                  >
                    {selectedPage.status === "published"
                      ? "Published"
                      : selectedPage.status === "review"
                        ? "In review"
                        : selectedPage.status === "rejected"
                          ? "Changes requested"
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

              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                {selectedPage.is_published && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1.5 text-muted-foreground hidden sm:inline-flex"
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
                    className="h-7 text-xs gap-1.5 text-muted-foreground hidden sm:inline-flex"
                    onClick={() => void copyPublishedLink()}
                  >
                    <Copy className="h-3 w-3" /> Copy link
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1.5 text-muted-foreground"
                  disabled={!canSyncContent || syncPage.isPending}
                  onClick={() => handleSyncCurrentPage(selectedPage.id)}
                >
                  {syncPage.isPending
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <RefreshCw className="h-3 w-3" />
                  }
                  <span className="hidden sm:inline">Sync</span>
                </Button>

                {selectedPage.is_published && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={!canPublishContent || unpublishPage.isPending}
                    onClick={() => handleUnpublishPage(selectedPage)}
                  >
                    Unpublish
                  </Button>
                )}
                {selectedPage.status === "review" && canReviewContent && !isSelectedPageOwnSubmission && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      disabled={rejectPage.isPending}
                      onClick={() => handleRejectCurrentPage(selectedPage)}
                    >
                      {rejectPage.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                      <span className="hidden sm:inline">Reject</span>
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      disabled={approvePage.isPending}
                      onClick={() => handleApproveCurrentPage(selectedPage)}
                    >
                      {approvePage.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      <span className="hidden sm:inline">Approve</span>
                    </Button>
                  </>
                )}
                {selectedPage.status === "review" && canReviewContent && isSelectedPageOwnSubmission && (
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    You cannot review your own submission
                  </span>
                )}
                {selectedPage.status === "draft" && (
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    disabled={!canPublishContent || submitPageForReview.isPending || !selectedPage.html_content || !selectedPage.section_id}
                    onClick={() => handleSubmitCurrentPageForReview(selectedPage)}
                  >
                    {submitPageForReview.isPending
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <ArrowUpFromLine className="h-3 w-3" />
                    }
                    <span className="hidden sm:inline">Submit for review</span>
                  </Button>
                )}
                {selectedPage.status === "draft" && !selectedPage.section_id && (
                  <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 hidden sm:inline">
                    Move page into a section to submit for review
                  </span>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!canEditContent}>
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => void openGoogleDocWithAcl(selectedPage.google_doc_id)}
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-2 opacity-60" /> Open in Google Docs
                    </DropdownMenuItem>
                    {selectedPage.is_published && selectedPagePublishedUrl && (
                      <DropdownMenuItem onClick={() => void copyPublishedLink()}>
                        <Copy className="h-3.5 w-3.5 mr-2 opacity-60" /> Copy published link
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setRenamingPage(selectedPage)} disabled={!canEditContent}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Title
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditingPageSlug(selectedPage)} disabled={!canEditContent}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Edit URL slug
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPageSettingsPage(selectedPage)} disabled={!canEditContent}>
                      <Settings className="h-3.5 w-3.5 mr-2" /> Page settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setInlineAssistOpen(true)}>
                      <Wand2 className="h-3.5 w-3.5 mr-2" /> AI Assist
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setMovingPage(selectedPage)} disabled={!canMoveContent}>
                      <ArrowRightLeft className="h-3.5 w-3.5 mr-2" /> Move
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleRearrangePage(selectedPage)} disabled={!canMoveContent}>
                      <ListOrdered className="h-3.5 w-3.5 mr-2" /> Re-arrange
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handlePageVisibilityOverride(selectedPage, null)}
                      disabled={!canEditVisibilitySettings}
                    >
                      {(selectedPage.visibility_override ?? null) === null ? "✓ " : ""}Use section visibility
                    </DropdownMenuItem>
                    {visibilityOptions.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => handlePageVisibilityOverride(selectedPage, opt.value)}
                        disabled={!canEditVisibilitySettings}
                      >
                        {(selectedPage.visibility_override ?? null) === opt.value ? "✓ " : ""}{opt.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleDuplicatePage(selectedPage)} disabled={!canCreateContent}>
                      <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canPublishContent || !selectedPage.is_published}
                      className={cn(!selectedPage.is_published && "opacity-50")}
                      onClick={() => handleUnpublishPage(selectedPage)}
                    >
                      <Circle className="h-2.5 w-2.5 mr-2 fill-red-500 text-red-500" /> Unpublish
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      disabled={!canDeleteContent}
                      onClick={() => handleDeletePage(selectedPage)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete page
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            {selectedProduct && productTabs.length > 0 && (
              <div className="border-b px-3 sm:px-6 py-2 bg-background">
                <div className="flex items-center gap-1 overflow-x-auto">
                  {productTabs.map((tab) => {
                    const isActive = selectedTab?.id === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          const firstPage = findFirstPageInSection(tab.id);
                          if (firstPage) {
                            handleSelectPage(firstPage.id);
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
            <div className="flex-1 min-h-0 flex relative">
              {/* Mobile hierarchy overlay backdrop */}
              {isMobile && mobileHierarchyOpen && (
                <div
                  className="absolute inset-0 z-20 bg-black/30"
                  onClick={() => setMobileHierarchyOpen(false)}
                />
              )}
              {/* Mobile hierarchy toggle */}
              {isMobile && !mobileHierarchyOpen && (
                <button
                  type="button"
                  onClick={() => setMobileHierarchyOpen(true)}
                  className="absolute top-2 left-2 z-10 h-8 w-8 rounded-md border bg-background shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground"
                  title="Show page hierarchy"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              )}
              <div className={cn(
                "h-full min-h-0",
                // On mobile: absolute overlay panel
                isMobile
                  ? cn(
                      "absolute inset-y-0 left-0 z-30 bg-background shadow-xl transition-transform duration-200",
                      mobileHierarchyOpen ? "translate-x-0" : "-translate-x-full",
                    )
                  : "",
              )}>
                <ReaderHierarchy
                  title={readerHierarchyTitle}
                  pages={treeVisiblePages}
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
                  visibilityFilter={visibilityFilter}
                  onVisibilityFilterChange={setVisibilityFilter}
                  pageSearchQuery={pageSearchQuery}
                  onPageSearchChange={setPageSearchQuery}
                  selectedPageId={selectedPageId}
                  onSelectPage={handleSelectPage}
                  onAddPage={(sectionId) => openAddPageDialog(sectionId)}
                  onAddSubSection={openAddSectionDialog}
                  onImportHere={(section) => openImportDialogForTarget(section)}
                  onRenameSection={setRenamingSection}
                  onMoveSection={setMovingSection}
                  onDeleteSection={handleDeleteSection}
                  onChangeSectionType={handleSectionTypeChange}
                  onSetSectionVisibility={handleSectionVisibilityChange}
                  onRenamePage={setRenamingPage}
                  onEditPageSlug={setEditingPageSlug}
                  onMovePage={setMovingPage}
                  onSetPageVisibilityOverride={handlePageVisibilityOverride}
                  onDuplicatePage={handleDuplicatePage}
                  onUnpublishPage={handleUnpublishPage}
                  onRearrangePage={handleRearrangePage}
                  onDeletePage={handleDeletePage}
                  canEditContent={canEditContent}
                  canMoveContent={canMoveContent}
                  canEditVisibilitySettings={canEditVisibilitySettings}
                  canPublishContent={canPublishContent}
                  canDeleteContent={canDeleteContent}
                  canDeleteSection={canDeleteSection}
                  canOpenImportDialog={canOpenImportDialog}
                  hideVersionSections={isProductHierarchy}
                />
              </div>
              <div className="flex-1 min-w-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_16rem]">
                <div className="dashboard-doc-scroll overflow-y-auto">
                  {selectedPage.html_content ? (
                    <div
                      className="dashboard-doc-content prose prose-sm prose-neutral max-w-4xl mx-auto px-4 py-6 sm:px-8 sm:py-10 xl:px-10"
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
                        disabled={!canSyncContent || syncPage.isPending}
                        onClick={() => handleSyncCurrentPage(selectedPage.id)}
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
                  <div className="sticky top-0 h-[calc(100vh-108px)] overflow-y-auto p-4 space-y-6">
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
          <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-6 sm:py-8">
            {isMobile && (
              <div className="mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => setMobileSidebarOpen(true)}
                >
                  <Menu className="h-3.5 w-3.5" />
                  Menu
                </Button>
              </div>
            )}
            <div className="max-w-5xl mx-auto space-y-6">
              {!hasWorkspaceContent && (
                <div className="flex flex-col items-center gap-5">
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={() => openImportDialogForTarget(null)}
                      disabled={!canOpenImportDialog}
                    >
                      <FolderOpen className="h-3.5 w-3.5" /> Import content
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={openConfigureHierarchyDialog}
                      disabled={!canConfigureHierarchy}
                    >
                      <Settings className="h-3.5 w-3.5" /> Tabs (optional)
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={() => openAddPageDialog(defaultAddPageSectionId)}
                      disabled={!canCreateContent}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add page
                    </Button>
                  </div>
                </div>
              )}

              <DocumentationImpactPanel
                snapshot={analyticsSnapshot}
                onOpenPage={(pageId) => {
                  handleSelectPage(pageId);
                }}
              />
            </div>
          </div>
        )}
      </main>

      {showAddPage && canCreateContent && <AddPageDialog sectionId={addPageSectionId} onClose={() => setShowAddPage(false)} />}
      {showAddSection && canManageStructure && (
        <AddSectionDialog
          parentId={addSectionParentId}
          allSections={sections}
          hierarchyMode={org?.hierarchy_mode === "flat" ? "flat" : "product"}
          preferredType={addSectionPreferredType}
          cloneFromSectionId={addSectionCloneFromId}
          titleOverride={addSectionDialogTitle}
          hideTypePicker={addSectionHideTypePicker}
          allowDestinationPicker={addSectionAllowDestinationPicker}
          onCreated={handleSectionCreated}
          onClose={() => {
            setShowAddSection(false);
            setAddSectionParentId(null);
            setAddSectionPreferredType(undefined);
            setAddSectionCloneFromId(null);
            setAddSectionDialogTitle(undefined);
            setAddSectionHideTypePicker(false);
            setAddSectionAllowDestinationPicker(false);
          }}
        />
      )}
      {showScanDrive && (
        <ScanDriveDialog
          onClose={() => { setShowScanDrive(false); setScanTarget(null); }}
          onSuccess={() => {
            if (!scanTarget && canConfigureHierarchy) setShowConfigureTabs(true);
          }}
          rootFolderId={org?.drive_folder_id ?? driveStatus?.drive_folder_id ?? null}
          driveConnected={driveConnected}
          canManageDrive={canManageDrive}
          target={scanTarget}
          allSections={sections}
        />
      )}
      {showConfigureTabs && canConfigureHierarchy && (
        <ConfigureTabsDialog
          sections={sections}
          hierarchyMode={org?.hierarchy_mode === "flat" ? "flat" : "product"}
          onClose={() => setShowConfigureTabs(false)}
        />
      )}
      {showExternalAccessPanel && org?.id && canManageExternalAccess && (
        <ProjectSharePanel
          open={showExternalAccessPanel}
          onOpenChange={setShowExternalAccessPanel}
          projectId={String(selectedProduct?.id ?? org.id)}
          projectName={selectedProduct?.name ?? org.name}
          organizationSlug={org.slug ?? null}
          projectSlug={selectedProduct?.slug ?? null}
          canManageAccess={canManageExternalAccess}
        />
      )}
      {showInviteMember && org && canInviteMembers && (
        <InviteMemberDialog
          open={showInviteMember}
          onOpenChange={setShowInviteMember}
          organizationName={org.name}
          organizationDomain={org.domain}
          currentUserRole={org.user_role}
          currentUserEmail={user?.email ?? null}
        />
      )}
      {showWorkspaceSettings && org && canManageWorkspace && (
        <WorkspaceSettingsDialog
          org={org}
          onClose={() => setShowWorkspaceSettings(false)}
        />
      )}
      {renamingSection && canEditContent && (
        <RenameDialog
          label="section"
          initialValue={renamingSection.name}
          onSave={(name) => updateSection.mutate({ id: renamingSection.id, name })}
          onClose={() => setRenamingSection(null)}
        />
      )}
      {renamingPage && canEditContent && (
        <RenameDialog
          label="page title"
          initialValue={renamingPage.title}
          onSave={(title) => updatePage.mutate({ id: renamingPage.id, title })}
          onClose={() => setRenamingPage(null)}
        />
      )}
      {editingPageSlug && canEditContent && (
        <RenameDialog
          label="URL slug"
          initialValue={editingPageSlug.slug}
          onSave={(slug) => updatePageSlug.mutate({ id: editingPageSlug.id, slug })}
          onClose={() => setEditingPageSlug(null)}
        />
      )}
      {movingSection && canMoveContent && (
        <MoveSectionDialog
          section={movingSection}
          allSections={sections}
          onClose={() => setMovingSection(null)}
        />
      )}
      {movingPage && canMoveContent && (
        <MovePageDialog
          page={movingPage}
          allSections={sections}
          allPages={pages}
          onClose={() => setMovingPage(null)}
        />
      )}
      {pageSettingsPage && canEditContent && (
        <PageSettingsDialog
          page={pageSettingsPage}
          onClose={() => setPageSettingsPage(null)}
        />
      )}
      <InlineAssistDialog
        open={inlineAssistOpen}
        onClose={() => setInlineAssistOpen(false)}
      />
    </div>
  );
}
