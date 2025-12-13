import { useState } from "react";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface GeneralSettingsProps {
  onBack: () => void;
}

const mockMembers = [
  { name: "Sarah Kim", email: "sarah@company.com", role: "Owner", avatar: "S" },
  { name: "Mike Rodriguez", email: "mike@company.com", role: "Admin", avatar: "M" },
  { name: "Alex Morgan", email: "alex@company.com", role: "Editor", avatar: "A" },
  { name: "Jordan Lee", email: "jordan@company.com", role: "Viewer", avatar: "J" },
];

export const GeneralSettings = ({ onBack }: GeneralSettingsProps) => {
  const [orgName, setOrgName] = useState("Acme Corp");
  const [rootFolderUrl] = useState("https://drive.google.com/drive/folders/1abc...");

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
                  company.com
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
                All projects and pages are organized within this folder. Documents outside this folder cannot be added to DocLayer.
              </p>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary">
                <FolderOpen className="w-5 h-5 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    DocLayer Root
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {rootFolderUrl}
                  </p>
                </div>
                <Button variant="ghost" size="icon">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Last synced 5 minutes ago
                  </p>
                  <p className="text-xs text-muted-foreground">
                    3 projects, 44 documents
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-2">
                  <RefreshCw className="w-3 h-3" />
                  Sync Now
                </Button>
              </div>

              <Button variant="outline" className="w-full">
                Change Root Folder
              </Button>
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
                {mockMembers.map((member) => (
                  <div
                    key={member.email}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {member.avatar}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {member.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors flex items-center gap-1">
                          {member.role}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Owner</DropdownMenuItem>
                        <DropdownMenuItem>Admin</DropdownMenuItem>
                        <DropdownMenuItem>Editor</DropdownMenuItem>
                        <DropdownMenuItem>Viewer</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Permissions */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Default Permissions</h2>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    New member default role
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Role assigned when users join via domain
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="px-3 py-1.5 rounded-md text-sm font-medium bg-secondary hover:bg-secondary/80 transition-colors flex items-center gap-2">
                      Viewer
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Admin</DropdownMenuItem>
                    <DropdownMenuItem>Editor</DropdownMenuItem>
                    <DropdownMenuItem>Viewer</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
