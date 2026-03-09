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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { invokeFunction } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";

interface Member {
  id: number;
  userId: number;
  email: string | null;
  name: string | null;
  role: string;
}

interface ProjectSharePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  projectSlug?: string | null;
  organizationSlug?: string | null;
  projectVersionSlug?: string | null;
}

export const ProjectSharePanel = ({
  open,
  onOpenChange,
  projectId,
  projectName,
}: ProjectSharePanelProps) => {
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data } = await invokeFunction<{ ok: boolean; members: Member[] }>(
        "list-project-members",
        { body: { projectId } }
      );
      if (data?.ok) setMembers(data.members ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setInviting(true);
    try {
      const { data } = await invokeFunction<{ ok: boolean; status: string; error?: string }>(
        "invite-to-project",
        { body: { projectId, email: email.trim(), role } }
      );
      if (!data?.ok) {
        toast({ title: "Invite failed", description: data?.error, variant: "destructive" });
        return;
      }
      const msg =
        data.status === "added"
          ? "User added to project."
          : data.status === "already_member"
          ? "User is already a member."
          : `Invite sent to ${email}.`;
      toast({ title: "Done", description: msg });
      setEmail("");
      load();
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: number) => {
    setRemovingId(memberId);
    try {
      const { data } = await invokeFunction<{ ok: boolean; error?: string }>(
        "remove-project-member",
        { body: { memberId } }
      );
      if (!data?.ok) {
        toast({ title: "Remove failed", description: data?.error, variant: "destructive" });
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
            Invite people outside your organization to view this project.
            They'll see only this project when they log in.
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
          />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleInvite} disabled={inviting || !email.trim()} size="sm">
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          </Button>
        </div>

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
                  <Badge variant="secondary" className="text-xs capitalize">{m.role}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(m.id)}
                    disabled={removingId === m.id}
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
