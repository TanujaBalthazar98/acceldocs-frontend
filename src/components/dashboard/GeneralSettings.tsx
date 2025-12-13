import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  FolderOpen,
  ExternalLink,
  Users,
  Shield,
  ChevronDown,
  Trash2,
  AlertTriangle,
  Building2,
  RefreshCw,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface GeneralSettingsProps {
  onBack: () => void;
}

interface Member {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

export const GeneralSettings = ({ onBack }: GeneralSettingsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orgName, setOrgName] = useState("");
  const [domain, setDomain] = useState("");
  const [rootFolderId, setRootFolderId] = useState("");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    const fetchOrgData = async () => {
      if (!user) return;

      // Get user's profile and organization
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (profile?.organization_id) {
        setOrganizationId(profile.organization_id);

        // Get organization details
        const { data: org } = await supabase
          .from("organizations")
          .select("name, domain, drive_folder_id")
          .eq("id", profile.organization_id)
          .single();

        if (org) {
          setOrgName(org.name);
          setDomain(org.domain);
          if (org.drive_folder_id) {
            setRootFolderId(org.drive_folder_id);
          }
        }

        // Get team members
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .eq("organization_id", profile.organization_id);

        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .eq("organization_id", profile.organization_id);

        if (profiles && roles) {
          const memberList = profiles.map((p) => ({
            id: p.id,
            email: p.email,
            full_name: p.full_name,
            role: roles.find((r) => r.user_id === p.id)?.role || "viewer",
          }));
          setMembers(memberList);
        }
      }
    };

    fetchOrgData();
  }, [user]);

  const handleSaveRootFolder = async () => {
    if (!organizationId || !rootFolderId.trim()) return;

    setIsSavingFolder(true);

    const { error } = await supabase
      .from("organizations")
      .update({ drive_folder_id: rootFolderId.trim() })
      .eq("id", organizationId);

    if (error) {
      toast({
        title: "Error saving root folder",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Root folder saved",
        description: "Your Google Drive root folder has been configured.",
      });
    }

    setIsSavingFolder(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your organization and workspace settings
          </p>
        </div>

        <div className="space-y-10">
          {/* Organization */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Organization</h2>
            </div>
            
            <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Domain
                </label>
                <div className="px-4 py-2.5 rounded-lg bg-secondary/50 border border-border text-sm text-muted-foreground">
                  {domain}
                </div>
                <p className="text-xs text-muted-foreground">
                  Users with this email domain automatically join your organization.
                </p>
              </div>
            </div>
          </section>

          {/* Root Folder */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Google Drive Root Folder</h2>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your Google Drive folder ID. All projects and pages will be created within this folder.
              </p>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Root Folder ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={rootFolderId}
                    onChange={(e) => setRootFolderId(e.target.value)}
                    placeholder="e.g., 1abc123XYZ..."
                    className="flex-1 px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <Button 
                    onClick={handleSaveRootFolder}
                    disabled={isSavingFolder || !rootFolderId.trim()}
                  >
                    {isSavingFolder ? "Saving..." : "Save"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Find this in your Google Drive folder URL: drive.google.com/drive/folders/<strong>FOLDER_ID</strong>
                </p>
              </div>

              {rootFolderId && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary">
                  <FolderOpen className="w-5 h-5 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Root folder configured
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {rootFolderId}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(`https://drive.google.com/drive/folders/${rootFolderId}`, "_blank")}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* Team Members */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Team Members</h2>
              </div>
              <Button variant="outline" size="sm">
                Invite Member
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="divide-y divide-border">
                {members.length === 0 ? (
                  <div className="px-4 py-8 text-center text-muted-foreground">
                    No team members yet
                  </div>
                ) : (
                  members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {(member.full_name || member.email).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {member.full_name || member.email.split("@")[0]}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {member.email}
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground bg-secondary capitalize">
                        {member.role}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
            </div>

            <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-4">
              <div className="flex items-start gap-3">
                <Trash2 className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">
                    Delete Organization
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This will permanently delete your organization and all projects.
                    Documents in Google Drive will not be affected.
                  </p>
                  <Button variant="destructive" size="sm" className="mt-3">
                    Delete Organization
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
