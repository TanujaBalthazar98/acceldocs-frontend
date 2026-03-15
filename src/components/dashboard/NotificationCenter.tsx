import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { invokeFunction } from "@/lib/api/functions";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, UserPlus, FileText, Settings, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
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
  onWorkspaceChange?: (orgId: number) => void;
}

const iconMap = {
  join_request: UserPlus,
  member_added: UserPlus,
  project_created: FileText,
  settings_changed: Settings,
  info: Info,
};

// LocalStorage keys for persistence
const SEEN_NOTIFICATIONS_KEY = "docspeare_seen_notifications";
const READ_NOTIFICATIONS_KEY = "docspeare_read_notifications";

// Helper functions for persistence
const loadPersistedSet = (key: string): Set<string> => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return new Set(parsed);
      }
    }
  } catch (e) {
    console.error(`Failed to load ${key}:`, e);
  }
  return new Set();
};

const persistSet = (key: string, set: Set<string>) => {
  try {
    // Keep only the last 200 entries to prevent unbounded growth
    const arr = Array.from(set).slice(-200);
    localStorage.setItem(key, JSON.stringify(arr));
  } catch (e) {
    console.error(`Failed to persist ${key}:`, e);
  }
};

export const NotificationCenter = ({ organizationId, onWorkspaceChange }: NotificationCenterProps) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  // Initialize from localStorage
  const [seenRequestIds, setSeenRequestIds] = useState<Set<string>>(() => loadPersistedSet(SEEN_NOTIFICATIONS_KEY));
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => loadPersistedSet(READ_NOTIFICATIONS_KEY));
  const [hasMultipleWorkspaces, setHasMultipleWorkspaces] = useState(false);
  const initialFetchDone = useRef(false);

  // Persist seen IDs when they change
  useEffect(() => {
    persistSet(SEEN_NOTIFICATIONS_KEY, seenRequestIds);
  }, [seenRequestIds]);

  // Persist read IDs when they change
  useEffect(() => {
    persistSet(READ_NOTIFICATIONS_KEY, readNotificationIds);
  }, [readNotificationIds]);

  const addNotification = useCallback((notification: Omit<Notification, "id" | "timestamp" | "read">, entityId?: string) => {
    // Use entity ID (like request ID) as the notification ID if provided
    const notificationId = entityId || crypto.randomUUID();
    
    // Skip if we've already seen this notification before
    if (readNotificationIds.has(notificationId)) {
      return;
    }
    
    const newNotification: Notification = {
      ...notification,
      id: notificationId,
      timestamp: new Date(),
      read: false,
    };
    setNotifications((prev) => {
      // Avoid duplicate notifications
      if (prev.some(n => n.id === notificationId)) {
        return prev;
      }
      return [newNotification, ...prev].slice(0, 50);
    });
  }, [readNotificationIds]);

  // Check if user has multiple workspaces
  useEffect(() => {
    if (!user) return;

    setHasMultipleWorkspaces(false);
  }, [user]);

  // Fetch pending join requests on mount - only once
  useEffect(() => {
    if (!user || !organizationId || initialFetchDone.current) return;

    const fetchPendingRequests = async () => {
      let requests: Array<{ id: string; user_email: string; user_name: string | null; requested_at: string }> = [];
      const { data, error } = await invokeFunction<{ requests: typeof requests }>("list-join-requests", {
        body: { organizationId },
      });
      if (!error && data?.requests) {
        requests = data.requests;
      }

      if (requests && requests.length > 0) {
        requests.forEach((req) => {
          // Only add if not already seen/read
          if (!seenRequestIds.has(req.id) && !readNotificationIds.has(req.id)) {
            setSeenRequestIds((prev) => new Set([...prev, req.id]));
            addNotification({
              type: "join_request",
              title: "Pending Join Request",
              message: `${req.user_name || req.user_email} wants to join your workspace`,
              metadata: { requestId: req.id },
            }, req.id);
          }
        });
      }
      initialFetchDone.current = true;
    };

    fetchPendingRequests();
  }, [user, organizationId, addNotification, seenRequestIds, readNotificationIds]);

  // Subscribe to real-time events
  useEffect(() => {
    return;
  }, [user, organizationId, seenRequestIds, addNotification]);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    // Persist that this notification was read
    setReadNotificationIds((prev) => new Set([...prev, id]));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    // Persist all as read
    setReadNotificationIds((prev) => {
      const newSet = new Set([...prev]);
      notifications.forEach(n => newSet.add(n.id));
      return newSet;
    });
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

        {/* Workspace switching is now in the sidebar header */}

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
