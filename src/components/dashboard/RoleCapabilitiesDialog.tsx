import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Check, X, Info } from "lucide-react";
import { ROLE_DEFINITIONS, ProjectRole } from "@/lib/rbac";

interface RoleCapabilitiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PERMISSION_GROUPS = {
  'Content': [
    { key: 'canView', label: 'View documentation' },
    { key: 'canViewDraft', label: 'View drafts' },
    { key: 'canEdit', label: 'Edit content' },
    { key: 'canCreateDocument', label: 'Create documents' },
    { key: 'canDeleteDocument', label: 'Delete documents' },
    { key: 'canPublish', label: 'Publish content' },
  ],
  'Structure': [
    { key: 'canCreateTopic', label: 'Create topics' },
    { key: 'canDeleteTopic', label: 'Delete topics' },
    { key: 'canMoveTopic', label: 'Reorganize topics' },
    { key: 'canMovePage', label: 'Move pages' },
  ],
  'Google Drive': [
    { key: 'canEditDrive', label: 'Edit in Drive' },
    { key: 'canDownloadDrive', label: 'Download files' },
    { key: 'canExportDrive', label: 'Export files' },
    { key: 'canCommentDrive', label: 'Comment in Drive' },
    { key: 'canShareDrive', label: 'Share via Drive' },
  ],
  'Administration': [
    { key: 'canManageMembers', label: 'Manage members' },
    { key: 'canInviteMembers', label: 'Invite members' },
    { key: 'canChangeRoles', label: 'Change roles' },
    { key: 'canViewAuditLogs', label: 'View audit logs' },
    { key: 'canEditProjectSettings', label: 'Edit settings' },
    { key: 'canDeleteProject', label: 'Delete project' },
  ],
};

const ROLES: (ProjectRole | 'owner')[] = ['owner', 'admin', 'editor', 'reviewer', 'viewer'];

export function RoleCapabilitiesDialog({ open, onOpenChange }: RoleCapabilitiesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Role Permissions Matrix
          </DialogTitle>
          <DialogDescription>
            See what each role can do in your documentation project
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {/* Role headers */}
          <div className="grid grid-cols-6 gap-2 mb-4 sticky top-0 bg-background py-2">
            <div className="font-medium text-sm text-muted-foreground">Capability</div>
            {ROLES.map((role) => {
              const def = ROLE_DEFINITIONS[role];
              return (
                <div key={role} className="text-center">
                  <Badge 
                    variant="outline" 
                    className={`${def?.color || 'text-muted-foreground'} font-medium`}
                  >
                    {def?.name || role}
                  </Badge>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                    {role === 'owner' ? 'Org owner' : ''}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Permission groups */}
          {Object.entries(PERMISSION_GROUPS).map(([groupName, permissions]) => (
            <div key={groupName} className="mb-6">
              <h4 className="text-sm font-semibold text-foreground mb-2 border-b pb-1">
                {groupName}
              </h4>
              <div className="space-y-1">
                {permissions.map(({ key, label }) => (
                  <div key={key} className="grid grid-cols-6 gap-2 py-1.5 hover:bg-muted/50 rounded px-1">
                    <div className="text-sm text-muted-foreground">{label}</div>
                    {ROLES.map((role) => {
                      const def = ROLE_DEFINITIONS[role];
                      const hasPermission = def?.permissions[key as keyof typeof def.permissions];
                      return (
                        <div key={`${role}-${key}`} className="flex justify-center">
                          {hasPermission ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <X className="w-4 h-4 text-muted-foreground/30" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Drive role mapping */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="text-sm font-semibold mb-2">Google Drive Permission Mapping</h4>
            <p className="text-xs text-muted-foreground mb-3">
              When you assign a role in Docspeare, the corresponding Google Drive permission is automatically synced:
            </p>
            <div className="grid grid-cols-5 gap-2">
              {ROLES.filter(r => r !== 'owner').map((role) => {
                const def = ROLE_DEFINITIONS[role];
                return (
                  <div key={role} className="text-center p-2 bg-background rounded border">
                    <div className={`text-sm font-medium ${def?.color}`}>{def?.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      → Drive: <span className="font-mono">{def?.driveRole}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
