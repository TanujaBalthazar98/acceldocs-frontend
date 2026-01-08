import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

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
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", currentOrganizationId)
        .maybeSingle();

      if (orgError) {
        console.error("Error fetching organization:", orgError);
        return;
      }

      if (org) {
        const { data: userRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("organization_id", currentOrganizationId)
          .maybeSingle();

        setCurrentWorkspace({
          id: org.id,
          name: org.name,
          role: userRole?.role || "viewer",
        });
      }
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

  // Single workspace display - simplified for Acceldata-only (no logo since it's in header)
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
