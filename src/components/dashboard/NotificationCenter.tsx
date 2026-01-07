import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, UserPlus, FileText, Settings, Info, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { Separator } from "@/components/ui/separator";

interface Notification {
  id: string;
  type: "join_request" | "member_added" | "project_created" | "settings_changed" | "info";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  metadata?: Record<string, any>;
}

interface NotificationCenterProps {
  organizationId: string | null;
  onWorkspaceChange?: () => void;
}

const iconMap = {
  join_request: UserPlus,
  member_added: UserPlus,
  project_created: FileText,
  settings_changed: Settings,
  info: Info,
};

export const NotificationCenter = ({ organizationId, onWorkspaceChange }: NotificationCenterProps) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [seenRequestIds, setSeenRequestIds] = useState<Set<string>>(new Set());
  const [hasMultipleWorkspaces, setHasMultipleWorkspaces] = useState(false);

  const addNotification = useCallback((notification: Omit<Notification, "id" | "timestamp" | "read">) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      read: false,
    };
    setNotifications((prev) => [newNotification, ...prev].slice(0, 50));
  }, []);

  // Check if user has multiple workspaces
  useEffect(() => {
    if (!user) return;

    const checkWorkspaces = async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("organization_id")
        .eq("user_id", user.id);

      if (!error && data) {
        setHasMultipleWorkspaces(data.length > 1);
      }
    };

    checkWorkspaces();
  }, [user]);

  // Fetch pending join requests on mount to show unread badge
  useEffect(() => {
    if (!user || !organizationId) return;

    const fetchPendingRequests = async () => {
      const { data } = await supabase
        .from("join_requests")
        .select("id, user_email, user_name, requested_at")
        .eq("organization_id", organizationId)
        .eq("status", "pending")
        .order("requested_at", { ascending: false })
        .limit(10);

      if (data && data.length > 0) {
        const newIds = new Set<string>();
        data.forEach((req) => {
          if (!seenRequestIds.has(req.id)) {
            newIds.add(req.id);
            addNotification({
              type: "join_request",
              title: "Pending Join Request",
              message: `${req.user_name || req.user_email} wants to join your workspace`,
              metadata: { requestId: req.id },
            });
          }
        });
        if (newIds.size > 0) {
          setSeenRequestIds((prev) => new Set([...prev, ...newIds]));
        }
      }
    };

    fetchPendingRequests();
  }, [user, organizationId, addNotification]);

  // Subscribe to real-time events
  useEffect(() => {
    if (!user || !organizationId) return;

    // Listen for new join requests
    const joinRequestChannel = supabase
      .channel(`join-requests-notifications-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "join_requests",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const newRequest = payload.new as any;
          if (!seenRequestIds.has(newRequest.id)) {
            setSeenRequestIds((prev) => new Set([...prev, newRequest.id]));
            addNotification({
              type: "join_request",
              title: "New Join Request",
              message: `${newRequest.user_name || newRequest.user_email} wants to join your workspace`,
              metadata: { requestId: newRequest.id },
            });
          }
        }
      )
      .subscribe();

    // Listen for project invitations being accepted
    const invitationChannel = supabase
      .channel(`invitation-notifications-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "invitations",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated.accepted_at && !payload.old?.accepted_at) {
            addNotification({
              type: "member_added",
              title: "Invitation Accepted",
              message: `${updated.email} has joined your workspace`,
            });
          }
        }
      )
      .subscribe();

    // Listen for new projects
    const projectChannel = supabase
      .channel(`project-notifications-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "projects",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const newProject = payload.new as any;
          // Don't notify if the current user created it
          if (newProject.created_by !== user.id) {
            addNotification({
              type: "project_created",
              title: "New Project",
              message: `A new project "${newProject.name}" was created`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(joinRequestChannel);
      supabase.removeChannel(invitationChannel);
      supabase.removeChannel(projectChannel);
    };
  }, [user, organizationId, seenRequestIds, addNotification]);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={markAllAsRead}
            >
              <Check className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Workspace Switcher Section */}
        {hasMultipleWorkspaces && onWorkspaceChange && (
          <>
            <div className="p-3">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                <Building2 className="w-3 h-3" />
                Switch Workspace
              </p>
              <WorkspaceSwitcher
                currentOrganizationId={organizationId}
                onWorkspaceChange={onWorkspaceChange}
              />
            </div>
            <Separator />
          </>
        )}

        {/* Notifications List */}
        <ScrollArea className="h-[280px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = iconMap[notification.type];
                return (
                  <div
                    key={notification.id}
                    className={`p-3 hover:bg-muted/50 cursor-pointer transition-colors ${
                      !notification.read ? "bg-primary/5" : ""
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex gap-3">
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          !notification.read
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm leading-tight ${
                            !notification.read ? "font-medium" : ""
                          }`}
                        >
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(notification.timestamp, {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
