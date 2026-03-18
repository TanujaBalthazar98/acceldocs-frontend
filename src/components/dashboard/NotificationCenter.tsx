import { useState, useEffect, useCallback, useMemo } from "react";
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
import { parseApiDate } from "@/lib/datetime";

interface Notification {
  id: string;
  type:
    | "join_request"
    | "member_added"
    | "project_created"
    | "settings_changed"
    | "approval_submitted"
    | "approval_approved"
    | "approval_rejected"
    | "info";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  metadata?: Record<string, any>;
}

interface NotificationCenterProps {
  organizationId: string | null;
  userRole?: string;
}

const iconMap = {
  join_request: UserPlus,
  member_added: UserPlus,
  project_created: FileText,
  settings_changed: Settings,
  approval_submitted: FileText,
  approval_approved: Check,
  approval_rejected: Info,
  info: Info,
};

type ApprovalHistoryEntry = {
  id: string | number;
  document_id: string | number;
  entity_type?: "document" | "page";
  document_title: string | null;
  document_owner_id?: string | number | null;
  user_id?: string | number | null;
  user_name: string;
  action: string;
  comment?: string | null;
  created_at: string | null;
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

export const NotificationCenter = ({ organizationId, userRole }: NotificationCenterProps) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  // localStorage is scoped per user+workspace to avoid cross-workspace/account bleed.
  const [seenRequestIds, setSeenRequestIds] = useState<Set<string>>(new Set());
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());
  const currentUserId = user?.id ? Number(user.id) : null;
  const canReviewContent = ["owner", "admin", "reviewer"].includes((userRole || "").toLowerCase());
  const canManageJoinRequests = ["owner", "admin"].includes((userRole || "").toLowerCase());
  const storageScope = useMemo(() => {
    const userId = user?.id ? String(user.id) : "anon";
    const orgId = organizationId || "no-org";
    return `${userId}:${orgId}`;
  }, [user?.id, organizationId]);
  const seenStorageKey = `${SEEN_NOTIFICATIONS_KEY}:${storageScope}`;
  const readStorageKey = `${READ_NOTIFICATIONS_KEY}:${storageScope}`;

  // Load persisted IDs when user/workspace changes.
  useEffect(() => {
    setSeenRequestIds(loadPersistedSet(seenStorageKey));
    setReadNotificationIds(loadPersistedSet(readStorageKey));
    setNotifications([]);
  }, [seenStorageKey, readStorageKey]);

  // Persist seen IDs when they change
  useEffect(() => {
    persistSet(seenStorageKey, seenRequestIds);
  }, [seenRequestIds, seenStorageKey]);

  // Persist read IDs when they change
  useEffect(() => {
    persistSet(readStorageKey, readNotificationIds);
  }, [readNotificationIds, readStorageKey]);

  const addNotification = useCallback((
    notification: Omit<Notification, "id" | "timestamp" | "read">,
    entityId?: string,
    timestampIso?: string | null,
  ) => {
    // Use entity ID (like request ID) as the notification ID if provided
    const notificationId = entityId || crypto.randomUUID();
    
    // Skip if we've already seen this notification before
    if (readNotificationIds.has(notificationId)) {
      return;
    }
    
    const newNotification: Notification = {
      ...notification,
      id: notificationId,
      timestamp: parseApiDate(timestampIso) || new Date(),
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

  // Join-request notifications: poll pending requests for owner/admin users.
  useEffect(() => {
    if (!user || !organizationId || !canManageJoinRequests) return;

    let cancelled = false;

    const fetchPendingRequests = async () => {
      let requests: Array<{ id: string; user_email: string; user_name: string | null; requested_at: string }> = [];
      const { data, error } = await invokeFunction<{ requests: typeof requests }>("list-join-requests", {
        body: { organizationId },
      });
      if (cancelled) return;
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
            }, req.id, req.requested_at);
          }
        });
      }
    };

    void fetchPendingRequests();
    const interval = window.setInterval(fetchPendingRequests, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user, organizationId, canManageJoinRequests, addNotification, seenRequestIds, readNotificationIds]);

  // Subscribe to real-time events
  useEffect(() => {
    return;
  }, [user, organizationId, seenRequestIds, addNotification]);

  // Approval notifications (in-app): poll pending + history and derive unread events.
  useEffect(() => {
    if (!user || !organizationId) return;

    let cancelled = false;

    const fetchApprovalNotifications = async () => {
      try {
        const historyRes = await invokeFunction<{ ok?: boolean; history?: ApprovalHistoryEntry[] }>(
          "approvals-history",
          { body: {} },
        );

        if (cancelled) return;

        const history = historyRes.data?.ok ? historyRes.data.history || [] : [];

        // Notify reviewers/admins/owners about each explicit submit action.
        // This uses approval-history IDs so re-submitting the same page still notifies.
        if (canReviewContent) {
          for (const item of history) {
            const action = String(item.action || "").toLowerCase();
            if (action !== "submit") continue;
            if (!currentUserId) continue;
            if (item.user_id != null && Number(item.user_id) === currentUserId) continue;

            const notifId = `approval:submit:${item.id}`;
            if (seenRequestIds.has(notifId) || readNotificationIds.has(notifId)) continue;

            setSeenRequestIds((prev) => new Set([...prev, notifId]));
            addNotification(
              {
                type: "approval_submitted",
                title: "New page awaiting review",
                message: `${item.user_name || "A teammate"} submitted "${item.document_title || "Untitled"}"`,
                metadata: { documentId: item.document_id, approvalId: item.id },
              },
              notifId,
              item.created_at,
            );
          }
        }

        // Notify submitter about approve/reject decisions.
        for (const item of history) {
          const notifId = `approval:history:${item.id}`;
          if (seenRequestIds.has(notifId) || readNotificationIds.has(notifId)) continue;

          const action = String(item.action || "").toLowerCase();
          if (!["approve", "reject", "publish"].includes(action)) continue;
          if (!currentUserId || item.document_owner_id == null) continue;
          if (Number(item.document_owner_id) !== currentUserId) continue;
          if (item.user_id != null && Number(item.user_id) === currentUserId) continue;

          setSeenRequestIds((prev) => new Set([...prev, notifId]));
          const rejectComment = String(item.comment || "").trim();
          const decisionMessage =
            action === "reject"
              ? `${item.user_name} requested changes on "${item.document_title || "your page"}"${
                  rejectComment ? `: ${rejectComment}` : ""
                }`
              : `${item.user_name} approved "${item.document_title || "your page"}"`;
          addNotification(
            {
              type: action === "reject" ? "approval_rejected" : "approval_approved",
              title: action === "reject" ? "Changes requested" : "Page approved",
              message: decisionMessage,
              metadata: { approvalId: item.id, documentId: item.document_id },
            },
            notifId,
            item.created_at,
          );
        }
      } catch {
        // Avoid noisy toasts for background polling failures.
      }
    };

    void fetchApprovalNotifications();
    const interval = window.setInterval(fetchApprovalNotifications, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    user,
    organizationId,
    userRole,
    currentUserId,
    canReviewContent,
    seenRequestIds,
    readNotificationIds,
    addNotification,
  ]);

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
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        className="w-[calc(100vw-2rem)] sm:w-80 max-w-80 p-0"
      >
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
                    <div className="flex gap-2 sm:gap-3">
                      <div
                        className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                          !notification.read
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs sm:text-sm leading-tight ${
                            !notification.read ? "font-medium" : ""
                          }`}
                        >
                          {notification.title}
                        </p>
                        <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
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
