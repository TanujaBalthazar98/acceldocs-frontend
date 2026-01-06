import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, ChevronDown, Check, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Workspace {
  id: string;
  name: string;
  role: string;
}

interface WorkspaceSwitcherProps {
  currentOrganizationId: string | null;
  onWorkspaceChange: () => void;
}

export const WorkspaceSwitcher = ({ currentOrganizationId, onWorkspaceChange }: WorkspaceSwitcherProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      // Get all organizations where the user has a role
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("organization_id, role")
        .eq("user_id", user.id);

      if (rolesError) {
        console.error("Error fetching user roles:", rolesError);
        setIsLoading(false);
        return;
      }

      if (!userRoles || userRoles.length === 0) {
        setWorkspaces([]);
        setIsLoading(false);
        return;
      }

      // Get organization details for each role
      const orgIds = userRoles.map(r => r.organization_id);
      const { data: orgs, error: orgsError } = await supabase
        .from("organizations")
        .select("id, name")
        .in("id", orgIds);

      if (orgsError) {
        console.error("Error fetching organizations:", orgsError);
        setIsLoading(false);
        return;
      }

      // Combine org info with roles
      const workspaceList: Workspace[] = (orgs || []).map(org => {
        const role = userRoles.find(r => r.organization_id === org.id)?.role || "viewer";
        return {
          id: org.id,
          name: org.name,
          role,
        };
      });

      setWorkspaces(workspaceList);

      // Set current workspace
      if (currentOrganizationId) {
        const current = workspaceList.find(w => w.id === currentOrganizationId);
        setCurrentWorkspace(current || null);
      }
    } catch (error) {
      console.error("Error fetching workspaces:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, currentOrganizationId]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleSwitchWorkspace = async (workspace: Workspace) => {
    if (workspace.id === currentOrganizationId) return;

    setIsSwitching(true);
    try {
      // Update the user's profile to point to the new organization
      const { error } = await supabase
        .from("profiles")
        .update({ organization_id: workspace.id })
        .eq("id", user?.id);

      if (error) throw error;

      toast({
        title: "Workspace switched",
        description: `Now viewing ${workspace.name}`,
      });

      // Reload to refresh all data
      onWorkspaceChange();
    } catch (error: any) {
      console.error("Error switching workspace:", error);
      toast({
        title: "Error",
        description: "Failed to switch workspace. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSwitching(false);
    }
  };

  // Show loading skeleton while fetching
  if (isLoading) {
    return (
      <div className="h-10 bg-secondary/50 rounded-lg animate-pulse" />
    );
  }

  // Don't show if user only has one workspace
  if (workspaces.length <= 1) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="w-full justify-between px-3 py-2 h-auto"
          disabled={isSwitching}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="truncate text-sm font-medium">
              {currentWorkspace?.name || "Select workspace"}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => handleSwitchWorkspace(workspace)}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <span className="block truncate">{workspace.name}</span>
                <span className="text-xs text-muted-foreground capitalize">{workspace.role}</span>
              </div>
            </div>
            {workspace.id === currentOrganizationId && (
              <Check className="w-4 h-4 text-primary flex-shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};