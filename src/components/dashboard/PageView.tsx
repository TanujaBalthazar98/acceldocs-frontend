import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Share2,
  MoreHorizontal,
  Clock,
  User,
  Circle,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Archive,
  RefreshCw,
  Lock,
  Eye,
  Globe,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SharePanel } from "./SharePanel";
import { invokeFunction } from "@/lib/api/functions";
import { getById } from "@/lib/api/queries";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ensureFreshSession } from "@/lib/authSession";
import { normalizeHtml } from "@/lib/htmlNormalizer";
import { isLikelyMarkdown, renderMarkdownToHtml, stripFirstMarkdownHeading } from "@/lib/markdown";
import { VideoEmbed } from "@/components/docs/VideoEmbed";

type VisibilityLevel = "internal" | "external" | "public";
const GOOGLE_TOKEN_KEY = "google_access_token";

type DocStatus = "draft" | "review" | "approved" | "rejected";

interface DocumentData {
  id: string;
  title: string;
  google_doc_id: string;
  project_id: string;
  topic_id: string | null;
  google_modified_at: string | null;
  created_at: string;
  visibility: VisibilityLevel;
  status?: DocStatus;
  is_published: boolean;
  owner_id: string | null;
  owner_name?: string;
  content_html: string | null;
  published_content_html: string | null;
  content_id: string | null;
  published_content_id: string | null;
  video_url?: string | null;
  video_title?: string | null;
}

const statusConfig: Record<DocStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "text-slate-500", bg: "bg-slate-100" },
  review: { label: "In Review", color: "text-amber-600", bg: "bg-amber-50" },
  approved: { label: "Approved", color: "text-green-600", bg: "bg-green-50" },
  rejected: { label: "Changes Requested", color: "text-red-600", bg: "bg-red-50" },
};

interface PageViewProps {
  document: DocumentData;
  onBack: () => void;
  onDocumentUpdate?: () => void;
  userRole?: string; // owner | admin | editor | reviewer | viewer
}

const visibilityConfig: Record<VisibilityLevel, { icon: typeof Lock; label: string; color: string }> = {
  internal: { icon: Lock, label: "Internal", color: "text-muted-foreground" },
  external: { icon: Eye, label: "External", color: "text-blue-400" },
  public: { icon: Globe, label: "Public", color: "text-green-400" },
};

export const PageView = ({ document, onBack, onDocumentUpdate, userRole }: PageViewProps) => {
  const [shareOpen, setShareOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isStatusChanging, setIsStatusChanging] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [docStatus, setDocStatus] = useState<DocStatus>(document.status || "draft");
  const [videoUrl, setVideoUrl] = useState<string | null>(document.video_url ?? null);
  const [videoTitle, setVideoTitle] = useState<string | null>(document.video_title ?? null);
  // Use content_html or fall back to published_content_html
  const [contentHtml, setContentHtml] = useState<string | null>(
    document.content_html || document.published_content_html
  );
  const { toast } = useToast();
  const { googleAccessToken } = useAuth();

  const getGoogleToken = () => googleAccessToken || localStorage.getItem(GOOGLE_TOKEN_KEY);

  // Update content when document changes or fetch from DB if missing
  useEffect(() => {
    const initialContent = document.content_html || document.published_content_html;
    if (initialContent) {
      setContentHtml(initialContent);
    } else {
      // Content not loaded - fetch it from the database
      fetchContentFromDB();
    }
    fetchContentFromCache();
    setVideoUrl(document.video_url ?? null);
    setVideoTitle(document.video_title ?? null);
  }, [document.id, document.content_html, document.published_content_html, document.video_url, document.video_title]);

  const fetchContentFromCache = async () => {
    setIsLoadingContent(true);
    try {
      const session = await ensureFreshSession();
      const accessToken = session?.access_token;
      if (!accessToken) return;
      const { data, error } = await invokeFunction("document-cache", {
        body: { action: "get", documentId: document.id },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error || !(data?.ok ?? data?.success)) return;
      if (data?.contentHtml) setContentHtml(data.contentHtml);
    } catch (error) {
      console.error("Error fetching cached content:", error);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const fetchContentFromDB = async () => {
    setIsLoadingContent(true);
    try {
      const { data, error } = await getById("documents", document.id, {
        select: "content_html,published_content_html,content_id,published_content_id,video_url,video_title",
      });
      if (error) throw error;
      const row = (data as any)?.attributes ? { id: (data as any).id, ...(data as any).attributes } : data;
      if (row) {
        const content = row.content_html || row.published_content_html || null;
        if (content) setContentHtml(content);
        setVideoUrl(row.video_url ?? null);
        setVideoTitle(row.video_title ?? null);
      }
    } catch (error) {
      console.error("Error fetching document content:", error);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleSyncContent = async () => {
    setIsSyncing(true);
    try {
      // Proactively refresh session to prevent premature timeouts (rate-limited)
      const session = await ensureFreshSession();
      if (!session) {
        toast({
          title: "Session expired",
          description: "Please sign in again.",
          variant: "destructive",
        });
        return;
      }

      const token = getGoogleToken();
      const { data, error } = await invokeFunction("google-drive", {
        body: {
          action: "sync_doc_content",
          documentId: document.id,
          googleDocId: document.google_doc_id,
        },
        ...(token ? { headers: { "x-google-token": token } } : {}),
      });

      if (error) throw error;

      if (data?.needsReauth) {
        toast({
          title: "Drive access required",
          description: "Please reconnect Google Drive.",
          variant: "destructive",
        });
        return;
      }

      if (data?.html) {
        setContentHtml(data.html);
        toast({
          title: "Content synced",
          description: "Document content has been updated.",
        });
        onDocumentUpdate?.();
      }
    } catch (error: any) {
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync content.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const canReview = userRole === "owner" || userRole === "admin" || userRole === "reviewer";
  const canEdit = userRole === "owner" || userRole === "admin" || userRole === "editor";

  const changeStatus = async (newStatus: DocStatus) => {
    setIsStatusChanging(true);
    try {
      const { error } = await invokeFunction("update-document", {
        body: { id: document.id, status: newStatus, is_published: newStatus === "approved" },
      });
      if (error) throw error;
      setDocStatus(newStatus);
      toast({
        title: newStatus === "review" ? "Submitted for review" :
               newStatus === "approved" ? "Document approved" :
               newStatus === "rejected" ? "Changes requested" : "Status updated",
      });
      onDocumentUpdate?.();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to update status", variant: "destructive" });
    } finally {
      setIsStatusChanging(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const VisibilityIcon = visibilityConfig[document.visibility]?.icon || Lock;

  return (
    <>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="min-h-14 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-6 py-2 sm:py-0 gap-2 shrink-0">
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-1.5 sm:gap-2 text-muted-foreground hover:text-foreground px-2 sm:px-3"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden xs:inline">Back</span>
            </Button>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <div className="flex items-center gap-2">
              <Circle
                className={`w-2 h-2 ${document.is_published ? 'bg-green-500' : 'bg-amber-500'} rounded-full`}
              />
              <span className="text-xs sm:text-sm text-muted-foreground">
                {document.is_published ? 'Published' : 'Draft'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-end flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 px-2 sm:px-3 text-xs sm:text-sm"
              onClick={handleSyncContent}
              disabled={isSyncing}
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 px-2 sm:px-3 text-xs sm:text-sm"
              onClick={() => setShareOpen(true)}
            >
              <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 px-2 sm:px-3 text-xs sm:text-sm"
              onClick={() => window.open(`https://docs.google.com/document/d/${document.google_doc_id}/edit`, "_blank")}
            >
              <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden md:inline">Open in Drive</span>
            </Button>
            {/* Status badge */}
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusConfig[docStatus]?.bg} ${statusConfig[docStatus]?.color}`}>
              {statusConfig[docStatus]?.label || "Draft"}
            </span>

            {/* Workflow actions */}
            {docStatus === "draft" && canEdit && (
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 text-xs sm:text-sm"
                disabled={isStatusChanging}
                onClick={() => changeStatus("review")}
              >
                {isStatusChanging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Submit for Review
              </Button>
            )}
            {docStatus === "rejected" && canEdit && (
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 text-xs sm:text-sm"
                disabled={isStatusChanging}
                onClick={() => changeStatus("review")}
              >
                {isStatusChanging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Resubmit for Review
              </Button>
            )}
            {docStatus === "review" && canReview && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5 text-xs sm:text-sm bg-green-600 hover:bg-green-700"
                  disabled={isStatusChanging}
                  onClick={() => changeStatus("approved")}
                >
                  {isStatusChanging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs sm:text-sm text-red-600 border-red-200 hover:bg-red-50"
                  disabled={isStatusChanging}
                  onClick={() => changeStatus("rejected")}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Request Changes
                </Button>
              </>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="gap-2">
                  <User className="w-4 h-4" />
                  Change Owner
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2">
                  <Archive className="w-4 h-4" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-destructive">
                  <Trash2 className="w-4 h-4" />
                  Remove from Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {/* Page Meta */}
            <div className="mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 sm:mb-4">
                {document.title}
              </h1>

              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                {document.owner_name && (
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Owner: {document.owner_name}</span>
                  </div>
                )}
                {document.google_modified_at && (
                  <>
                    <div className="h-4 w-px bg-border hidden sm:block" />
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span>Modified: {formatDate(document.google_modified_at)}</span>
                    </div>
                  </>
                )}
                <div className="h-4 w-px bg-border hidden sm:block" />
                <div className="flex items-center gap-1">
                  <VisibilityIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${visibilityConfig[document.visibility]?.color}`} />
                  <span className={visibilityConfig[document.visibility]?.color}>
                    {visibilityConfig[document.visibility]?.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Document Content */}
            <article className="prose prose-sm sm:prose-base prose-neutral dark:prose-invert prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-code:text-primary prose-pre:bg-secondary prose-pre:border prose-pre:border-border prose-a:text-primary prose-blockquote:border-primary prose-blockquote:text-muted-foreground prose-th:text-foreground prose-td:text-foreground/90 max-w-none overflow-x-hidden">
              {videoUrl && (
                <div className="mb-6 not-prose">
                  <VideoEmbed url={videoUrl} title={videoTitle || document.title} />
                </div>
              )}
              <div className="rounded-xl border border-border bg-card/50 overflow-x-auto">
                {isLoadingContent ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50 animate-spin" />
                    <p className="text-muted-foreground">Loading content...</p>
                  </div>
                ) : contentHtml ? (
                  <div className="p-4 sm:p-6 lg:p-8">
                    <div
                      className="google-doc-content"
                      dangerouslySetInnerHTML={{
                        __html: isLikelyMarkdown(contentHtml)
                          ? normalizeHtml(
                              renderMarkdownToHtml(
                                stripFirstMarkdownHeading(contentHtml, document.title)
                              )
                            )
                          : normalizeHtml(contentHtml),
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-muted-foreground mb-4">No content synced yet.</p>
                    <Button onClick={handleSyncContent} disabled={isSyncing}>
                      {isSyncing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Sync from Google Drive
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </article>
          </div>
        </div>
      </div>

      <SharePanel
        open={shareOpen}
        onOpenChange={setShareOpen}
        pageTitle={document.title}
      />
    </>
  );
};
