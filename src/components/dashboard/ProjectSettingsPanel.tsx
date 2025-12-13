import { useState } from "react";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProjectSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string | null;
}

export const ProjectSettingsPanel = ({
  open,
  onOpenChange,
  projectName,
}: ProjectSettingsProps) => {
  const [name, setName] = useState(projectName || "");
  
  // TODO: Replace with real data from database
  const members: { name: string; email: string; role: string; avatar: string }[] = [];

  if (!projectName) return null;

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
              placeholder="Add a description for this project..."
              className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
          </div>

          {/* Sync Status */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              Sync Status
            </label>
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Last synced 5 minutes ago
                </p>
                <p className="text-xs text-muted-foreground">
                  12 documents synced
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <RefreshCw className="w-3 h-3" />
                Sync Now
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
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground px-3 py-2">
                  No members yet
                </p>
              ) : (
                members.map((member) => (
                  <div
                    key={member.email}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
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
                        <button className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-background transition-colors flex items-center gap-1">
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
