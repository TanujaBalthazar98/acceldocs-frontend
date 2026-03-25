import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api/client";
import { orgApi, type OrgMember } from "@/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Loader2, UserPlus, Copy, Check, Link, RefreshCw } from "lucide-react";

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationName: string;
  organizationDomain?: string | null;
  currentUserRole?: OrgMember["role"] | null;
  currentUserEmail?: string | null;
}

type AppRole = "admin" | "editor" | "reviewer" | "viewer";
type MemberRole = OrgMember["role"];
const MEMBER_ROLE_OPTIONS: MemberRole[] = ["owner", "admin", "editor", "reviewer", "viewer"];
const INVITE_ROLE_OPTIONS: AppRole[] = ["viewer", "reviewer", "editor", "admin"];
const ROLE_PRIORITY: Record<MemberRole, number> = {
  owner: 5,
  admin: 4,
  editor: 3,
  reviewer: 2,
  viewer: 1,
};

function roleLabel(role: MemberRole | AppRole): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "editor") return "Editor";
  if (role === "reviewer") return "Reviewer";
  return "Viewer";
}

export const InviteMemberDialog = ({
  open,
  onOpenChange,
  organizationName,
  organizationDomain,
  currentUserRole,
  currentUserEmail,
}: InviteMemberDialogProps) => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("editor");
  const [isLoading, setIsLoading] = useState(false);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [updatingMemberId, setUpdatingMemberId] = useState<number | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const normalizedOrgDomain = (organizationDomain || "").trim().toLowerCase();
  const normalizedCurrentUserEmail = (currentUserEmail || "").trim().toLowerCase();
  const domainRestricted = normalizedOrgDomain.length > 0;
  const canManageMembers = currentUserRole === "owner" || currentUserRole === "admin";
  const canAssignOwner = currentUserRole === "owner";
  const editableRoleOptions = canAssignOwner
    ? MEMBER_ROLE_OPTIONS
    : MEMBER_ROLE_OPTIONS.filter((candidate) => candidate !== "owner");

  const loadMembers = useCallback(async () => {
    setIsMembersLoading(true);
    setMembersError(null);
    try {
      const response = await orgApi.listMembers();
      const sorted = [...response.members].sort((a, b) => {
        const byRole = ROLE_PRIORITY[b.role] - ROLE_PRIORITY[a.role];
        if (byRole !== 0) return byRole;
        return (a.email || "").localeCompare(b.email || "");
      });
      setMembers(sorted);
    } catch (error: any) {
      const message = error?.message || "Failed to load members";
      setMembersError(message);
    } finally {
      setIsMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadMembers();
    }
  }, [open, loadMembers]);

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
    if (!canManageMembers) {
      toast({ title: "Permission denied", description: "Only owner/admin can invite members.", variant: "destructive" });
      return;
    }
    if (!email.trim()) {
      toast({ title: "Error", description: "Please enter an email address", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const data = await createInvitation(email);

      if (data.status === "member") {
        toast({ title: "Already a member", description: data.message || `${email} is already a member.`, variant: "destructive" });
        void loadMembers();
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
      void loadMembers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create invitation", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!canManageMembers) {
      toast({ title: "Permission denied", description: "Only owner/admin can invite members.", variant: "destructive" });
      return;
    }
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

  const handleMemberRoleChange = async (member: OrgMember, nextRole: MemberRole) => {
    if (!canManageMembers || member.role === nextRole) return;
    setUpdatingMemberId(member.id);
    try {
      await orgApi.updateMemberRole(member.id, nextRole);
      setMembers((prev) => {
        const updated = prev.map((candidate) => (
          candidate.id === member.id ? { ...candidate, role: nextRole } : candidate
        ));
        return updated.sort((a, b) => {
          const byRole = ROLE_PRIORITY[b.role] - ROLE_PRIORITY[a.role];
          if (byRole !== 0) return byRole;
          return (a.email || "").localeCompare(b.email || "");
        });
      });
      toast({
        title: "Role updated",
        description: `${member.name || member.email || "Member"} is now ${roleLabel(nextRole)}.`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to update role",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingMemberId(null);
    }
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
      <DialogContent className="sm:max-w-xl">
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
                <Select value={role} onValueChange={(v) => setRole(v as AppRole)} disabled={!canManageMembers}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVITE_ROLE_OPTIONS.map((inviteRole) => (
                      <SelectItem key={inviteRole} value={inviteRole}>
                        <div className="flex flex-col items-start">
                          <span>{roleLabel(inviteRole)}</span>
                          <span className="text-xs text-muted-foreground">
                            {inviteRole === "admin" && "Can manage settings and members"}
                            {inviteRole === "editor" && "Can edit and publish content"}
                            {inviteRole === "reviewer" && "Can review and comment on content"}
                            {inviteRole === "viewer" && "Can view all projects and pages"}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
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
                      disabled={!canManageMembers}
                      onKeyDown={(e) => {
                        if (!canManageMembers) return;
                        if (e.key === "Enter" && email.trim()) handleInvite();
                      }}
                    />
                  </div>
                  {domainRestricted && (
                    <p className="text-xs text-muted-foreground">
                      This workspace only accepts invites for <strong>@{normalizedOrgDomain}</strong>.
                    </p>
                  )}
                  {!canManageMembers && (
                    <p className="text-xs text-muted-foreground">
                      Only owner/admin can invite members in this workspace.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Members ({members.length})
              </Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => void loadMembers()}
                disabled={isMembersLoading}
              >
                {isMembersLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
            </div>

            <div className="max-h-56 overflow-y-auto rounded-md border bg-background">
              {isMembersLoading && members.length === 0 && (
                <div className="px-3 py-4 text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading members…
                </div>
              )}
              {!isMembersLoading && membersError && (
                <div className="px-3 py-4 text-xs text-destructive">{membersError}</div>
              )}
              {!isMembersLoading && !membersError && members.length === 0 && (
                <div className="px-3 py-4 text-xs text-muted-foreground">No members found.</div>
              )}
              {!membersError && members.map((member) => {
                const isSelf = !!normalizedCurrentUserEmail && (member.email || "").toLowerCase() === normalizedCurrentUserEmail;
                const disableRoleEdit = !canManageMembers
                  || updatingMemberId === member.id
                  || isSelf
                  || (member.role === "owner" && !canAssignOwner);
                return (
                  <div key={member.id} className="flex items-center justify-between gap-2 border-b last:border-b-0 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{member.name || member.email || "Unknown member"}</p>
                      <div className="flex items-center gap-1.5">
                        {member.email && <p className="text-xs text-muted-foreground truncate">{member.email}</p>}
                        {isSelf && (
                          <Badge variant="outline" className="h-5 text-[10px] px-1.5">You</Badge>
                        )}
                      </div>
                    </div>
                    {canManageMembers ? (
                      <Select
                        value={member.role}
                        onValueChange={(nextRole) => void handleMemberRoleChange(member, nextRole as MemberRole)}
                        disabled={disableRoleEdit}
                      >
                        <SelectTrigger className="h-8 w-[116px] text-xs">
                          <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                          {(editableRoleOptions.includes(member.role as MemberRole)
                            ? editableRoleOptions
                            : [member.role as MemberRole, ...editableRoleOptions]
                          ).map((candidateRole) => (
                            <SelectItem key={candidateRole} value={candidateRole}>
                              {roleLabel(candidateRole)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className="h-6 text-[11px] font-medium">
                        {roleLabel(member.role)}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {canManageMembers
                ? "Owner/Admin can change member roles. You cannot change your own role."
                : "Only Owner/Admin can change member roles."}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => handleClose(false)}>
            {inviteLink ? "Done" : "Cancel"}
          </Button>
          {!inviteLink && canManageMembers && (
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
