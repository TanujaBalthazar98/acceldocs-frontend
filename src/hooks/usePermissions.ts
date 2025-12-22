import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type ProjectRole = 'admin' | 'editor' | 'reviewer' | 'viewer' | null;

export interface ProjectPermissions {
  // View permissions
  canView: boolean;
  canViewPublished: boolean;
  canViewDraft: boolean;
  
  // Edit permissions
  canEdit: boolean;
  canEditDocument: boolean;
  canEditMetadata: boolean;
  
  // Create/Delete permissions
  canCreateDocument: boolean;
  canDeleteDocument: boolean;
  canCreateTopic: boolean;
  canDeleteTopic: boolean;
  canDeleteProject: boolean;
  
  // Publish permissions
  canPublish: boolean;
  canUnpublish: boolean;
  
  // Structure permissions
  canMoveTopic: boolean;
  canMovePage: boolean;
  
  // Member permissions
  canManageMembers: boolean;
  canInviteMembers: boolean;
  canRemoveMembers: boolean;
  canChangeRoles: boolean;
  
  // Drive permissions
  canEditDrive: boolean;
  canDownloadDrive: boolean;
  canExportDrive: boolean;
  canShareDrive: boolean;
  canCommentDrive: boolean;
  
  // Audit permissions
  canViewAuditLogs: boolean;
  
  // Sync permissions
  canSyncContent: boolean;
  
  // Settings permissions
  canEditProjectSettings: boolean;
  canEditVisibility: boolean;
}

const NO_PERMISSIONS: ProjectPermissions = {
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

const VIEWER_PERMISSIONS: ProjectPermissions = {
  ...NO_PERMISSIONS,
  canView: true,
  canViewPublished: true,
};

const REVIEWER_PERMISSIONS: ProjectPermissions = {
  ...VIEWER_PERMISSIONS,
  canViewDraft: true,
  canCommentDrive: true,
};

const EDITOR_PERMISSIONS: ProjectPermissions = {
  ...REVIEWER_PERMISSIONS,
  canEdit: true,
  canEditDocument: true,
  canEditMetadata: true,
  canCreateDocument: true,
  canDeleteDocument: true,
  canCreateTopic: true,
  canDeleteTopic: true,
  canPublish: true,
  canUnpublish: true,
  canMoveTopic: true,
  canMovePage: true,
  canEditDrive: true,
  canDownloadDrive: true,
  canExportDrive: true,
  canSyncContent: true,
};

const ADMIN_PERMISSIONS: ProjectPermissions = {
  ...EDITOR_PERMISSIONS,
  canDeleteProject: true,
  canManageMembers: true,
  canInviteMembers: true,
  canRemoveMembers: true,
  canChangeRoles: true,
  canShareDrive: true,
  canViewAuditLogs: true,
  canEditProjectSettings: true,
  canEditVisibility: true,
};

export function getPermissionsForRole(role: ProjectRole): ProjectPermissions {
  switch (role) {
    case 'admin':
      return ADMIN_PERMISSIONS;
    case 'editor':
      return EDITOR_PERMISSIONS;
    case 'reviewer':
      return REVIEWER_PERMISSIONS;
    case 'viewer':
      return VIEWER_PERMISSIONS;
    default:
      return NO_PERMISSIONS;
  }
}

export function usePermissions(projectId: string | null) {
  const { user } = useAuth();
  const [role, setRole] = useState<ProjectRole>(null);
  const [permissions, setPermissions] = useState<ProjectPermissions>(NO_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [isOrgOwner, setIsOrgOwner] = useState(false);

  const fetchRole = useCallback(async () => {
    if (!user || !projectId) {
      setRole(null);
      setPermissions(NO_PERMISSIONS);
      setLoading(false);
      return;
    }

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

      if (project) {
        const orgOwner = (project.organizations as any)?.owner_id === user.id;
        setIsOrgOwner(orgOwner);
        
        if (orgOwner) {
          setRole('admin');
          setPermissions(ADMIN_PERMISSIONS);
          setLoading(false);
          return;
        }
      }

      // Check project membership
      const { data: membership } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (membership) {
        const userRole = membership.role as ProjectRole;
        setRole(userRole);
        setPermissions(getPermissionsForRole(userRole));
      } else {
        // Check if project is public
        const { data: publicProject } = await supabase
          .from('projects')
          .select('is_published, visibility')
          .eq('id', projectId)
          .maybeSingle();

        if (publicProject?.is_published && publicProject?.visibility === 'public') {
          setRole('viewer');
          setPermissions(VIEWER_PERMISSIONS);
        } else {
          setRole(null);
          setPermissions(NO_PERMISSIONS);
        }
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setRole(null);
      setPermissions(NO_PERMISSIONS);
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

  return {
    role,
    permissions,
    loading,
    isOrgOwner,
    checkPermission,
    requirePermission,
    refetch: fetchRole,
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
