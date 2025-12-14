import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Share2, User, Calendar, Eye, Lock, Globe, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { SharePanel } from "@/components/dashboard/SharePanel";
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

// Helper function to convert Google Docs JSON to simple HTML
function convertDocToHtml(doc: any): string {
  if (!doc?.body?.content) return "";
  
  let html = "";
  
  for (const element of doc.body.content) {
    if (element.paragraph) {
      const para = element.paragraph;
      let paraHtml = "";
      
      if (para.elements) {
        for (const el of para.elements) {
          if (el.textRun) {
            let text = el.textRun.content || "";
            const style = el.textRun.textStyle || {};
            
            // Apply text styling
            if (style.bold) text = `<strong>${text}</strong>`;
            if (style.italic) text = `<em>${text}</em>`;
            if (style.underline) text = `<u>${text}</u>`;
            if (style.link?.url) text = `<a href="${style.link.url}" target="_blank" rel="noopener">${text}</a>`;
            
            paraHtml += text;
          }
        }
      }
      
      // Check for heading styles
      const namedStyle = para.paragraphStyle?.namedStyleType;
      if (namedStyle === "HEADING_1") {
        html += `<h1>${paraHtml}</h1>`;
      } else if (namedStyle === "HEADING_2") {
        html += `<h2>${paraHtml}</h2>`;
      } else if (namedStyle === "HEADING_3") {
        html += `<h3>${paraHtml}</h3>`;
      } else {
        html += `<p>${paraHtml}</p>`;
      }
    }
  }
  
  return html;
}

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
    } catch (error) {
      console.error("Error fetching document:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocContent = async () => {
    const token = getGoogleToken();
    if (!token || !document?.google_doc_id) {
      setNeedsReconnect(true);
      return;
    }

    setLoadingContent(true);
    setNeedsReconnect(false);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive", {
        body: {
          action: "get_doc_content",
          docId: document.google_doc_id,
        },
        headers: {
          "x-google-token": token,
        },
      });

      if (error) {
        console.error("Error fetching doc content:", error);
        setNeedsReconnect(true);
        return;
      }
      
      // Check if the response indicates need for re-authentication
      if (data?.needsReauth) {
        console.log("Google token expired, needs re-authentication");
        setNeedsReconnect(true);
        return;
      }
      
      // The edge function returns the doc object, convert to HTML content
      if (data?.doc) {
        const htmlContent = convertDocToHtml(data.doc);
        setDocContent(htmlContent);
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
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              
              {document.project && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{document.project.name}</span>
                  {document.topic && (
                    <>
                      <span>/</span>
                      <span>{document.topic.name}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Badge className={visibilityConfig[document.visibility].color}>
                <VisibilityIcon className="h-3 w-3 mr-1" />
                {visibilityConfig[document.visibility].label}
              </Badge>
              
              {document.is_published && (
                <Badge variant="default" className="bg-primary text-primary-foreground">
                  Published
                </Badge>
              )}
              
              <Button variant="outline" size="sm" onClick={() => setShowSharePanel(true)}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              
              <Button variant="outline" size="sm" onClick={handleOpenInDrive}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in Drive
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Title and Meta */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">{document.title}</h1>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {document.owner && (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {document.owner.full_name?.[0] || document.owner.email[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>Owner: {document.owner.full_name || document.owner.email}</span>
              </div>
            )}
            
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Created {format(new Date(document.created_at), "MMM d, yyyy")}</span>
            </div>
            
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Updated {format(new Date(document.updated_at), "MMM d, yyyy")}</span>
            </div>
          </div>
        </div>

        {/* Document Content */}
        <div className="bg-card border border-border rounded-lg p-8">
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
          ) : docContent ? (
            <div className="prose prose-invert max-w-none">
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

      {/* Share Panel */}
      <SharePanel
        open={showSharePanel}
        onOpenChange={setShowSharePanel}
        pageTitle={document.title}
      />
    </div>
  );
}
