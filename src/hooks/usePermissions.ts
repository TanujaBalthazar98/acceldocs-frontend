import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { invokeFunction } from '@/lib/api/functions';
import { USE_STRAPI } from '@/lib/api/client';
import { create, getById, list } from '@/lib/api/queries';
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
  const didDrivePullSync = useRef(false);

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
      if (USE_STRAPI) {
        const { data, error } = await invokeFunction<{
          project?: any;
          organization?: any;
          orgRoles?: any[];
          projectMembers?: any[];
        }>('get-project-settings', { body: { projectId } });

        if (error || !data?.project) {
          setRole(null);
          setPermissions(EMPTY_PERMISSIONS);
          setLoading(false);
          return;
        }

        const org = data.organization || null;
        const orgOwnerId = org?.owner?.id ? String(org.owner.id) : null;
        const orgOwner = orgOwnerId === String(user.id);
        setIsOrgOwner(orgOwner);

        if (data.effectiveRole) {
          const effectiveRole = data.effectiveRole as ProjectRole;
          setRole(effectiveRole);
          setPermissions(getPermissionsForRole(effectiveRole, orgOwner));
          setLoading(false);
          return;
        }

        if (orgOwner) {
          setRole('admin');
          setPermissions(getPermissionsForRole('admin', true));
          setLoading(false);
          return;
        }

        const orgRoleRow = (data.orgRoles || []).find((r: any) => String(r.user?.id) === String(user.id));
        if (orgRoleRow) {
          const appRole = orgRoleRow.role as string;
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

        const membershipRow = (data.projectMembers || []).find((m: any) => String(m.user?.id) === String(user.id));
        if (membershipRow) {
          const userRole = membershipRow.role as ProjectRole;
          setRole(userRole);
          setPermissions(getPermissionsForRole(userRole, false));
        } else {
          const visibility = data.project?.visibility;
          const isPublished = !!data.project?.is_published;
          if (isPublished && visibility === 'public') {
            setRole('viewer');
            setPermissions(getPermissionsForRole('viewer', false));
          } else {
            setRole(null);
            setPermissions(EMPTY_PERMISSIONS);
          }
        }
        setLoading(false);
        return;
      }

      // Check if user is org owner first
      const { data: project } = await getById<{ id: string; organization_id: string | null }>(
        'projects',
        projectId,
        { select: 'id, organization_id' },
      );

      if (!project) {
        setRole(null);
        setPermissions(EMPTY_PERMISSIONS);
        setLoading(false);
        return;
      }

      const orgId = project.organization_id;
      const { data: org } = orgId
        ? await getById<{ owner_id: string | null }>('organizations', orgId, { select: 'owner_id' })
        : { data: null };
      const orgOwner = org?.owner_id === user.id;
      setIsOrgOwner(orgOwner);

      if (orgOwner) {
        // Org owner gets full admin permissions
        setRole('admin');
        setPermissions(getPermissionsForRole('admin', true));
        setLoading(false);
        return;
      }

      // Check org-level role (user_roles table) - this cascades to all projects
      const { data: orgRoles } = await list<{ role: string }>('user_roles', {
        select: 'role',
        filters: { organization_id: orgId, user_id: user.id },
        limit: 1,
      });
      const orgRole = orgRoles?.[0] ?? null;

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
      const { data: memberships } = await list<{ role: string }>('project_members', {
        select: 'role',
        filters: { project_id: projectId, user_id: user.id },
        limit: 1,
      });
      const membership = memberships?.[0] ?? null;

      if (membership) {
        const userRole = membership.role as ProjectRole;
        setRole(userRole);
        setPermissions(getPermissionsForRole(userRole, false));
      } else {
        // Check if project is public
        const { data: publicProject } = await getById<{ is_published: boolean; visibility: string | null }>(
          'projects',
          projectId,
          { select: 'is_published, visibility' },
        );

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
  }, [user?.id, projectId]);

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
      await invokeFunction('sync-drive-permissions', {
        body: { projectId }
      });
    } catch (error) {
      console.error('Failed to sync drive permissions:', error);
    }
  }, [projectId]);

  const syncDrivePermissionsFromDrive = useCallback(async () => {
    if (!projectId) return;
    if (didDrivePullSync.current) return;

    didDrivePullSync.current = true;
    try {
      await invokeFunction('sync-drive-permissions', {
        body: { projectId, direction: "pull", enforceNoDownload: true }
      });
    } catch (error) {
      // Non-admins will be denied; ignore silently.
    }
  }, [projectId]);

  useEffect(() => {
    syncDrivePermissionsFromDrive();
  }, [syncDrivePermissionsFromDrive]);

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
      await create('audit_logs', {
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
