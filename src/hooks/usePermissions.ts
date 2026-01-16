import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  ProjectRole, 
  ProjectPermissions, 
  getPermissionsForRole,
  getRoleDefinition,
  ROLE_DEFINITIONS,
} from '@/lib/rbac';
import { ensureFreshSession } from '@/lib/authSession';

// Re-export types from centralized RBAC module
export type { ProjectRole, ProjectPermissions } from '@/lib/rbac';
export { getPermissionsForRole, getRoleDefinition, ROLE_DEFINITIONS } from '@/lib/rbac';

// Default empty permissions for initial state
const EMPTY_PERMISSIONS: ProjectPermissions = {
  canView: false,
  canViewPublished: false,
  canViewDraft: false,
  canEdit: false,
  canEditDocument: false,
  canEditMetadata: false,
  canCreateDocument: false,
  canDeleteDocument: false,
  canCreateTopic: false,
  canDeleteTopic: false,
  canDeleteProject: false,
  canPublish: false,
  canUnpublish: false,
  canMoveTopic: false,
  canMovePage: false,
  canManageMembers: false,
  canInviteMembers: false,
  canRemoveMembers: false,
  canChangeRoles: false,
  canEditDrive: false,
  canDownloadDrive: false,
  canExportDrive: false,
  canShareDrive: false,
  canCommentDrive: false,
  canViewAuditLogs: false,
  canSyncContent: false,
  canEditProjectSettings: false,
  canEditVisibility: false,
};

export function usePermissions(projectId: string | null) {
  const { user } = useAuth();
  const [role, setRole] = useState<ProjectRole>(null);
  const [permissions, setPermissions] = useState<ProjectPermissions>(EMPTY_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [isOrgOwner, setIsOrgOwner] = useState(false);

  const fetchRole = useCallback(async () => {
    if (!user || !projectId) {
      setRole(null);
      setPermissions(EMPTY_PERMISSIONS);
      setLoading(false);
      return;
    }

    // Proactively refresh session to ensure auth context is fresh (rate-limited)
    await ensureFreshSession();
    setLoading(true);
    
    try {
      // Check if user is org owner first
      const { data: project } = await supabase
        .from('projects')
        .select(`
          id,
          organization_id,
          organizations!projects_organization_id_fkey(owner_id)
        `)
        .eq('id', projectId)
        .maybeSingle();

      if (!project) {
        setRole(null);
        setPermissions(EMPTY_PERMISSIONS);
        setLoading(false);
        return;
      }

      const orgId = project.organization_id;
      const orgOwner = (project.organizations as any)?.owner_id === user.id;
      setIsOrgOwner(orgOwner);
      
      if (orgOwner) {
        // Org owner gets full admin permissions
        setRole('admin');
        setPermissions(getPermissionsForRole('admin', true));
        setLoading(false);
        return;
      }

      // Check org-level role (user_roles table) - this cascades to all projects
      const { data: orgRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('organization_id', orgId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (orgRole) {
        // Map org-level app_role to project_role
        const appRole = orgRole.role as string;
        let mappedRole: ProjectRole = null;
        
        if (appRole === 'owner' || appRole === 'admin') {
          mappedRole = 'admin';
        } else if (appRole === 'editor') {
          mappedRole = 'editor';
        } else if (appRole === 'viewer') {
          mappedRole = 'viewer';
        }

        if (mappedRole) {
          setRole(mappedRole);
          setPermissions(getPermissionsForRole(mappedRole, false));
          setLoading(false);
          return;
        }
      }

      // Check explicit project membership
      const { data: membership } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (membership) {
        const userRole = membership.role as ProjectRole;
        setRole(userRole);
        setPermissions(getPermissionsForRole(userRole, false));
      } else {
        // Check if project is public
        const { data: publicProject } = await supabase
          .from('projects')
          .select('is_published, visibility')
          .eq('id', projectId)
          .maybeSingle();

        if (publicProject?.is_published && publicProject?.visibility === 'public') {
          setRole('viewer');
          setPermissions(getPermissionsForRole('viewer', false));
        } else {
          setRole(null);
          setPermissions(EMPTY_PERMISSIONS);
        }
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setRole(null);
      setPermissions(EMPTY_PERMISSIONS);
    } finally {
      setLoading(false);
    }
  }, [user, projectId]);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  const checkPermission = useCallback((permission: keyof ProjectPermissions): boolean => {
    return permissions[permission];
  }, [permissions]);

  const requirePermission = useCallback((permission: keyof ProjectPermissions, action?: string): boolean => {
    if (!permissions[permission]) {
      console.warn(`Permission denied: ${permission}${action ? ` for action ${action}` : ''}`);
      return false;
    }
    return true;
  }, [permissions]);

  // Sync Drive permissions when role changes
  const syncDrivePermissions = useCallback(async () => {
    if (!projectId) return;
    
    try {
      await supabase.functions.invoke('sync-drive-permissions', {
        body: { projectId }
      });
    } catch (error) {
      console.error('Failed to sync drive permissions:', error);
    }
  }, [projectId]);

  return {
    role,
    permissions,
    loading,
    isOrgOwner,
    checkPermission,
    requirePermission,
    refetch: fetchRole,
    syncDrivePermissions,
  };
}

// Hook for logging audit actions
export function useAuditLog() {
  const { user } = useAuth();

  const logAction = useCallback(async (
    action: string,
    entityType: string,
    entityId: string | null,
    projectId: string,
    metadata: Record<string, any> = {},
    success: boolean = true,
    errorMessage?: string
  ) => {
    if (!user) return;

    try {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        project_id: projectId,
        metadata,
        success,
        error_message: errorMessage,
      });
    } catch (error) {
      console.error('Failed to log audit action:', error);
    }
  }, [user]);

  const logUnauthorizedAttempt = useCallback(async (
    action: string,
    entityType: string,
    entityId: string | null,
    projectId: string,
    requiredPermission: string
  ) => {
    return logAction(
      `unauthorized_${action}`,
      entityType,
      entityId,
      projectId,
      { requiredPermission, attempted: true },
      false,
      `User attempted ${action} without ${requiredPermission} permission`
    );
  }, [logAction]);

  return { logAction, logUnauthorizedAttempt };
}
