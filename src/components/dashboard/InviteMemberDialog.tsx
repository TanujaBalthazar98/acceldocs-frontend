import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Mail, Loader2, UserPlus } from "lucide-react";

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
      // Check if invitation already exists
      const { data: existingInvite } = await supabase
        .from("invitations")
        .select("id, accepted_at")
        .eq("organization_id", organizationId)
        .eq("email", email.toLowerCase())
        .maybeSingle();

      if (existingInvite) {
        if (existingInvite.accepted_at) {
          toast({
            title: "Already a member",
            description: "This user has already accepted an invitation.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Invitation pending",
            description: "An invitation has already been sent to this email.",
            variant: "destructive",
          });
        }
        setIsLoading(false);
        return;
      }

      // Check if user is already a member
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email.toLowerCase())
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (existingProfile) {
        toast({
          title: "Already a member",
          description: "This user is already a member of this workspace.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Create the invitation
      const { data: invitation, error: inviteError } = await supabase
        .from("invitations")
        .insert({
          organization_id: organizationId,
          email: email.toLowerCase(),
          role: role,
          invited_by: user.id,
        })
        .select("token")
        .single();

      if (inviteError) throw inviteError;

      // Send the invitation email
      const { data: emailResult, error: emailError } = await supabase.functions.invoke(
        "send-invitation-email",
        {
          body: {
            email: email.toLowerCase(),
            organizationName,
            role,
            inviterName: user.email?.split("@")[0] || "A team member",
            token: invitation.token,
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
      }

      setEmail("");
      setRole("viewer");
      onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Send an email invitation to join {organizationName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Invitation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
