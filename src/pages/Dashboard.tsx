/**
 * AccelDocs Dashboard — clean architecture rebuild.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuthNew";
import { useToast } from "@/hooks/use-toast";

import { orgApi, sectionsApi, pagesApi, driveApi, buildSectionTree } from "@/api";
import type { Section, Page } from "@/api/types";

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
import {
  BookOpen,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  FileText,
  FolderOpen,
  Globe,
  Loader2,
  LogOut,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  ArrowUpFromLine,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/api/client";

// ---------------------------------------------------------------------------
// AddPageDialog
// ---------------------------------------------------------------------------

function AddPageDialog({ sectionId, onClose }: { sectionId: number | null; onClose: () => void }) {
  const [docId, setDocId] = useState("");
  const [title, setTitle] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: () =>
      pagesApi.create({ google_doc_id: docId.trim(), section_id: sectionId, title: title.trim() || undefined }),
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
          <DialogTitle className="text-base">Add page from Google Docs</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Google Doc ID or URL</Label>
            <Input
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              autoFocus
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              From the URL: docs.google.com/document/d/<span className="font-semibold text-foreground/70">ID</span>/edit
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Custom title</Label>
            <Input
              placeholder="Leave blank to use the Google Doc title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!docId.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Add page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// ScanDriveDialog
// ---------------------------------------------------------------------------

function ScanDriveDialog({ onClose }: { onClose: () => void }) {
  const [folderId, setFolderId] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const scan = useMutation({
    mutationFn: () => driveApi.scan(folderId.trim()),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["sections"] });
      qc.invalidateQueries({ queryKey: ["pages"] });
      toast({
        title: "Import complete",
        description: `${result.sections_created} sections and ${result.pages_created} pages from "${result.folder_name}"`,
      });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Import from Google Drive</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Folder ID</Label>
            <Input
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              autoFocus
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              From: drive.google.com/drive/folders/<span className="font-semibold text-foreground/70">ID</span>
            </p>
          </div>
          <div className="rounded-lg bg-muted/60 border px-4 py-3 text-xs text-muted-foreground leading-relaxed">
            Sub-folders become sections. Google Docs become pages. Content is pulled when you sync.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!folderId.trim() || scan.isPending} onClick={() => scan.mutate()}>
            {scan.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              : <FolderOpen className="h-3.5 w-3.5 mr-1.5" />}
            Import folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// SectionNode (sidebar)
// ---------------------------------------------------------------------------

function SectionNode({
  section, pages, selectedPageId, onSelectPage, depth,
}: {
  section: Section;
  pages: Page[];
  selectedPageId: number | null;
  onSelectPage: (id: number) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(true);
  const sectionPages = pages.filter((p) => p.section_id === section.id);

  return (
    <div className={cn(depth > 0 && "ml-3 border-l border-border/50")}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center w-full gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors",
          depth > 0 ? "px-2" : "px-2",
          "text-muted-foreground/70 hover:text-foreground hover:bg-accent/50",
          "tracking-wide uppercase"
        )}
      >
        {open
          ? <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          : <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
        }
        <span className="truncate">{section.name}</span>
        {section.is_published && <Globe className="h-2.5 w-2.5 ml-auto shrink-0 text-emerald-500" />}
      </button>

      {open && (
        <>
          {sectionPages.map((page) => (
            <button
              key={page.id}
              onClick={() => onSelectPage(page.id)}
              className={cn(
                "flex items-center w-full gap-2 py-1.5 pl-6 pr-2 rounded-md text-sm transition-all",
                selectedPageId === page.id
                  ? "bg-primary/8 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
              )}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <span className="truncate flex-1 text-left leading-snug">{page.title}</span>
              {page.is_published && <Globe className="h-2.5 w-2.5 shrink-0 text-emerald-500 opacity-70" />}
            </button>
          ))}
          {(section.children ?? []).map((child) => (
            <SectionNode
              key={child.id}
              section={child}
              pages={pages}
              selectedPageId={selectedPageId}
              onSelectPage={onSelectPage}
              depth={depth + 1}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [showAddPage, setShowAddPage] = useState(false);
  const [addPageSectionId, setAddPageSectionId] = useState<number | null>(null);
  const [showScanDrive, setShowScanDrive] = useState(false);

  const { data: org, isLoading: orgLoading } = useQuery({ queryKey: ["org"], queryFn: orgApi.get });
  const { data: sectionsData } = useQuery({ queryKey: ["sections"], queryFn: sectionsApi.list, enabled: !!org });
  const { data: pagesData } = useQuery({ queryKey: ["pages"], queryFn: () => pagesApi.list(), enabled: !!org });
  const { data: driveStatus } = useQuery({ queryKey: ["drive-status"], queryFn: driveApi.status, enabled: !!org });
  const { data: selectedPageFull } = useQuery({
    queryKey: ["page", selectedPageId],
    queryFn: () => pagesApi.get(selectedPageId!),
    enabled: selectedPageId !== null,
  });

  const sections = sectionsData?.sections ?? [];
  const pages = pagesData?.pages ?? [];
  const sectionTree = buildSectionTree(sections);
  const selectedPage = selectedPageFull ?? (pages.find((p) => p.id === selectedPageId) ?? null);

  const syncAll = useMutation({
    mutationFn: driveApi.syncAll,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      toast({ title: `Synced ${result.synced} page(s)` });
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

  const orgSlug = org?.slug ?? String(org?.id ?? "");
  const publicDocsUrl = `${API_BASE_URL}/docs/${orgSlug}`;
  const orgInitials = org?.name?.slice(0, 2).toUpperCase() ?? "AC";

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside className="w-[248px] shrink-0 flex flex-col border-r bg-[#F9F8F6] dark:bg-muted/20 overflow-hidden">

        {/* Org header */}
        <div className="flex items-center gap-2.5 px-3 py-3 border-b bg-background">
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
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{org?.name}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => window.open(publicDocsUrl, "_blank")}>
                <Globe className="h-3.5 w-3.5 mr-2 opacity-60" /> Public docs
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="h-3.5 w-3.5 mr-2 opacity-60" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={signOut}>
                <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
              Content
            </span>
            <button
              onClick={() => { setAddPageSectionId(null); setShowAddPage(true); }}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-accent"
              title="Add page"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {sectionTree.length === 0 && pages.filter((p) => !p.section_id).length === 0 ? (
            <div className="px-2 py-4 text-center">
              <p className="text-xs text-muted-foreground/60">No content yet</p>
            </div>
          ) : (
            <>
              {pages.filter((p) => !p.section_id).map((page) => (
                <button
                  key={page.id}
                  onClick={() => setSelectedPageId(page.id)}
                  className={cn(
                    "flex items-center w-full gap-2 py-1.5 px-2 rounded-md text-sm transition-all",
                    selectedPageId === page.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                  )}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="truncate flex-1 text-left">{page.title}</span>
                  {page.is_published && <Globe className="h-2.5 w-2.5 shrink-0 text-emerald-500" />}
                </button>
              ))}
              {sectionTree.map((section) => (
                <SectionNode
                  key={section.id}
                  section={section}
                  pages={pages}
                  selectedPageId={selectedPageId}
                  onSelectPage={(id) => setSelectedPageId(id)}
                  depth={0}
                />
              ))}
            </>
          )}
        </div>

        {/* Sidebar footer */}
        <div className="border-t px-2 py-2 space-y-0.5">
          <button
            onClick={() => setShowScanDrive(true)}
            className="flex items-center w-full gap-2 px-2 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          >
            <FolderOpen className="h-3.5 w-3.5 opacity-60" />
            Import from Drive
          </button>
          <button
            disabled={syncAll.isPending}
            onClick={() => syncAll.mutate()}
            className="flex items-center w-full gap-2 px-2 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-40"
          >
            {syncAll.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin opacity-60" />
              : <RefreshCw className="h-3.5 w-3.5 opacity-60" />
            }
            Sync all pages
          </button>
          {driveStatus?.connected && (
            <div className="flex items-center gap-1.5 px-2 py-1">
              <Wifi className="h-3 w-3 text-emerald-500" />
              <span className="text-[11px] text-muted-foreground/60">Drive connected</span>
            </div>
          )}
        </div>
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
                    variant={selectedPage.is_published ? "default" : "secondary"}
                    className={cn(
                      "text-[10px] px-1.5 py-0 h-[18px] font-semibold rounded",
                      selectedPage.is_published
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/10"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {selectedPage.is_published ? "Published" : "Draft"}
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
                    onClick={() => window.open(`${publicDocsUrl}/${selectedPage.slug}`, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3" /> View live
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

                {selectedPage.is_published ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={unpublishPage.isPending}
                    onClick={() => unpublishPage.mutate(selectedPage.id)}
                  >
                    Unpublish
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    disabled={publishPage.isPending || !selectedPage.html_content}
                    onClick={() => publishPage.mutate(selectedPage.id)}
                  >
                    {publishPage.isPending
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <ArrowUpFromLine className="h-3 w-3" />
                    }
                    Publish
                  </Button>
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
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => deletePage.mutate(selectedPage.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete page
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {selectedPage.html_content ? (
                <div
                  className="prose prose-sm prose-neutral max-w-3xl mx-auto px-10 py-10"
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
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowScanDrive(true)}>
                <FolderOpen className="h-3.5 w-3.5" /> Import from Drive
              </Button>
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => { setAddPageSectionId(null); setShowAddPage(true); }}>
                <Plus className="h-3.5 w-3.5" /> Add page
              </Button>
            </div>
          </div>
        )}
      </main>

      {showAddPage && <AddPageDialog sectionId={addPageSectionId} onClose={() => setShowAddPage(false)} />}
      {showScanDrive && <ScanDriveDialog onClose={() => setShowScanDrive(false)} />}
    </div>
  );
}
