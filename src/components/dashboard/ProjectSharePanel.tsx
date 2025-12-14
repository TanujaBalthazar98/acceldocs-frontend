import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Copy,
  Check,
  Link2,
  ChevronDown,
  UserPlus,
  Mail,
  Trash2,
  Eye,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface ProjectSharePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}

type ProjectRole = "admin" | "editor" | "reviewer" | "viewer";

interface ProjectMember {
  id: string;
  user_id: string;
  role: ProjectRole;
  email?: string;
  full_name?: string;
}

const roleConfig: Record<ProjectRole, { label: string; description: string }> = {
  admin: { label: "Admin", description: "Full access and can manage members" },
  editor: { label: "Editor", description: "Can edit and publish pages" },
  reviewer: { label: "Reviewer", description: "Can comment only" },
  viewer: { label: "Viewer", description: "Read-only access" },
};

export const ProjectSharePanel = ({ 
  open, 
  onOpenChange, 
  projectId, 
  projectName 
}: ProjectSharePanelProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<ProjectRole>("viewer");
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (open && projectId) {
      fetchMembers();
    }
  }, [open, projectId]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("project_members")
        .select("id, user_id, role")
        .eq("project_id", projectId);

      if (error) throw error;

      // Fetch profile info for each member
      if (data && data.length > 0) {
        const userIds = data.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);

        const membersWithProfiles = data.map(member => {
          const profile = profiles?.find(p => p.id === member.user_id);
          return {
            ...member,
            email: profile?.email,
            full_name: profile?.full_name,
          };
        });
        setMembers(membersWithProfiles);
      } else {
        setMembers([]);
      }
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!email.trim()) {
      toast({ title: "Error", description: "Please enter an email address.", variant: "destructive" });
      return;
    }

    setInviting(true);
    try {
      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        toast({ title: "User not found", description: "No user with that email exists.", variant: "destructive" });
        setInviting(false);
        return;
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from("project_members")
        .select("id")
        .eq("project_id", projectId)
        .eq("user_id", profile.id)
        .maybeSingle();

      if (existing) {
        toast({ title: "Already a member", description: "This user is already a project member.", variant: "destructive" });
        setInviting(false);
        return;
      }

      // Add member
      const { error: insertError } = await supabase
        .from("project_members")
        .insert({
          project_id: projectId,
          user_id: profile.id,
          role: selectedRole,
        });

      if (insertError) throw insertError;

      toast({ title: "Member added", description: `${email} has been added as ${selectedRole}.` });
      setEmail("");
      fetchMembers();
    } catch (error) {
      console.error("Error inviting member:", error);
      toast({ title: "Error", description: "Failed to add member.", variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: ProjectRole) => {
    try {
      const { error } = await supabase
        .from("project_members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;

      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      toast({ title: "Role updated" });
    } catch (error) {
      console.error("Error updating role:", error);
      toast({ title: "Error", description: "Failed to update role.", variant: "destructive" });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      setMembers(prev => prev.filter(m => m.id !== memberId));
      toast({ title: "Member removed" });
    } catch (error) {
      console.error("Error removing member:", error);
      toast({ title: "Error", description: "Failed to remove member.", variant: "destructive" });
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/docs/${projectId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleViewPreview = () => {
    window.open(`/docs/${projectId}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Share Project: {projectName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Quick Links */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewPreview}
              className="flex-1 gap-2"
            >
              <Eye className="w-4 h-4" />
              Preview Docs
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/docs/${projectId}`, '_blank')}
              className="flex-1 gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Published Docs
            </Button>
          </div>

          {/* Invite Input */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">
              Add team members
            </label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="Enter email address..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex-1 flex items-center justify-between px-4 py-2.5 rounded-lg bg-secondary border border-border hover:border-primary/30 transition-colors">
                      <span className="text-sm text-foreground">{roleConfig[selectedRole].label}</span>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {(Object.entries(roleConfig) as [ProjectRole, typeof roleConfig.admin][]).map(
                      ([key, config]) => (
                        <DropdownMenuItem
                          key={key}
                          onClick={() => setSelectedRole(key)}
                          className="flex flex-col items-start"
                        >
                          <span className="font-medium">{config.label}</span>
                          <span className="text-xs text-muted-foreground">{config.description}</span>
                        </DropdownMenuItem>
                      )
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="default" className="gap-2" onClick={handleInvite} disabled={inviting}>
                  <UserPlus className="w-4 h-4" />
                  {inviting ? "Adding..." : "Add"}
                </Button>
              </div>
            </div>
          </div>

          {/* People with access */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">
              Project members ({members.length})
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {loading ? (
                <p className="text-sm text-muted-foreground py-2">Loading...</p>
              ) : members.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No members added yet.</p>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {member.email?.charAt(0).toUpperCase() || "?"}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {member.full_name || member.email?.split("@")[0]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-background transition-colors flex items-center gap-1">
                            {roleConfig[member.role].label}
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(Object.keys(roleConfig) as ProjectRole[]).map((role) => (
                            <DropdownMenuItem
                              key={role}
                              onClick={() => handleUpdateRole(member.id, role)}
                            >
                              {roleConfig[role].label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {member.user_id !== user?.id && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Copy Link */}
          <div className="pt-2 border-t border-border">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleCopyLink}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-state-active" />
                  <span className="text-state-active">Link copied!</span>
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4" />
                  Copy docs link
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};