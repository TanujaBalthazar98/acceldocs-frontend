import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Users,
  Trash2,
  ChevronDown,
  AlertTriangle,
  RefreshCw,
  Globe,
  Lock,
  Eye,
  Send,
  CheckCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

type VisibilityLevel = "internal" | "external" | "public";
type ProjectRole = "admin" | "editor" | "reviewer" | "viewer";

interface ProjectMember {
  id: string;
  user_id: string;
  role: ProjectRole;
  profile?: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

interface ProjectSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  projectName: string | null;
  onUpdate?: () => void;
}

const visibilityOptions: { value: VisibilityLevel; label: string; description: string; icon: typeof Lock }[] = [
  { value: "internal", label: "Internal", description: "Only organization members", icon: Lock },
  { value: "external", label: "External", description: "Authenticated external users", icon: Eye },
  { value: "public", label: "Public", description: "Anyone on the internet", icon: Globe },
];

const roleOptions: { value: ProjectRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "editor", label: "Editor" },
  { value: "reviewer", label: "Reviewer" },
  { value: "viewer", label: "Viewer" },
];

export const ProjectSettingsPanel = ({
  open,
  onOpenChange,
  projectId,
  projectName,
  onUpdate,
}: ProjectSettingsProps) => {
  const { toast } = useToast();
  const { listFolder } = useGoogleDrive();
  const { user, googleAccessToken } = useAuth();
  
  const [name, setName] = useState(projectName || "");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<VisibilityLevel>("internal");
  const [isPublished, setIsPublished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Members state
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  
  // Sync status
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncedDocsCount, setSyncedDocsCount] = useState(0);
  const [driveFolderId, setDriveFolderId] = useState<string | null>(null);

  // Fetch project data when opened
  useEffect(() => {
    if (open && projectId) {
      fetchProjectData();
      fetchMembers();
      fetchSyncStatus();
    }
  }, [open, projectId]);

  const fetchProjectData = async () => {
    if (!projectId) return;

    const { data } = await supabase
      .from("projects")
      .select("name, description, visibility, is_published, drive_folder_id")
      .eq("id", projectId)
      .single();

    if (data) {
      setName(data.name);
      setDescription(data.description || "");
      setVisibility(data.visibility as VisibilityLevel);
      setIsPublished(data.is_published);
      setDriveFolderId(data.drive_folder_id);
    }
  };

  const fetchMembers = async () => {
    if (!projectId) return;
    setLoadingMembers(true);

    try {
      // Fetch project members
      const { data: membersData, error } = await supabase
        .from("project_members")
        .select("id, user_id, role")
        .eq("project_id", projectId);

      if (error) throw error;

      // Fetch profile info for each member
      if (membersData && membersData.length > 0) {
        const userIds = membersData.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url")
          .in("id", userIds);

        const membersWithProfiles = membersData.map(member => ({
          ...member,
          role: member.role as ProjectRole,
          profile: profiles?.find(p => p.id === member.user_id) || undefined,
        }));

        setMembers(membersWithProfiles);
      } else {
        setMembers([]);
      }
    } catch (err) {
      console.error("Error fetching members:", err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const fetchSyncStatus = async () => {
    if (!projectId) return;

    // Get latest synced document for this project
    const { data, count } = await supabase
      .from("documents")
      .select("last_synced_at", { count: "exact" })
      .eq("project_id", projectId)
      .order("last_synced_at", { ascending: false, nullsFirst: false })
      .limit(1);

    if (data && data.length > 0 && data[0].last_synced_at) {
      setLastSyncedAt(data[0].last_synced_at);
    }
    setSyncedDocsCount(count || 0);
  };

  const handleSave = async () => {
    if (!projectId) return;
    setIsSaving(true);

    const { error } = await supabase
      .from("projects")
      .update({
        name,
        description: description || null,
        visibility,
      })
      .eq("id", projectId);

    setIsSaving(false);

    if (error) {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Project settings updated." });
      onUpdate?.();
    }
  };

  const handlePublish = async () => {
    if (!projectId) return;
    setIsPublishing(true);

    const newPublishedState = !isPublished;

    const { error } = await supabase
      .from("projects")
      .update({ is_published: newPublishedState })
      .eq("id", projectId);

    setIsPublishing(false);

    if (error) {
      toast({ title: "Error", description: "Failed to update publish state.", variant: "destructive" });
    } else {
      setIsPublished(newPublishedState);
      toast({
        title: newPublishedState ? "Published" : "Unpublished",
        description: newPublishedState
          ? "Project is now live based on visibility settings."
          : "Project is no longer publicly accessible.",
      });
      onUpdate?.();
    }
  };

  const handleSyncNow = async () => {
    if (!projectId || !driveFolderId) {
      toast({ 
        title: "Cannot sync", 
        description: "Project is not connected to Google Drive.", 
        variant: "destructive" 
      });
      return;
    }

    if (!googleAccessToken) {
      toast({ 
        title: "Authentication required", 
        description: "Please reconnect to Google Drive.", 
        variant: "destructive" 
      });
      return;
    }

    setIsSyncing(true);

    try {
      // Fetch documents from Google Drive
      const result = await listFolder(driveFolderId);
      
      if (result.needsDriveAccess) {
        toast({ 
          title: "Drive access required", 
          description: "Please grant Google Drive access.", 
          variant: "destructive" 
        });
        return;
      }

      if (!result.files) {
        toast({ title: "Sync complete", description: "No files found in folder." });
        return;
      }

      // Filter for Google Docs
      const googleDocs = result.files.filter(
        f => f.mimeType === "application/vnd.google-apps.document"
      );

      // Sync each document
      let syncedCount = 0;
      for (const doc of googleDocs) {
        // Check if document already exists
        const { data: existing } = await supabase
          .from("documents")
          .select("id")
          .eq("google_doc_id", doc.id)
          .eq("project_id", projectId)
          .single();

        if (existing) {
          // Update existing document
          await supabase
            .from("documents")
            .update({
              title: doc.name,
              last_synced_at: new Date().toISOString(),
              google_modified_at: doc.modifiedTime || null,
            })
            .eq("id", existing.id);
        } else {
          // Create new document
          await supabase
            .from("documents")
            .insert({
              google_doc_id: doc.id,
              project_id: projectId,
              title: doc.name,
              owner_id: user?.id,
              last_synced_at: new Date().toISOString(),
              google_modified_at: doc.modifiedTime || null,
            });
        }
        syncedCount++;
      }

      toast({ 
        title: "Sync complete", 
        description: `${syncedCount} document(s) synced from Google Drive.` 
      });
      
      fetchSyncStatus();
      onUpdate?.();
    } catch (err) {
      console.error("Sync error:", err);
      toast({ 
        title: "Sync failed", 
        description: "An error occurred while syncing.", 
        variant: "destructive" 
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: ProjectRole) => {
    const { error } = await supabase
      .from("project_members")
      .update({ role: newRole })
      .eq("id", memberId);

    if (error) {
      toast({ title: "Error", description: "Failed to update role.", variant: "destructive" });
    } else {
      toast({ title: "Role updated", description: "Member role has been changed." });
      fetchMembers();
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      toast({ title: "Error", description: "Failed to remove member.", variant: "destructive" });
    } else {
      toast({ title: "Member removed", description: "User has been removed from the project." });
      fetchMembers();
    }
  };

  if (!projectId) return null;

  const currentVisibility = visibilityOptions.find(v => v.value === visibility);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md bg-card border-border overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold text-foreground">
            Project Settings
          </SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Manage settings for {projectName}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-8 mt-6">
          {/* Publish Status */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              Publish Status
            </label>
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
              <div className="flex items-center gap-3">
                {isPublished ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <Globe className="w-5 h-5 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {isPublished ? "Published" : "Not Published"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isPublished 
                      ? `Visible to ${visibility === "public" ? "everyone" : visibility === "external" ? "external users" : "internal users"}`
                      : "Only visible in dashboard"}
                  </p>
                </div>
              </div>
              <Button
                variant={isPublished ? "outline" : "hero"}
                size="sm"
                onClick={handlePublish}
                disabled={isPublishing}
                className="gap-2"
              >
                <Send className="w-3 h-3" />
                {isPublishing ? "..." : isPublished ? "Unpublish" : "Publish"}
              </Button>
            </div>
          </div>

          {/* Visibility */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              Visibility
            </label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as VisibilityLevel)}>
              <SelectTrigger className="w-full bg-secondary border-border">
                <SelectValue>
                  {currentVisibility && (
                    <div className="flex items-center gap-2">
                      <currentVisibility.icon className="w-4 h-4" />
                      <span>{currentVisibility.label}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {visibilityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <option.icon className="w-4 h-4" />
                      <div>
                        <span className="font-medium">{option.label}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          {option.description}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Controls who can view this project when published.
            </p>
          </div>

          {/* Project Name */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description for this project..."
              className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>

          {/* Sync Status */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              Sync Status
            </label>
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {lastSyncedAt 
                    ? `Last synced ${formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}`
                    : "Never synced"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {syncedDocsCount} document{syncedDocsCount !== 1 ? "s" : ""} synced
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={handleSyncNow}
                disabled={isSyncing || !driveFolderId}
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Syncing..." : "Sync Now"}
              </Button>
            </div>
          </div>

          {/* Project Members */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Project Members
              </label>
              <Button variant="ghost" size="sm" className="gap-2 text-primary">
                <Users className="w-3 h-3" />
                Manage
              </Button>
            </div>
            <div className="space-y-2">
              {loadingMembers ? (
                <p className="text-sm text-muted-foreground px-3 py-2">
                  Loading members...
                </p>
              ) : members.length === 0 ? (
                <p className="text-sm text-muted-foreground px-3 py-2">
                  No members yet
                </p>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                        {member.profile?.avatar_url ? (
                          <img 
                            src={member.profile.avatar_url} 
                            alt="" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-medium text-primary">
                            {(member.profile?.full_name || member.profile?.email || "?")[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {member.profile?.full_name || "Unknown User"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {member.profile?.email || "No email"}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-background transition-colors flex items-center gap-1 capitalize">
                          {member.role}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {roleOptions.map((role) => (
                          <DropdownMenuItem 
                            key={role.value}
                            onClick={() => handleUpdateRole(member.id, role.value)}
                            className={member.role === role.value ? "bg-accent" : ""}
                          >
                            {role.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-destructive">
              Danger Zone
            </label>
            <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">
                    Delete Project
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This will remove the project from DocLayer. Documents in
                    Drive will not be affected.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="mt-3 gap-2"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete Project
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};