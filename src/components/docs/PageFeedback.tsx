import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Send, AlertCircle, Lightbulb, Loader2, Check, Trash2, Star } from "lucide-react";
import { list, create, update, remove } from "@/lib/api/queries";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Feedback {
  id: string;
  document_id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  content: string;
  feedback_type: string;
  issue_type?: string | null;
  rating?: number | null;
  is_resolved: boolean;
  created_at: string;
}

interface PageFeedbackProps {
  documentId: string;
  isOrgUser?: boolean;
  isPublic?: boolean;
  className?: string;
}

const feedbackTypeConfig = {
  rating: { icon: Star, label: "Rating", color: "text-amber-500" },
  comment: { icon: MessageSquare, label: "Comment", color: "text-blue-500" },
  suggestion: { icon: Lightbulb, label: "Suggestion", color: "text-amber-500" },
  issue: { icon: AlertCircle, label: "Issue", color: "text-red-500" },
};

export function PageFeedback({ documentId, isOrgUser, isPublic, className }: PageFeedbackProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [feedbackType, setFeedbackType] = useState<string>("comment");
  const [issueType, setIssueType] = useState<string>("question");
  const [rating, setRating] = useState<number>(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchFeedback();
    setNewComment("");
    setRating(0);
    setIssueType("question");
  }, [documentId]);

  useEffect(() => {
    if (isPublic) {
      setFeedbackType("rating");
    }
  }, [isPublic]);

  const fetchFeedback = async () => {
    setLoading(true);
    const { data, error } = await list<Feedback>("page_feedback", {
      select: "*",
      filters: { document_id: documentId },
      orderBy: { field: "created_at", ascending: false },
    });

    if (error) {
      console.error("Error fetching feedback:", error);
    } else {
      setFeedback(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    const isPublicFeedback = !!isPublic;

    if (isPublicFeedback) {
      if (!newComment.trim() || rating === 0) return;
    } else if (!newComment.trim() || !user) {
      return;
    }

    setSubmitting(true);
    const effectiveFeedbackType = isPublicFeedback ? "rating" : feedbackType;
    const { error } = await create("page_feedback", {
      document_id: documentId,
      user_id: user?.id ?? null,
      user_name: user?.user_metadata?.full_name || user?.email?.split("@")[0] || null,
      user_email: user?.email ?? null,
      content: newComment.trim(),
      feedback_type: effectiveFeedbackType,
      issue_type: isPublicFeedback ? null : feedbackType === "issue" ? issueType : null,
      rating: isPublicFeedback ? rating : null,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to submit feedback.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Feedback submitted", description: "Thank you for your feedback!" });
      setNewComment("");
      setRating(0);
      setIssueType("question");
      fetchFeedback();
    }
    setSubmitting(false);
  };

  const handleResolve = async (feedbackId: string, currentState: boolean) => {
    const { error } = await update("page_feedback", feedbackId, { is_resolved: !currentState });

    if (error) {
      toast({ title: "Error", description: "Failed to update feedback.", variant: "destructive" });
    } else {
      fetchFeedback();
    }
  };

  const handleDelete = async (feedbackId: string) => {
    const { error } = await remove("page_feedback", feedbackId);

    if (error) {
      toast({ title: "Error", description: "Failed to delete feedback.", variant: "destructive" });
    } else {
      fetchFeedback();
    }
  };

  const getInitials = (name: string | null, email: string | null) => {
    if (name) return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    if (email) return email[0].toUpperCase();
    return "?";
  };

  const unresolvedCount = feedback.filter(f => !f.is_resolved).length;
  const isPublicFeedback = !!isPublic;
  const canSubmit = isPublicFeedback
    ? rating > 0 && !!newComment.trim()
    : !!user && !!newComment.trim();

  return (
    <div className={cn("border-t border-border mt-8 pt-6", className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <MessageSquare className="h-4 w-4" />
        Feedback & Comments
        {unresolvedCount > 0 && (
          <Badge variant="secondary" className="ml-1">
            {unresolvedCount}
          </Badge>
        )}
      </button>

      {expanded && (
        <div className="space-y-4">
          {/* Submit form */}
          {isPublicFeedback ? (
            <div className="bg-muted/30 rounded-lg p-4 space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Rate this page</p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      className="rounded-full p-1 hover:bg-muted transition-colors"
                      aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                    >
                      <Star
                        className={cn(
                          "h-5 w-5",
                          rating >= value ? "text-amber-500 fill-amber-400" : "text-muted-foreground"
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                placeholder="Tell us what worked (or what didn't)."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[80px] resize-none"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Submit
                </Button>
              </div>
            </div>
          ) : user ? (
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={feedbackType} onValueChange={setFeedbackType}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(feedbackTypeConfig)
                      .filter(([key]) => key !== "rating")
                      .map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center gap-2">
                            <config.icon className={cn("h-3 w-3", config.color)} />
                            {config.label}
                          </span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {feedbackType === "issue" && (
                  <Select value={issueType} onValueChange={setIssueType}>
                    <SelectTrigger className="w-[150px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bug">Bug</SelectItem>
                      <SelectItem value="question">Question</SelectItem>
                      <SelectItem value="idea">Idea</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Textarea
                placeholder="Share your thoughts, suggestions, or report issues..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[80px] resize-none"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Submit
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4">
              Sign in to leave feedback on this page.
            </p>
          )}

          {/* Feedback list */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : feedback.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No feedback yet. Be the first to share your thoughts!
            </p>
          ) : (
            <div className="space-y-3">
              {feedback.map((item) => {
                const config = feedbackTypeConfig[item.feedback_type as keyof typeof feedbackTypeConfig] || feedbackTypeConfig.comment;
                const TypeIcon = config.icon;
                const canManage = isOrgUser || item.user_id === user?.id;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "bg-card border border-border rounded-lg p-4",
                      item.is_resolved && "opacity-60"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(item.user_name, item.user_email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {item.user_name || item.user_email?.split("@")[0] || "Anonymous"}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            <TypeIcon className={cn("h-2.5 w-2.5 mr-1", config.color)} />
                            {config.label}
                          </Badge>
                          {item.rating ? (
                            <div className="flex items-center gap-0.5 text-amber-500">
                              {Array.from({ length: 5 }).map((_, idx) => (
                                <Star
                                  key={idx}
                                  className={cn(
                                    "h-3 w-3",
                                    item.rating && item.rating > idx ? "fill-amber-400" : "text-muted-foreground"
                                  )}
                                />
                              ))}
                            </div>
                          ) : null}
                          {item.issue_type ? (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                              {item.issue_type}
                            </Badge>
                          ) : null}
                          {item.is_resolved && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-green-600 border-green-300">
                              <Check className="h-2.5 w-2.5 mr-1" />
                              Resolved
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(item.created_at), "MMM d, yyyy")}
                          </span>
                        </div>
                        <p className="text-sm mt-1 text-foreground">{item.content}</p>
                        
                        {canManage && (
                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleResolve(item.id, item.is_resolved)}
                            >
                              {item.is_resolved ? "Reopen" : "Resolve"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
