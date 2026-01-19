import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Share2, User, Calendar, Eye, Lock, Globe, RefreshCw } from "lucide-react";
import { normalizeHtml } from "@/lib/htmlNormalizer";
import { isLikelyMarkdown, renderMarkdownToHtml, stripFirstMarkdownHeading } from "@/lib/markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { ensureFreshSession } from "@/lib/authSession";
import { ProjectSharePanel } from "@/components/dashboard/ProjectSharePanel";
import { ConnectorContextActions } from "@/components/dashboard/ConnectorContextActions";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type VisibilityLevel = "internal" | "external" | "public";

interface DocumentData {
  id: string;
  title: string;
  google_doc_id: string;
  visibility: VisibilityLevel;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  content: string | null;
  content_html: string | null;
  owner_id: string | null;
  owner?: {
    id: string;
    email: string;
    full_name: string | null;
  };
  project?: {
    id: string;
    name: string;
  };
  topic?: {
    id: string;
    name: string;
  };
}

const visibilityConfig: Record<VisibilityLevel, { icon: typeof Lock; label: string; color: string }> = {
  internal: { icon: Lock, label: "Internal", color: "bg-muted text-muted-foreground" },
  external: { icon: Eye, label: "External", color: "bg-blue-500/20 text-blue-400" },
  public: { icon: Globe, label: "Public", color: "bg-green-500/20 text-green-400" },
};


export default function PagePreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, googleAccessToken, requestDriveAccess } = useAuth();
  const { getGoogleToken } = useGoogleDrive();
  const { toast } = useToast();
  
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [docContent, setDocContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [fileTooLarge, setFileTooLarge] = useState(false);

  useEffect(() => {
    if (id) {
      fetchDocument();
    }
  }, [id]);

  useEffect(() => {
    if (document?.google_doc_id) {
      fetchDocContent();
    }
  }, [document?.google_doc_id, googleAccessToken]);

  const fetchDocument = async () => {
    try {
      const { data, error } = await supabase
        .from("documents")
        .select(`
          *,
          project:projects(id, name),
          topic:topics(id, name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      // Fetch owner info if owner_id exists
      let ownerData = null;
      if (data.owner_id) {
        const { data: owner } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .eq("id", data.owner_id)
          .single();
        ownerData = owner;
      }

      setDocument({ ...data, owner: ownerData } as DocumentData);
      
      // If we have cached content_html, use it immediately as fallback
      if (data.content_html) {
        const cleanedHtml = isLikelyMarkdown(data.content_html)
          ? normalizeHtml(
              renderMarkdownToHtml(
                stripFirstMarkdownHeading(data.content_html, data.title)
              )
            )
          : normalizeHtml(data.content_html);
        setDocContent(cleanedHtml);
      }
    } catch (error) {
      console.error("Error fetching document:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocContent = async () => {
    if (!document?.google_doc_id) return;

    // Proactively refresh session to prevent premature timeouts
    try {
      await ensureFreshSession();
    } catch (e) {
      console.warn("Session refresh failed:", e);
    }

    const token = getGoogleToken();

    setLoadingContent(true);
    setNeedsReconnect(false);
    setFileTooLarge(false);
    try {
      const invokeArgs: {
        body: { action: "get_doc_content"; docId: string };
        headers?: Record<string, string>;
      } = {
        body: {
          action: "get_doc_content",
          docId: document.google_doc_id,
        },
      };

      // If we have a provider token, pass it through; otherwise the backend will try
      // to refresh using the stored refresh token (if available).
      if (token) {
        invokeArgs.headers = {
          "x-google-token": token,
        };
      }

      const { data, error } = await supabase.functions.invoke("google-drive", invokeArgs);

      if (error) {
        console.error("Error fetching doc content:", error);
        setNeedsReconnect(true);
        return;
      }
      
      // Check if file is too large - but we may have cached content
      if (data?.fileTooLarge) {
        console.log("Document too large to export from Google");
        // If we already have cached content from fetchDocument, don't show error
        if (!docContent && document?.content_html) {
          const cleanedHtml = normalizeHtml(document.content_html);
          setDocContent(cleanedHtml);
        } else if (!docContent) {
          setFileTooLarge(true);
        }
        return;
      }
      
      // Check if the response indicates need for re-authentication
      if (data?.needsReauth) {
        console.log("Google token expired, needs re-authentication");
        setNeedsReconnect(true);
        return;
      }
      
      // The edge function now returns HTML directly
      if (data?.html) {
        const cleanedHtml = normalizeHtml(data.html);
        setDocContent(cleanedHtml);
      } else if (data?.error) {
        console.error("API error:", data.error);
        setNeedsReconnect(true);
      }
    } catch (error) {
      console.error("Error fetching doc content:", error);
      setNeedsReconnect(true);
    } finally {
      setLoadingContent(false);
    }
  };

  const handleReconnectDrive = async () => {
    const { error } = await requestDriveAccess();
    if (error) {
      toast({
        title: "Connection failed",
        description: "Failed to connect to Google Drive. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleOpenInDrive = () => {
    if (document?.google_doc_id) {
      window.open(`https://docs.google.com/document/d/${document.google_doc_id}/edit`, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Document not found</h1>
          <Button onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const VisibilityIcon = visibilityConfig[document.visibility].icon;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="px-2 sm:px-3">
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              
              {document.project && (
                <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground truncate">
                  <span className="truncate max-w-[100px] sm:max-w-none">{document.project.name}</span>
                  {document.topic && (
                    <>
                      <span>/</span>
                      <span className="truncate max-w-[80px] sm:max-w-none">{document.topic.name}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-end flex-wrap">
              <Badge className={`text-xs ${visibilityConfig[document.visibility].color}`}>
                <VisibilityIcon className="h-3 w-3 mr-1" />
                <span className="hidden xs:inline">{visibilityConfig[document.visibility].label}</span>
              </Badge>
              
              {document.is_published && (
                <Badge variant="default" className="bg-primary text-primary-foreground text-xs">
                  Published
                </Badge>
              )}

              {document.project?.id && docContent && (
                <ConnectorContextActions
                  projectId={document.project.id}
                  documentId={document.id}
                  documentTitle={document.title}
                  documentContent={docContent}
                />
              )}
              
              <Button variant="outline" size="sm" onClick={() => setShowSharePanel(true)} className="px-2 sm:px-3">
                <Share2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Share</span>
              </Button>
              
              <Button variant="outline" size="sm" onClick={handleOpenInDrive} className="px-2 sm:px-3">
                <ExternalLink className="h-4 w-4 sm:mr-2" />
                <span className="hidden md:inline">Open in Drive</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Title and Meta */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 sm:mb-4">{document.title}</h1>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
            {document.owner && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Avatar className="h-5 w-5 sm:h-6 sm:w-6">
                  <AvatarFallback className="text-xs">
                    {document.owner.full_name?.[0] || document.owner.email[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate max-w-[150px] sm:max-w-none">Owner: {document.owner.full_name || document.owner.email}</span>
              </div>
            )}
            
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Created {format(new Date(document.created_at), "MMM d, yyyy")}</span>
            </div>
            
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Updated {format(new Date(document.updated_at), "MMM d, yyyy")}</span>
            </div>
          </div>
        </div>

        {/* Document Content */}
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6 lg:p-8 overflow-x-auto">
          {loadingContent ? (
            <div className="space-y-4">
              <div className="h-6 w-3/4 bg-muted animate-pulse rounded" />
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
              <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
              <div className="h-6 w-1/2 mt-6 bg-muted animate-pulse rounded" />
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
              <div className="h-4 w-5/6 bg-muted animate-pulse rounded" />
            </div>
          ) : needsReconnect ? (
            <div className="text-center py-12">
              <RefreshCw className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium text-foreground mb-2">Google Drive Access Expired</h3>
              <p className="text-muted-foreground mb-4">
                Your Google Drive access has expired. Please reconnect to view this document.
              </p>
              <div className="flex justify-center gap-3">
                <Button onClick={handleReconnectDrive}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reconnect to Google Drive
                </Button>
                <Button variant="outline" onClick={handleOpenInDrive}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in Google Docs
                </Button>
              </div>
            </div>
          ) : fileTooLarge ? (
            <div className="text-center py-12">
              <ExternalLink className="h-12 w-12 mx-auto mb-4 text-amber-500" />
              <h3 className="text-lg font-medium text-foreground mb-2">Document Too Large</h3>
              <p className="text-muted-foreground mb-4">
                This document is too large to display here. Please open it directly in Google Docs.
              </p>
              <Button onClick={handleOpenInDrive}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in Google Docs
              </Button>
            </div>
          ) : docContent ? (
            <div className="prose prose-sm sm:prose-base prose-neutral dark:prose-invert max-w-none docs-content overflow-x-hidden">
              <div dangerouslySetInnerHTML={{ __html: docContent }} />
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>Unable to load document content.</p>
              <Button variant="link" onClick={handleOpenInDrive} className="mt-2">
                Open in Google Docs to view
              </Button>
            </div>
          )}
        </div>

      </main>

      {/* Share Panel - at project level */}
      <ProjectSharePanel
        open={showSharePanel}
        onOpenChange={setShowSharePanel}
        projectId={document.project?.id || ""}
        projectName={document.project?.name || ""}
      />
    </div>
  );
}
