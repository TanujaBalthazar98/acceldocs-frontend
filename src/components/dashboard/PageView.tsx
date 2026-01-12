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
  Edit3,
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import DOMPurify from "dompurify";

type VisibilityLevel = "internal" | "external" | "public";

interface DocumentData {
  id: string;
  title: string;
  google_doc_id: string;
  project_id: string;
  topic_id: string | null;
  google_modified_at: string | null;
  created_at: string;
  visibility: VisibilityLevel;
  is_published: boolean;
  owner_id: string | null;
  owner_name?: string;
  content_html: string | null;
  published_content_html: string | null;
}

interface PageViewProps {
  document: DocumentData;
  onBack: () => void;
  onDocumentUpdate?: () => void;
}

const visibilityConfig: Record<VisibilityLevel, { icon: typeof Lock; label: string; color: string }> = {
  internal: { icon: Lock, label: "Internal", color: "text-muted-foreground" },
  external: { icon: Eye, label: "External", color: "text-blue-400" },
  public: { icon: Globe, label: "Public", color: "text-green-400" },
};

export const PageView = ({ document, onBack, onDocumentUpdate }: PageViewProps) => {
  const [shareOpen, setShareOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  // Use content_html or fall back to published_content_html
  const [contentHtml, setContentHtml] = useState<string | null>(
    document.content_html || document.published_content_html
  );
  const { toast } = useToast();

  // Update content when document changes or fetch from DB if missing
  useEffect(() => {
    const initialContent = document.content_html || document.published_content_html;
    if (initialContent) {
      setContentHtml(initialContent);
    } else {
      // Content not loaded - fetch it from the database
      fetchContentFromDB();
    }
  }, [document.id, document.content_html, document.published_content_html]);

  const fetchContentFromDB = async () => {
    setIsLoadingContent(true);
    try {
      const { data } = await supabase
        .from("documents")
        .select("content_html, published_content_html")
        .eq("id", document.id)
        .single();
      
      if (data) {
        const content = data.content_html || data.published_content_html;
        if (content) {
          setContentHtml(content);
        }
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Session expired",
          description: "Please sign in again.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("google-drive", {
        body: {
          action: "sync_doc_content",
          documentId: document.id,
          googleDocId: document.google_doc_id,
        },
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
        <header className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Circle
                className={`w-2 h-2 ${document.is_published ? 'bg-green-500' : 'bg-amber-500'} rounded-full`}
              />
              <span className="text-sm text-muted-foreground">
                {document.is_published ? 'Published' : 'Draft'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleSyncContent}
              disabled={isSyncing}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShareOpen(true)}
            >
              <Share2 className="w-4 h-4" />
              Share
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => window.open(`https://docs.google.com/document/d/${document.google_doc_id}/edit`, "_blank")}
            >
              <ExternalLink className="w-4 h-4" />
              Open in Drive
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Mark as Verified
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2">
                  <Edit3 className="w-4 h-4" />
                  Change State
                </DropdownMenuItem>
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
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-8 py-8">
            {/* Page Meta */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-4">
                {document.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {document.owner_name && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>Owner: {document.owner_name}</span>
                  </div>
                )}
                {document.google_modified_at && (
                  <>
                    <div className="h-4 w-px bg-border" />
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>Modified: {formatDate(document.google_modified_at)}</span>
                    </div>
                  </>
                )}
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-1">
                  <VisibilityIcon className={`w-4 h-4 ${visibilityConfig[document.visibility]?.color}`} />
                  <span className={visibilityConfig[document.visibility]?.color}>
                    {visibilityConfig[document.visibility]?.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Document Content */}
            <article className="prose prose-invert prose-headings:text-foreground prose-p:text-secondary-foreground prose-strong:text-foreground prose-code:text-primary prose-pre:bg-secondary prose-pre:border prose-pre:border-border prose-a:text-primary prose-blockquote:border-primary prose-blockquote:text-muted-foreground prose-th:text-foreground prose-td:text-secondary-foreground max-w-none">
              <div className="rounded-xl border border-border bg-card/50 p-8">
                {isLoadingContent ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50 animate-spin" />
                    <p className="text-muted-foreground">Loading content...</p>
                  </div>
                ) : contentHtml ? (
                  <div
                    className="google-doc-content"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(contentHtml, {
                        ADD_TAGS: ["style"],
                        ADD_ATTR: ["target", "rel"],
                      }),
                    }}
                  />
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
