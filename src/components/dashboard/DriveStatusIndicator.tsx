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

  const { requestDriveAccess, user, googleAccessToken } = useAuth();
  const { resetRecoveryState, attemptRecovery } = useDriveRecovery();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isOrgOwner, setIsOrgOwner] = useState(false);
  const lastCheckRef = useRef<number>(0);

  const checkDriveConnection = async (forceCheck = false) => {
    if (!user) return;

    // Prevent checking more than once per minute unless forced
    const now = Date.now();
    if (!forceCheck && now - lastCheckRef.current < 60000) return;
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
        return;
      }

      const role =
        orgRes.members?.find((member) => String(member.id) === String(user.id))?.role || null;
      if (!role) {
        setConnectionStatus("needs_reauth");
        onStatusChange?.(false);
        return;
      }
      const userIsOwner = role === "owner";
      setIsOrgOwner(userIsOwner);

      // Only the org owner needs to have Drive connected
      if (!userIsOwner) {
        setConnectionStatus('not_owner');
        onStatusChange?.(true); // Non-owners don't need Drive access
        return;
      }

      // For the owner, check Drive connection
      const token = googleAccessToken || localStorage.getItem("google_access_token");
      if (!token) {
        setConnectionStatus('needs_reauth');
        onStatusChange?.(false);
        return;
      }

      // Make a simple API call to verify the token works
      const response = await invokeFunction('google-drive', {
        body: { action: 'list_folder', folderId: 'root' },
        headers: { "x-google-token": token },
      });

      if (response.error || response.data?.needsReauth || response.data?.ok === false || response.data?.error) {
        // Attempt silent recovery first
        const { recovered } = await attemptRecovery("Drive check failed", true);
        if (recovered) {
          setConnectionStatus('connected');
          onStatusChange?.(true);
        } else {
          setConnectionStatus('needs_reauth');
          onStatusChange?.(false);
        }
      } else {
        // Connection successful - reset any recovery state
        resetRecoveryState();
        setConnectionStatus('connected');
        onStatusChange?.(true);
      }
    } catch (error) {
      console.error('Error checking Drive connection:', error);
      // Only show error for owners
      if (isOrgOwner) {
        setConnectionStatus('needs_reauth');
        onStatusChange?.(false);
      } else {
        setConnectionStatus('not_owner');
        onStatusChange?.(true);
      }
    }
  };

  useEffect(() => {
    // Initial check
    checkDriveConnection(true);

    // Set up periodic checking every 5 minutes
    const checkInterval = setInterval(() => {
      checkDriveConnection();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(checkInterval);
  }, [user]);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    lastCheckRef.current = 0; // Reset to allow immediate re-check after reconnection
    // Reset recovery state before reconnecting so fresh attempts can happen
    resetRecoveryState();
    try {
      await requestDriveAccess();
      // The page will redirect for OAuth - no need to re-check here
    } catch (error) {
      console.error('Error reconnecting to Drive:', error);
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
