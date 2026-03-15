import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Loader2, UserPlus, Copy, Check, Link } from "lucide-react";

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationName: string;
  organizationDomain?: string | null;
}

type AppRole = "admin" | "editor" | "reviewer" | "viewer";

export const InviteMemberDialog = ({
  open,
  onOpenChange,
  organizationName,
  organizationDomain,
}: InviteMemberDialogProps) => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("editor");
  const [isLoading, setIsLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const normalizedOrgDomain = (organizationDomain || "").trim().toLowerCase();
  const domainRestricted = normalizedOrgDomain.length > 0;

  const createInvitation = async (inviteEmail?: string) => {
    const body: Record<string, string> = { role };
    if (inviteEmail) body.email = inviteEmail.toLowerCase();
    // For link-only invites, use a placeholder email
    if (!inviteEmail) body.email = `invite-${Date.now()}@pending.acceldocs`;

    const resp = await apiFetch<{
      ok: boolean;
      status: "created" | "pending" | "member";
      token?: string;
      email_sent?: boolean;
      message?: string;
      detail?: string;
      invitation?: { id: number; email: string; role: string; expires_at: string };
    }>("/api/org/invitations", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (resp.error) {
      throw new Error(resp.error.message || "Failed to create invitation");
    }
    return resp.data!;
  };

  const handleInvite = async () => {
    if (!email.trim()) {
      toast({ title: "Error", description: "Please enter an email address", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const data = await createInvitation(email);

      if (data.status === "member") {
        toast({ title: "Already a member", description: data.message || `${email} is already a member.`, variant: "destructive" });
        return;
      }
      if (data.status === "pending") {
        // Still useful — show the invite link so they can share it
        if (data.token) {
          const link = `${window.location.origin}/auth/callback?invite=${data.token}`;
          setInviteLink(link);
        }
        toast({ title: "Invitation pending", description: data.message || "An invitation was already sent." });
        return;
      }

      // Created successfully
      if (data.token) {
        const link = `${window.location.origin}/auth/callback?invite=${data.token}`;
        setInviteLink(link);
      }
      const emailNote = data.email_sent
        ? `Email sent to ${email}`
        : `Invitation created for ${email} — share the link below`;
      toast({ title: "Invitation created", description: emailNote });
      setEmail("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create invitation", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateLink = async () => {
    setIsLoading(true);
    try {
      const data = await createInvitation();
      if (!data.token) throw new Error("Failed to generate invite token.");
      const link = `${window.location.origin}/auth/callback?invite=${data.token}`;
      setInviteLink(link);
      toast({ title: "Invite link generated", description: "Copy and share this link with your team member." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to generate invite link", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast({ title: "Link copied", description: "Invite link copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setInviteLink(null);
      setEmail("");
      setRole("editor");
      setCopied(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Invite someone to join {organizationName}
            {domainRestricted ? ` (only @${normalizedOrgDomain} emails)` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {inviteLink ? (
            <div className="space-y-3">
              <Label>Share this invite link</Label>
              <div className="flex gap-2">
                <Input value={inviteLink} readOnly className="text-sm" />
                <Button variant="outline" size="icon" onClick={handleCopyLink} className="shrink-0">
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This link will expire in 7 days. The person who uses it will join as <strong>{role}</strong>.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">
                      <div className="flex flex-col items-start">
                        <span>Viewer</span>
                        <span className="text-xs text-muted-foreground">Can view all projects and pages</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="reviewer">
                      <div className="flex flex-col items-start">
                        <span>Reviewer</span>
                        <span className="text-xs text-muted-foreground">Can review and comment on content</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="editor">
                      <div className="flex flex-col items-start">
                        <span>Editor</span>
                        <span className="text-xs text-muted-foreground">Can edit and publish content</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex flex-col items-start">
                        <span>Admin</span>
                        <span className="text-xs text-muted-foreground">Can manage settings and members</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address (optional)</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="colleague@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      onKeyDown={(e) => { if (e.key === "Enter" && email.trim()) handleInvite(); }}
                    />
                  </div>
                  {domainRestricted && (
                    <p className="text-xs text-muted-foreground">
                      This workspace only accepts invites for <strong>@{normalizedOrgDomain}</strong>.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => handleClose(false)}>
            {inviteLink ? "Done" : "Cancel"}
          </Button>
          {!inviteLink && (
            <>
              {!domainRestricted && (
                <Button variant="secondary" onClick={handleGenerateLink} disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link className="mr-2 h-4 w-4" />}
                  Get Invite Link
                </Button>
              )}
              {email && (
                <Button onClick={handleInvite} disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Invite
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
