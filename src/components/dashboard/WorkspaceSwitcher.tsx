import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { invokeFunction } from "@/lib/api/functions";

interface Workspace {
  id: string;
  name: string;
  role: string;
}

interface WorkspaceSwitcherProps {
  currentOrganizationId: string | null;
  onWorkspaceChange: () => void;
  collapsed?: boolean;
}

export const WorkspaceSwitcher = ({
  currentOrganizationId,
  onWorkspaceChange,
  collapsed = false,
}: WorkspaceSwitcherProps) => {
  const { user } = useAuth();
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWorkspace = useCallback(async () => {
    if (!user || !currentOrganizationId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await invokeFunction<{
        ok?: boolean;
        organization?: { id?: string | number; name?: string };
        members?: Array<{ id?: string | number; role?: string }>;
        error?: string;
      }>("get-organization");

      if (error || !data?.ok || !data?.organization) {
        console.error("Error fetching organization:", error || data?.error);
        return;
      }

      const role =
        data.members?.find((member) => String(member.id) === String(user.id))?.role || "viewer";

      setCurrentWorkspace({
        id: String(data.organization.id ?? currentOrganizationId),
        name: data.organization.name || "Workspace",
        role,
      });
    } catch (error) {
      console.error("Error fetching workspace:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, currentOrganizationId]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  // Don't render anything during initial load
  if (isLoading || !currentWorkspace) {
    return null;
  }

  // Single workspace display - simplified because the logo lives in the header
  if (collapsed) {
    return null; // Don't show anything when collapsed - logo is already in the header
  }

  return (
    <div className="w-full px-3 py-2 border-t border-border">
      <div className="flex items-center gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {currentWorkspace.name}
          </span>
          <span className="text-xs text-muted-foreground capitalize">
            {currentWorkspace.role}
          </span>
        </div>
      </div>
    </div>
  );
};
