import { useState, useEffect, useRef } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { invokeFunction } from "@/lib/api/functions";
import { useDriveRecovery } from "@/hooks/useDriveRecovery";
import { DRIVE_INTEGRATION_ENABLED } from "@/lib/featureFlags";

interface DriveStatusIndicatorProps {
  onStatusChange?: (connected: boolean) => void;
}

type ConnectionStatus = 'connected' | 'disconnected' | 'needs_reauth' | 'checking' | 'not_owner' | null;

export const DriveStatusIndicator = ({ onStatusChange }: DriveStatusIndicatorProps) => {
  if (!DRIVE_INTEGRATION_ENABLED) {
    return null;
  }

  const { user, googleAccessToken, requestDriveAccess } = useAuth();
  const { resetRecoveryState, attemptRecovery } = useDriveRecovery();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isOrgOwner, setIsOrgOwner] = useState(false);
  const lastCheckRef = useRef<number>(0);

  const checkDriveConnection = async (forceCheck = false): Promise<boolean> => {
    if (!user) return false;

    // Prevent checking more than once per minute unless forced
    const now = Date.now();
    if (!forceCheck && now - lastCheckRef.current < 60000) return connectionStatus === "connected";
    lastCheckRef.current = now;
    
    setConnectionStatus('checking');
    try {
      const { data: orgRes, error: orgError } = await invokeFunction<{
        ok?: boolean;
        members?: Array<{ id?: string | number; role?: string }>;
      }>("get-organization");

      if (orgError || !orgRes?.ok) {
        setConnectionStatus("needs_reauth");
        onStatusChange?.(false);
        return false;
      }

      const role =
        orgRes.members?.find((member) => String(member.id) === String(user.id))?.role || null;
      if (!role) {
        setConnectionStatus("needs_reauth");
        onStatusChange?.(false);
        return false;
      }
      const userIsOwner = role === "owner";
      setIsOrgOwner(userIsOwner);

      // Only the org owner needs to have Drive connected
      if (!userIsOwner) {
        setConnectionStatus('not_owner');
        onStatusChange?.(true); // Non-owners don't need Drive access
        return true;
      }

      // For the owner, check Drive connection.
      // First use frontend token; if that fails, try backend-managed refresh token.
      const token = googleAccessToken || localStorage.getItem("google_access_token");
      const response = await invokeFunction('google-drive', token
        ? {
            body: { action: 'list_folder', folderId: 'root' },
            headers: { "x-google-token": token },
          }
        : {
            body: { action: 'list_folder', folderId: 'root' },
          });

      const firstCheckFailed =
        !!response.error ||
        response.data?.needsReauth ||
        response.data?.ok === false ||
        !!response.data?.error;

      if (firstCheckFailed) {
        // Fallback: token in browser may be stale; allow backend to refresh with stored token.
        const serverSideCheck = await invokeFunction('google-drive', {
          body: { action: 'list_folder', folderId: 'root' },
        });

        const serverSideConnected =
          !serverSideCheck.error &&
          !serverSideCheck.data?.needsReauth &&
          serverSideCheck.data?.ok !== false &&
          !serverSideCheck.data?.error;

        if (serverSideConnected) {
          resetRecoveryState();
          setConnectionStatus('connected');
          onStatusChange?.(true);
          return true;
        }

        // Attempt silent recovery first
        const { recovered } = await attemptRecovery("Drive check failed", true);
        if (recovered) {
          setConnectionStatus('connected');
          onStatusChange?.(true);
          return true;
        } else {
          setConnectionStatus('needs_reauth');
          onStatusChange?.(false);
          return false;
        }
      } else {
        // Connection successful - reset any recovery state
        resetRecoveryState();
        setConnectionStatus('connected');
        onStatusChange?.(true);
        return true;
      }
    } catch (error) {
      console.error('Error checking Drive connection:', error);
      // Only show error for owners
      if (isOrgOwner) {
        setConnectionStatus('needs_reauth');
        onStatusChange?.(false);
        return false;
      } else {
        setConnectionStatus('not_owner');
        onStatusChange?.(true);
        return true;
      }
    }
    return false;
  };

  useEffect(() => {
    // Initial check
    checkDriveConnection(true);

    // Set up periodic checking every 5 minutes
    const checkInterval = setInterval(() => {
      checkDriveConnection();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(checkInterval);
  }, [user, googleAccessToken]);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    lastCheckRef.current = 0; // Reset to allow immediate re-check after reconnection
    // Reset recovery state before reconnecting so fresh attempts can happen
    resetRecoveryState();
    try {
      const popup = window.open("about:blank", "_blank");
      await requestDriveAccess({ oauthWindow: popup });
      // Re-check repeatedly for a short window because OAuth popup completes asynchronously.
      const started = Date.now();
      const timer = window.setInterval(async () => {
        const connected = await checkDriveConnection(true);
        const timedOut = Date.now() - started > 30000;
        if (connected || timedOut) {
          window.clearInterval(timer);
        }
      }, 2000);
    } catch (error) {
      console.error('Error reconnecting to Drive:', error);
    } finally {
      setIsReconnecting(false);
    }
  };

  if (connectionStatus === 'checking' || connectionStatus === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
            <span className="text-xs text-muted-foreground hidden sm:inline">Checking...</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>Checking Google Drive connection</TooltipContent>
      </Tooltip>
    );
  }

  if (connectionStatus === 'connected') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10">
            <Cloud className="w-3.5 h-3.5 text-green-500" />
            <span className="text-xs text-green-600 dark:text-green-400 hidden sm:inline">Drive Connected</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>Google Drive is connected and working</TooltipContent>
      </Tooltip>
    );
  }

  if (connectionStatus === 'not_owner') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
            <Cloud className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground hidden sm:inline">Drive Managed</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>Drive access is managed by the workspace owner</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1.5 px-2 py-1 h-auto bg-destructive/10 hover:bg-destructive/20 text-destructive"
          onClick={handleReconnect}
          disabled={isReconnecting}
        >
          {isReconnecting ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CloudOff className="w-3.5 h-3.5" />
          )}
          <span className="text-xs hidden sm:inline">
            {isReconnecting ? "Reconnecting..." : "Reconnect Drive"}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isReconnecting 
          ? "Reconnecting to Google Drive..." 
          : "Google Drive access expired. Click to reconnect."}
      </TooltipContent>
    </Tooltip>
  );
};
