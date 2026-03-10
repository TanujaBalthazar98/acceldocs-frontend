import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { invokeFunction } from "@/lib/api/functions";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

type DocStatus = "draft" | "review" | "approved" | "rejected";

interface PendingDoc {
  id: string;
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
  document_title: string | null;
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
    return (
      <span className="text-xs text-muted-foreground">
        {formatDistanceToNow(new Date(dateStr), { addSuffix: true })}
      </span>
    );
  } catch {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
}

export function ApprovalsPanel({ userRole, onClose, onOpenDocument, onCountChange }: ApprovalsPanelProps) {
  const { toast } = useToast();
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

  const handleAction = async (docId: string, action: "approve" | "reject", comment?: string) => {
    setActioning(docId);
    try {
      const { data, error } = await invokeFunction("approvals-action", {
        body: { document_id: Number(docId), action, comment: comment || null },
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 sm:px-6 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            <h1 className="text-base font-semibold">Approvals</h1>
            {pending.length > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 min-w-[1.25rem] h-5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                {pending.length}
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchAll} disabled={isLoading} className="h-8 w-8 text-muted-foreground">
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 h-full flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
            <TabsList className="grid grid-cols-3 w-full max-w-lg mb-6 shrink-0">
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
            <TabsContent value="pending" className="flex-1 overflow-y-auto">
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
                  {pending.map((doc) => (
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
                              onClick={() => handleAction(doc.id, "reject", commentInputs[doc.id])}
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
                      {canReview && showCommentFor !== doc.id && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                            disabled={actioning === doc.id}
                            onClick={() => handleAction(doc.id, "approve")}
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
                      {!canReview && (
                        <div className="flex items-center mt-3 pt-3 border-t border-border">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => onOpenDocument(doc.id, doc.title)}
                          >
                            View Doc
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── My Submissions ── */}
            <TabsContent value="submissions" className="flex-1 overflow-y-auto">
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
            <TabsContent value="history" className="flex-1 overflow-y-auto">
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
                    const isApprove = entry.action === "approve" || entry.action === "publish";
                    return (
                      <div key={entry.id} className="flex items-start gap-3 rounded-lg p-3 hover:bg-secondary/40 transition-colors">
                        <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${isApprove ? "bg-green-100" : "bg-red-100"}`}>
                          {isApprove
                            ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                            : <XCircle className="w-4 h-4 text-red-500" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-baseline gap-1 text-sm">
                            <span className="font-medium text-foreground">{entry.user_name}</span>
                            <span className="text-muted-foreground">
                              {isApprove ? "approved" : "requested changes on"}
                            </span>
                            <span className="font-medium text-foreground truncate max-w-[200px]">
                              {entry.document_title || "a document"}
                            </span>
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
        </div>
      </div>
    </div>
  );
}
