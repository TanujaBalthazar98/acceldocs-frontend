/**
 * Centralized RBAC (Role-Based Access Control) definitions
 * This file serves as the single source of truth for all role permissions
 */

export type ProjectRole = 'admin' | 'editor' | 'reviewer' | 'viewer' | null;

export interface RoleCapabilities {
  name: string;
  description: string;
  color: string;
  permissions: {
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
  };
  driveRole: 'writer' | 'commenter' | 'reader' | null;
}

export type ProjectPermissions = RoleCapabilities['permissions'];

// Role hierarchy: Owner > Admin > Editor > Reviewer > Viewer > External
export const ROLE_HIERARCHY: Record<string, number> = {
  owner: 5, // org owner (not a project_role, but treated as admin in projects)
  admin: 4,
  editor: 3,
  reviewer: 2,
  viewer: 1,
  external: 0,
};

// Base permission sets
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

export const ROLE_DEFINITIONS: Record<string, RoleCapabilities> = {
  // Organization Owner (treated as Admin at project level)
  owner: {
    name: 'Owner',
    description: 'Full control over workspace, domains, publishing, and access management. Full read/write access to all Drive folders and documents.',
    color: 'text-purple-600',
    permissions: {
      ...NO_PERMISSIONS,
      canView: true,
      canViewPublished: true,
      canViewDraft: true,
      canEdit: true,
      canEditDocument: true,
      canEditMetadata: true,
      canCreateDocument: true,
      canDeleteDocument: true,
      canCreateTopic: true,
      canDeleteTopic: true,
      canDeleteProject: true,
      canPublish: true,
      canUnpublish: true,
      canMoveTopic: true,
      canMovePage: true,
      canManageMembers: true,
      canInviteMembers: true,
      canRemoveMembers: true,
      canChangeRoles: true,
      canEditDrive: true,
      canDownloadDrive: true,
      canExportDrive: true,
      canShareDrive: true,
      canCommentDrive: true,
      canViewAuditLogs: true,
      canSyncContent: true,
      canEditProjectSettings: true,
      canEditVisibility: true,
    },
    driveRole: 'writer',
  },
  
  // Admin
  admin: {
    name: 'Admin',
    description: 'Can create, edit, delete, and publish documentation. Full Drive access for all documentation assets. Can manage project members.',
    color: 'text-red-600',
    permissions: {
      ...NO_PERMISSIONS,
      canView: true,
      canViewPublished: true,
      canViewDraft: true,
      canEdit: true,
      canEditDocument: true,
      canEditMetadata: true,
      canCreateDocument: true,
      canDeleteDocument: true,
      canCreateTopic: true,
      canDeleteTopic: true,
      canDeleteProject: true,
      canPublish: true,
      canUnpublish: true,
      canMoveTopic: true,
      canMovePage: true,
      canManageMembers: true,
      canInviteMembers: true,
      canRemoveMembers: true,
      canChangeRoles: true,
      canEditDrive: true,
      canDownloadDrive: true,
      canExportDrive: true,
      canShareDrive: true,
      canCommentDrive: true,
      canViewAuditLogs: true,
      canSyncContent: true,
      canEditProjectSettings: true,
      canEditVisibility: true,
    },
    driveRole: 'writer',
  },
  
  // Editor
  editor: {
    name: 'Editor',
    description: 'Can create and edit documentation content. Has write access to relevant Drive folders/files. Can publish content.',
    color: 'text-blue-600',
    permissions: {
      ...NO_PERMISSIONS,
      canView: true,
      canViewPublished: true,
      canViewDraft: true,
      canEdit: true,
      canEditDocument: true,
      canEditMetadata: true,
      canCreateDocument: true,
      canDeleteDocument: true,
      canCreateTopic: true,
      canDeleteTopic: true,
      canDeleteProject: false,
      canPublish: true,
      canUnpublish: true,
      canMoveTopic: true,
      canMovePage: true,
      canManageMembers: false,
      canInviteMembers: false,
      canRemoveMembers: false,
      canChangeRoles: false,
      canEditDrive: true,
      canDownloadDrive: true,
      canExportDrive: true,
      canShareDrive: false,
      canCommentDrive: true,
      canViewAuditLogs: false,
      canSyncContent: true,
      canEditProjectSettings: true,
      canEditVisibility: false,
    },
    driveRole: 'writer',
  },
  
  // Reviewer
  reviewer: {
    name: 'Reviewer',
    description: 'Can comment and suggest changes. Has comment access in Drive and review access in the UI. Cannot publish.',
    color: 'text-yellow-600',
    permissions: {
      ...NO_PERMISSIONS,
      canView: true,
      canViewPublished: true,
      canViewDraft: true,
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
      canCommentDrive: true,
      canViewAuditLogs: true,
      canSyncContent: false,
      canEditProjectSettings: false,
      canEditVisibility: false,
    },
    driveRole: 'commenter',
  },
  
  // Viewer
  viewer: {
    name: 'Viewer',
    description: 'Read-only access to internal documentation. Drive access is view-only. Cannot see drafts.',
    color: 'text-green-600',
    permissions: {
      ...NO_PERMISSIONS,
      canView: true,
      canViewPublished: true,
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
    },
    driveRole: 'reader',
  },
};

/**
 * Get permissions for a given role
 */
export function getPermissionsForRole(role: ProjectRole, isOrgOwner: boolean = false): ProjectPermissions {
  if (isOrgOwner) {
    return ROLE_DEFINITIONS.owner.permissions;
  }
  
  if (!role || !ROLE_DEFINITIONS[role]) {
    return NO_PERMISSIONS;
  }
  
  return ROLE_DEFINITIONS[role].permissions;
}

/**
 * Get role definition including metadata
 */
export function getRoleDefinition(role: string | null, isOrgOwner: boolean = false): RoleCapabilities | null {
  if (isOrgOwner) {
    return ROLE_DEFINITIONS.owner;
  }
  
  if (!role || !ROLE_DEFINITIONS[role]) {
    return null;
  }
  
  return ROLE_DEFINITIONS[role];
}

/**
 * Check if a role has higher privileges than another
 */
export function isHigherRole(roleA: string | null, roleB: string | null): boolean {
  const levelA = ROLE_HIERARCHY[roleA || ''] ?? -1;
  const levelB = ROLE_HIERARCHY[roleB || ''] ?? -1;
  return levelA > levelB;
}

/**
 * Get available roles that can be assigned by a given role
 */
export function getAssignableRoles(assignerRole: string | null, isOrgOwner: boolean = false): ProjectRole[] {
  if (isOrgOwner) {
    // Org owners can assign any role including admin
    return ['admin', 'editor', 'reviewer', 'viewer'];
  }
  
  const assignerLevel = ROLE_HIERARCHY[assignerRole || ''] ?? -1;
  
  // Only admins can assign roles, and they can't assign admin
  if (assignerLevel < ROLE_HIERARCHY.admin) {
    return [];
  }
  
  // Admins can assign editor, reviewer, viewer but not admin
  return ['editor', 'reviewer', 'viewer'];
}

/**
 * Map application role to Google Drive permission role
 */
export function getDriveRoleForAppRole(role: ProjectRole): 'writer' | 'commenter' | 'reader' | null {
  if (!role) return null;
  return ROLE_DEFINITIONS[role]?.driveRole ?? 'reader';
}

/**
 * Get a human-readable description of what a permission allows
 */
export function getPermissionDescription(permission: keyof ProjectPermissions): string {
  const descriptions: Record<keyof ProjectPermissions, string> = {
    canView: 'View documentation',
    canViewPublished: 'View published content',
    canViewDraft: 'View draft content',
    canEdit: 'Edit content',
    canEditDocument: 'Edit documents',
    canEditMetadata: 'Edit metadata',
    canCreateDocument: 'Create new documents',
    canDeleteDocument: 'Delete documents',
    canCreateTopic: 'Create topics',
    canDeleteTopic: 'Delete topics',
    canDeleteProject: 'Delete the project',
    canPublish: 'Publish content',
    canUnpublish: 'Unpublish content',
    canMoveTopic: 'Reorganize topics',
    canMovePage: 'Move pages between topics',
    canManageMembers: 'Manage project members',
    canInviteMembers: 'Invite new members',
    canRemoveMembers: 'Remove members',
    canChangeRoles: 'Change member roles',
    canEditDrive: 'Edit files in Drive',
    canDownloadDrive: 'Download files from Drive',
    canExportDrive: 'Export files from Drive',
    canShareDrive: 'Share files via Drive',
    canCommentDrive: 'Comment on Drive files',
    canViewAuditLogs: 'View audit logs',
    canSyncContent: 'Sync content from Drive',
    canEditProjectSettings: 'Edit project settings',
    canEditVisibility: 'Change project visibility',
  };
  
  return descriptions[permission] || permission;
}
