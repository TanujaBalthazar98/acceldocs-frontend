import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Check, X, Clock, Users, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

interface JoinRequest {
  id: string;
  user_email: string;
  user_name: string | null;
  status: string;
  requested_at: string;
}

interface JoinRequestsPanelProps {
  organizationId: string;
}

export const JoinRequestsPanel = ({ organizationId }: JoinRequestsPanelProps) => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<JoinRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("join_requests")
        .select("id, user_email, user_name, status, requested_at")
        .eq("organization_id", organizationId)
        .order("requested_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error("Error fetching join requests:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [organizationId]);

  const handleApprove = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const { error } = await supabase.rpc("approve_join_request", {
        _request_id: requestId,
      });

      if (error) throw error;

      toast({
        title: "Request approved",
        description: "The user has been added to your workspace.",
      });

      // Auto-sync Drive permissions for all org projects with Drive folders
      if (organizationId) {
        const { data: projects } = await supabase
          .from("projects")
          .select("id, drive_folder_id")
          .eq("organization_id", organizationId)
          .not("drive_folder_id", "is", null);
        
        if (projects && projects.length > 0) {
          console.log(`Syncing Drive permissions for ${projects.length} projects...`);
          // Sync in parallel for efficiency
          await Promise.all(
            projects.map(project =>
              supabase.functions.invoke("sync-drive-permissions", {
                body: { projectId: project.id }
              }).catch(err => console.error(`Failed to sync project ${project.id}:`, err))
            )
          );
          toast({
            title: "Drive access granted",
            description: "User now has access to project folders in Google Drive.",
          });
        }
      }

      fetchRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve request.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    setProcessingId(selectedRequest.id);
    try {
      const { error } = await supabase.rpc("reject_join_request", {
        _request_id: selectedRequest.id,
        _reason: rejectionReason || null,
      });

      if (error) throw error;

      toast({
        title: "Request declined",
        description: "The join request has been declined.",
      });

      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason("");
      fetchRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to decline request.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectDialog = (request: JoinRequest) => {
    setSelectedRequest(request);
    setRejectDialogOpen(true);
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const processedRequests = requests.filter((r) => r.status !== "pending");

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Join Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Join Requests
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingRequests.length} pending
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Manage requests from users who want to join your workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No join requests yet
            </p>
          ) : (
            <div className="space-y-6">
              {/* Pending Requests */}
              {pendingRequests.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Pending</h4>
                  {pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {(request.user_name || request.user_email)[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {request.user_name || request.user_email.split("@")[0]}
                          </p>
                          <p className="text-sm text-muted-foreground">{request.user_email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground mr-2">
                          {new Date(request.requested_at).toLocaleDateString()}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRejectDialog(request)}
                          disabled={processingId === request.id}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(request.id)}
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Processed Requests */}
              {processedRequests.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">History</h4>
                  {processedRequests.slice(0, 5).map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {(request.user_name || request.user_email)[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm">
                            {request.user_name || request.user_email.split("@")[0]}
                          </p>
                          <p className="text-xs text-muted-foreground">{request.user_email}</p>
                        </div>
                      </div>
                      <Badge variant={request.status === "approved" ? "default" : "secondary"}>
                        {request.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline join request?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedRequest && (
                <>
                  This will decline the request from{" "}
                  <span className="font-medium">
                    {selectedRequest.user_name || selectedRequest.user_email}
                  </span>
                  . You can optionally provide a reason.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for declining (optional)"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Decline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
