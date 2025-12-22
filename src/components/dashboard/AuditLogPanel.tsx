import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from 'date-fns';
import {
  FileText,
  Folder,
  Users,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Edit,
  Share2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  ChevronDown,
} from 'lucide-react';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  project_id: string;
  metadata: any;
  success: boolean;
  error_message: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

interface AuditLogPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName?: string;
}

const ACTION_ICONS: Record<string, typeof FileText> = {
  create_document: Plus,
  edit_document: Edit,
  delete_document: Trash2,
  create_topic: Plus,
  edit_topic: Edit,
  delete_topic: Trash2,
  publish: Eye,
  unpublish: EyeOff,
  move_topic: Folder,
  move_page: FileText,
  add_member: Users,
  remove_member: Users,
  change_role: Users,
  sync_content: RefreshCw,
  share: Share2,
  unauthorized: AlertTriangle,
};

const ACTION_LABELS: Record<string, string> = {
  create_document: 'Created page',
  edit_document: 'Edited page',
  delete_document: 'Deleted page',
  create_topic: 'Created topic',
  edit_topic: 'Edited topic',
  delete_topic: 'Deleted topic',
  publish: 'Published',
  unpublish: 'Unpublished',
  move_topic: 'Moved topic',
  move_page: 'Moved page',
  add_member: 'Added member',
  remove_member: 'Removed member',
  change_role: 'Changed role',
  sync_content: 'Synced content',
  change_visibility: 'Changed visibility',
  edit_project_settings: 'Updated settings',
};

export function AuditLogPanel({ open, onOpenChange, projectId, projectName = 'Project' }: AuditLogPanelProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [showFailed, setShowFailed] = useState(true);

  useEffect(() => {
    if (open && projectId) {
      fetchLogs();
    }
  }, [open, projectId]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      // Fetch user details for each log
      const userIds = [...new Set((data || []).map(log => log.user_id).filter(Boolean))];
      
      let userMap: Record<string, { email: string; full_name: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds);
        
        if (profiles) {
          userMap = Object.fromEntries(
            profiles.map(p => [p.id, { email: p.email, full_name: p.full_name }])
          );
        }
      }

      const logsWithUsers = (data || []).map(log => ({
        ...log,
        user_email: userMap[log.user_id]?.email,
        user_name: userMap[log.user_id]?.full_name,
      }));

      setLogs(logsWithUsers);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (!showFailed && !log.success) return false;
    if (actionFilter !== 'all' && !log.action.includes(actionFilter)) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.action.toLowerCase().includes(query) ||
        log.entity_type.toLowerCase().includes(query) ||
        log.user_email?.toLowerCase().includes(query) ||
        log.user_name?.toLowerCase().includes(query) ||
        JSON.stringify(log.metadata).toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getActionIcon = (action: string) => {
    if (action.startsWith('unauthorized')) return AlertTriangle;
    return ACTION_ICONS[action] || FileText;
  };

  const getActionLabel = (action: string) => {
    if (action.startsWith('unauthorized_')) {
      const baseAction = action.replace('unauthorized_', '');
      return `Unauthorized: ${ACTION_LABELS[baseAction] || baseAction}`;
    }
    return ACTION_LABELS[action] || action.replace(/_/g, ' ');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Audit Logs</SheetTitle>
          <SheetDescription>
            Activity history for {projectName}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                <SelectItem value="document">Documents</SelectItem>
                <SelectItem value="topic">Topics</SelectItem>
                <SelectItem value="publish">Publishing</SelectItem>
                <SelectItem value="member">Members</SelectItem>
                <SelectItem value="unauthorized">Unauthorized</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={showFailed ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFailed(!showFailed)}
            >
              {showFailed ? 'Showing failed' : 'Hiding failed'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLogs}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Logs list */}
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="space-y-2">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading logs...
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No audit logs found
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const Icon = getActionIcon(log.action);
                  return (
                    <div
                      key={log.id}
                      className={`p-3 rounded-lg border ${
                        log.success 
                          ? 'bg-card' 
                          : 'bg-destructive/5 border-destructive/20'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-md ${
                          log.success 
                            ? 'bg-primary/10 text-primary' 
                            : 'bg-destructive/10 text-destructive'
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {getActionLabel(log.action)}
                            </span>
                            {log.success ? (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            ) : (
                              <XCircle className="h-3 w-3 text-destructive" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {log.user_name || log.user_email?.split('@')[0] || 'Unknown'} •{' '}
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </div>
                          {log.entity_type && (
                            <Badge variant="secondary" className="mt-1 text-xs">
                              {log.entity_type}
                            </Badge>
                          )}
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                              {log.metadata.oldValue && log.metadata.newValue ? (
                                <span>
                                  {log.metadata.oldValue} → {log.metadata.newValue}
                                </span>
                              ) : (
                                <pre className="whitespace-pre-wrap">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              )}
                            </div>
                          )}
                          {log.error_message && (
                            <div className="mt-2 text-xs text-destructive">
                              {log.error_message}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
