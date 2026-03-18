import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  FileText,
  RefreshCw,
  Loader2,
  ClipboardCheck,
  History,
  Send,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { invokeFunction } from "@/lib/api/functions";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { parseApiDate } from "@/lib/datetime";

const GOOGLE_TOKEN_KEY = "google_access_token";
import { formatDistanceToNow } from "date-fns";

type DocStatus = "draft" | "review" | "approved" | "rejected";

interface PendingDoc {
  id: string;
  entity_type?: "document" | "page";
  can_review?: boolean;
  title: string;
  project: string;
  project_id: string | null;
  project_name: string | null;
  version: string;
  slug: string;
  owner_id: string | null;
  owner_name: string | null;
  updated_at: string | null;
}

interface HistoryEntry {
  id: string;
  document_id: string;
  entity_type?: "document" | "page";
  document_title: string | null;
  document_owner_id?: string | number | null;
  user_id?: string | number | null;
  user_name: string;
  action: string;
  comment: string | null;
  created_at: string | null;
}

interface Submission {
  id: string;
  title: string;
  status: DocStatus;
  project_name: string | null;
  project_id: string | null;
  updated_at: string | null;
}

interface ApprovalsPanelProps {
  userRole?: string;
  onClose: () => void;
  onOpenDocument: (docId: string, docTitle: string) => void;
  onCountChange?: (count: number) => void;
  isMobile?: boolean;
  onOpenSidebar?: () => void;
}

const statusConfig: Record<DocStatus, { label: string; color: string; bg: string; border: string }> = {
  draft: { label: "Draft", color: "text-slate-500", bg: "bg-slate-100", border: "border-slate-200" },
  review: { label: "In Review", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  approved: { label: "Approved", color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
  rejected: { label: "Changes Requested", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
};

function StatusBadge({ status }: { status: DocStatus }) {
  const cfg = statusConfig[status] || statusConfig.draft;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

function TimeAgo({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) return <span className="text-xs text-muted-foreground">—</span>;
  try {
    const parsed = parseApiDate(dateStr, false);
    if (!parsed) {
      return <span className="text-xs text-muted-foreground">—</span>;
    }
    return (
      <span className="text-xs text-muted-foreground">
        {formatDistanceToNow(parsed, { addSuffix: true })}
      </span>
    );
  } catch {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
}

export function ApprovalsPanel({ userRole, onClose, onOpenDocument, onCountChange, isMobile, onOpenSidebar }: ApprovalsPanelProps) {
  const { toast } = useToast();
  const { googleAccessToken } = useAuth();
  const getGoogleToken = () => googleAccessToken || localStorage.getItem(GOOGLE_TOKEN_KEY);
  const canReview = userRole === "owner" || userRole === "admin" || userRole === "reviewer";

  const [activeTab, setActiveTab] = useState("pending");
  const [isLoading, setIsLoading] = useState(false);

  const [pending, setPending] = useState<PendingDoc[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // Inline comment state: docId → comment string (shown when requesting changes)
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [showCommentFor, setShowCommentFor] = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);
  const [resubmitting, setResubmitting] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [pendingRes, historyRes, submissionsRes] = await Promise.all([
        invokeFunction("approvals-pending", { body: {} }),
        invokeFunction("approvals-history", { body: {} }),
        invokeFunction("approvals-my-submissions", { body: {} }),
      ]);
      if (pendingRes.data?.ok) {
        const list = pendingRes.data.pending || [];
        setPending(list);
        onCountChange?.(list.length);
      }
      if (historyRes.data?.ok) setHistory(historyRes.data.history || []);
      if (submissionsRes.data?.ok) setSubmissions(submissionsRes.data.submissions || []);
    } catch {
      // silently ignore fetch errors on refresh
    } finally {
      setIsLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleAction = async (
    docId: string,
    action: "approve" | "reject",
    comment?: string,
    entityType: "document" | "page" = "document",
  ) => {
    setActioning(docId);
    try {
      const token = getGoogleToken();
      const { data, error } = await invokeFunction("approvals-action", {
        body: { document_id: Number(docId), action, comment: comment || null, entity_type: entityType },
        ...(token ? { headers: { "x-google-token": token } } : {}),
      });
      if (error || !data?.ok) throw new Error(data?.error || error || "Action failed");
      toast({
        title: action === "approve" ? "Document approved" : "Changes requested",
        description: action === "approve" ? "Published to the docs site." : "Document returned to draft.",
      });
      setShowCommentFor(null);
      setCommentInputs((prev) => { const next = { ...prev }; delete next[docId]; return next; });
      await fetchAll();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed", variant: "destructive" });
    } finally {
      setActioning(null);
    }
  };

  const handleResubmit = async (docId: string) => {
    setResubmitting(docId);
    try {
      const { data, error } = await invokeFunction("update-document", {
        body: { id: Number(docId), status: "review" },
      });
      if (error || !data?.ok) throw new Error(data?.error || error || "Failed");
      toast({ title: "Resubmitted for review" });
      await fetchAll();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed", variant: "destructive" });
    } finally {
      setResubmitting(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-6 sm:py-8">
      <div className="max-w-5xl mx-auto space-y-4">
        <section className="rounded-xl border bg-background/85 shadow-sm px-4 sm:px-5 py-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                {isMobile && onOpenSidebar && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onOpenSidebar}>
                    <Menu className="h-4 w-4" />
                  </Button>
                )}
                <ClipboardCheck className="w-4 h-4 text-primary" />
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">Workflow</p>
              </div>
              <h2 className="text-lg font-semibold mt-1">Approvals</h2>
              <p className="text-sm text-muted-foreground mt-1">Review queued documents, approve publishing, or request changes.</p>
            </div>
            <div className="flex items-center gap-2">
              {pending.length > 0 && (
                <span className="inline-flex items-center justify-center px-2 min-w-[1.4rem] h-6 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                  {pending.length}
                </span>
              )}
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>
                Back to content
              </Button>
              <Button variant="ghost" size="icon" onClick={fetchAll} disabled={isLoading} className="h-8 w-8 text-muted-foreground">
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-background/85 shadow-sm px-4 sm:px-5 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-3 w-full max-w-xl">
              <TabsTrigger value="pending" className="gap-1.5 text-xs sm:text-sm">
                <Clock className="w-3.5 h-3.5" />
                Pending
                {pending.length > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center px-1 min-w-[1rem] h-4 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700">
                    {pending.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="submissions" className="gap-1.5 text-xs sm:text-sm">
                <Send className="w-3.5 h-3.5" />
                My Submissions
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm">
                <History className="w-3.5 h-3.5" />
                History
              </TabsTrigger>
            </TabsList>

            {/* ── Pending Review ── */}
            <TabsContent value="pending" className="mt-4 max-h-[62vh] overflow-y-auto pr-1">
              {isLoading && pending.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin opacity-40" />
                  <p className="text-sm">Loading...</p>
                </div>
              ) : pending.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 opacity-20" />
                  <p className="text-sm font-medium">Nothing pending review</p>
                  <p className="text-xs">All documents are up to date.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.map((doc) => {
                    const canReviewThisDoc = canReview && (doc.can_review ?? true);
                    return (
                    <div key={doc.id} className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <button
                            className="text-sm font-medium text-foreground hover:text-primary transition-colors text-left line-clamp-2"
                            onClick={() => onOpenDocument(doc.id, doc.title)}
                          >
                            {doc.title || "Untitled"}
                          </button>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            {doc.project_name && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {doc.project_name}
                                {doc.version && doc.version !== "default" && (
                                  <span className="text-muted-foreground/60">· {doc.version}</span>
                                )}
                              </span>
                            )}
                            {doc.owner_name && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {doc.owner_name}
                              </span>
                            )}
                            <TimeAgo dateStr={doc.updated_at} />
                          </div>
                        </div>
                        <StatusBadge status="review" />
                      </div>

                      {/* Inline comment input (shown when "Request Changes" clicked) */}
                      {showCommentFor === doc.id && (
                        <div className="mt-3 space-y-2">
                          <Textarea
                            placeholder="Optional: describe what needs to change..."
                            className="text-sm min-h-[72px] resize-none"
                            value={commentInputs[doc.id] || ""}
                            onChange={(e) => setCommentInputs((prev) => ({ ...prev, [doc.id]: e.target.value }))}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 text-xs gap-1.5"
                              disabled={actioning === doc.id}
                              onClick={() => handleAction(doc.id, "reject", commentInputs[doc.id], doc.entity_type || "document")}
                            >
                              {actioning === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                              Send Request
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => setShowCommentFor(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Action buttons (only for reviewers) */}
                      {canReviewThisDoc && showCommentFor !== doc.id && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                            disabled={actioning === doc.id}
                            onClick={() => handleAction(doc.id, "approve", undefined, doc.entity_type || "document")}
                          >
                            {actioning === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-600"
                            disabled={actioning === doc.id}
                            onClick={() => setShowCommentFor(doc.id)}
                          >
                            <AlertTriangle className="w-3 h-3" />
                            Request Changes
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground ml-auto"
                            onClick={() => onOpenDocument(doc.id, doc.title)}
                          >
                            View Doc
                          </Button>
                        </div>
                      )}

                      {/* Non-reviewers can still view */}
                      {!canReviewThisDoc && (
                        <div className="flex items-center mt-3 pt-3 border-t border-border">
                          <p className="text-xs text-muted-foreground">View-only in this workspace.</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground ml-auto"
                            onClick={() => onOpenDocument(doc.id, doc.title)}
                          >
                            View Doc
                          </Button>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ── My Submissions ── */}
            <TabsContent value="submissions" className="mt-4 max-h-[62vh] overflow-y-auto pr-1">
              {isLoading && submissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin opacity-40" />
                  <p className="text-sm">Loading...</p>
                </div>
              ) : submissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Send className="w-12 h-12 opacity-20" />
                  <p className="text-sm font-medium">No submissions yet</p>
                  <p className="text-xs">Open a document and click "Submit for Review" to start.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {submissions.map((doc) => (
                    <div key={doc.id} className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <button
                            className="text-sm font-medium text-foreground hover:text-primary transition-colors text-left line-clamp-2"
                            onClick={() => onOpenDocument(doc.id, doc.title)}
                          >
                            {doc.title || "Untitled"}
                          </button>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            {doc.project_name && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {doc.project_name}
                              </span>
                            )}
                            <TimeAgo dateStr={doc.updated_at} />
                          </div>
                        </div>
                        <StatusBadge status={doc.status} />
                      </div>

                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                        {doc.status === "rejected" && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs gap-1.5"
                            disabled={resubmitting === doc.id}
                            onClick={() => handleResubmit(doc.id)}
                          >
                            {resubmitting === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            Resubmit
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground ml-auto"
                          onClick={() => onOpenDocument(doc.id, doc.title)}
                        >
                          View Doc
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── History ── */}
            <TabsContent value="history" className="mt-4 max-h-[62vh] overflow-y-auto pr-1">
              {isLoading && history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin opacity-40" />
                  <p className="text-sm">Loading...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <History className="w-12 h-12 opacity-20" />
                  <p className="text-sm font-medium">No approval history yet</p>
                  <p className="text-xs">Approved and rejected documents will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((entry) => {
                    const isSubmit = entry.action === "submit";
                    const isApprove = entry.action === "approve" || entry.action === "publish";
                    const isReject = entry.action === "reject";
                    return (
                      <div key={entry.id} className="flex items-start gap-3 rounded-lg p-3 hover:bg-secondary/40 transition-colors">
                        <div
                          className={`mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                            isSubmit
                              ? "bg-blue-100"
                              : isApprove
                                ? "bg-green-100"
                                : "bg-red-100"
                          }`}
                        >
                          {isSubmit ? (
                            <Send className="w-4 h-4 text-blue-600" />
                          ) : isApprove ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-baseline gap-1 text-sm">
                            <span className="font-medium text-foreground">{entry.user_name}</span>
                            <span className="text-muted-foreground">
                              {isSubmit
                                ? "submitted"
                                : isApprove
                                  ? "approved"
                                  : isReject
                                    ? "requested changes on"
                                    : `${entry.action} on`}
                            </span>
                            <span className="font-medium text-foreground truncate max-w-[200px]">
                              {entry.document_title || "a document"}
                            </span>
                            {isSubmit && <span className="text-muted-foreground">for review</span>}
                          </div>
                          {entry.comment && (
                            <p className="text-xs text-muted-foreground mt-0.5 italic line-clamp-2">
                              "{entry.comment}"
                            </p>
                          )}
                          <TimeAgo dateStr={entry.created_at} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </div>
  );
}
