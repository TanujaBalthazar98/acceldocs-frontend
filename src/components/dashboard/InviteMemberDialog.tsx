import { useState } from "react";
import { invokeFunction } from "@/lib/api/functions";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
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
  organizationId: string;
  organizationName: string;
}

type AppRole = "admin" | "editor" | "viewer";

export const InviteMemberDialog = ({
  open,
  onOpenChange,
  organizationId,
  organizationName,
}: InviteMemberDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("viewer");
  const [isLoading, setIsLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    if (!user) return;

    setIsLoading(true);
    try {
      let token: string | null = null;
      const { data, error } = await invokeFunction<{
        status?: "created" | "pending" | "accepted" | "member";
        token?: string;
        error?: string;
      }>("create-invitation", {
        body: { organizationId, email: email.toLowerCase(), role },
      });

      if (error) throw error;

      if (data?.status === "member") {
        toast({
          title: "Already a member",
          description: "This user is already a member of this workspace.",
          variant: "destructive",
        });
        return;
      }

      if (data?.status === "accepted") {
        toast({
          title: "Already a member",
          description: "This user has already accepted an invitation.",
          variant: "destructive",
        });
        return;
      }

      if (data?.status === "pending") {
        toast({
          title: "Invitation pending",
          description: "An invitation has already been sent to this email.",
          variant: "destructive",
        });
        return;
      }

      token = data?.token || null;
      if (!token) throw new Error("Failed to create invitation.");

      // Send the invitation email
      const { data: emailResult, error: emailError } = await invokeFunction(
        "send-invitation-email",
        {
          body: {
            email: email.toLowerCase(),
            organizationName,
            role,
            inviterName: user.email?.split("@")[0] || "A team member",
            token: token,
          },
        }
      );

      // The function returns { ok: boolean, ... }
      if (emailError || (emailResult && (emailResult as any).ok === false)) {
        const err = (emailResult as any)?.error;
        const message =
          err?.message ||
          emailError?.message ||
          "Invitation was created but email could not be sent.";

        console.error("Error sending email:", { emailError, emailResult });

        toast({
          title: "Invitation created (email not delivered)",
          description: message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Invitation sent",
          description: `An invitation has been sent to ${email}`,
        });
        setEmail("");
        setRole("viewer");
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("Error sending invitation:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Create the invitation without email
      let token: string | null = null;
      const { data, error } = await invokeFunction<{ token?: string }>("create-invitation", {
        body: { organizationId, role },
      });
      if (error) throw error;
      token = data?.token || null;

      if (!token) throw new Error("Failed to generate invite token.");

      const link = `${window.location.origin}/auth?invite=${token}`;
      setInviteLink(link);
      
      toast({
        title: "Invite link generated",
        description: "Copy and share this link with your team member.",
      });
    } catch (error: any) {
      console.error("Error generating invite link:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate invite link",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast({
      title: "Link copied",
      description: "Invite link copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setInviteLink(null);
      setEmail("");
      setRole("viewer");
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
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {inviteLink ? (
            <div className="space-y-3">
              <Label>Share this invite link</Label>
              <div className="flex gap-2">
                <Input
                  value={inviteLink}
                  readOnly
                  className="text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
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
                        <span className="text-xs text-muted-foreground">
                          Can view all projects and pages
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="editor">
                      <div className="flex flex-col items-start">
                        <span>Editor</span>
                        <span className="text-xs text-muted-foreground">
                          Can edit and publish content
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex flex-col items-start">
                        <span>Admin</span>
                        <span className="text-xs text-muted-foreground">
                          Can manage settings and members
                        </span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="email">Send via email (optional)</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="colleague@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                    />
                  </div>
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
              <Button
                variant="secondary"
                onClick={handleGenerateLink}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Link className="mr-2 h-4 w-4" />
                )}
                Get Invite Link
              </Button>
              {email && (
                <Button onClick={handleInvite} disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Send Email
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
