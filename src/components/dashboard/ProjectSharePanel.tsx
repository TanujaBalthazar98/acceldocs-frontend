import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";

interface Member {
  id: number;
  email: string | null;
  name: string | null;
  role: "viewer";
}

interface ProjectSharePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  projectSlug?: string | null;
  organizationSlug?: string | null;
  projectVersionSlug?: string | null;
  canManageAccess?: boolean;
}

export const ProjectSharePanel = ({
  open,
  onOpenChange,
  projectId,
  projectName,
  canManageAccess = false,
}: ProjectSharePanelProps) => {
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const load = async () => {
    if (!projectId) return; // preserved for API compatibility of parent callers
    setLoading(true);
    try {
      const { data, error } = await apiFetch<{
        ok: boolean;
        grants: Array<{
          id: number;
          email: string;
          created_by_name?: string | null;
          is_active: boolean;
        }>;
      }>("/api/external-access");
      if (error || !data?.ok) {
        toast({ title: "Unable to load access list", description: error?.message, variant: "destructive" });
        return;
      }
      setMembers(
        (data.grants ?? []).map((grant) => ({
          id: grant.id,
          email: grant.email,
          name: grant.created_by_name ?? null,
          role: "viewer",
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  const handleInvite = async () => {
    if (!canManageAccess) {
      toast({ title: "Permission denied", description: "Only owner/admin can manage external access.", variant: "destructive" });
      return;
    }
    if (!email.trim()) return;
    setInviting(true);
    try {
      const { data, error } = await apiFetch<{
        ok: boolean;
        status: "created" | "already_active" | "reactivated";
        error?: string;
      }>("/api/external-access", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      if (error || !data?.ok) {
        toast({ title: "Invite failed", description: error?.message || data?.error, variant: "destructive" });
        return;
      }
      const msg =
        data.status === "already_active"
          ? `${email} already has external access.`
          : data.status === "reactivated"
            ? `External access restored for ${email}.`
            : `External access granted to ${email}.`;
      toast({ title: "Done", description: msg });
      setEmail("");
      await load();
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: number) => {
    if (!canManageAccess) {
      toast({ title: "Permission denied", description: "Only owner/admin can manage external access.", variant: "destructive" });
      return;
    }
    setRemovingId(memberId);
    try {
      const { data, error } = await apiFetch<{ ok: boolean; error?: string }>(
        `/api/external-access/${memberId}`,
        { method: "DELETE" }
      );
      if (error || !data?.ok) {
        toast({ title: "Remove failed", description: error?.message || data?.error, variant: "destructive" });
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share "{projectName}"</DialogTitle>
          <DialogDescription>
            Invite people outside your organization to view external docs in this workspace.
          </DialogDescription>
        </DialogHeader>

        {/* Invite form */}
        <div className="flex gap-2">
          <Input
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            className="flex-1"
            disabled={!canManageAccess}
          />
          <Button onClick={handleInvite} disabled={!canManageAccess || inviting || !email.trim()} size="sm">
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          </Button>
        </div>
        {!canManageAccess && (
          <p className="text-xs text-muted-foreground">
            Only owner/admin can grant or revoke external access.
          </p>
        )}

        {/* Member list */}
        <div className="space-y-1 max-h-56 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No external members yet.
            </p>
          ) : (
            members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50"
              >
                <div className="min-w-0">
                  {m.name && <p className="text-sm font-medium truncate">{m.name}</p>}
                  <p className="text-xs text-muted-foreground truncate">{m.email ?? "—"}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-xs capitalize">External</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(m.id)}
                    disabled={!canManageAccess || removingId === m.id}
                  >
                    {removingId === m.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
