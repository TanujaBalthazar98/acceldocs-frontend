import { useState, useEffect, useRef } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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

  const { requestDriveAccess, user } = useAuth();
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
      // First check if the current user is the org owner
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, google_refresh_token_present')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile?.organization_id) {
        // User not in an org yet
        setConnectionStatus('not_owner');
        onStatusChange?.(true); // Don't block non-owners
        return;
      }

      // Check if user is the org owner
      const { data: org } = await supabase
        .from('organizations')
        .select('owner_id')
        .eq('id', profile.organization_id)
        .maybeSingle();

      const userIsOwner = org?.owner_id === user.id;
      setIsOrgOwner(userIsOwner);

      // Only the org owner needs to have Drive connected
      if (!userIsOwner) {
        setConnectionStatus('not_owner');
        onStatusChange?.(true); // Non-owners don't need Drive access
        return;
      }

      // For the owner, check Drive connection
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.provider_token;
      const hasRefreshToken = !!profile?.google_refresh_token_present;
      
      if (!token && !hasRefreshToken) {
        setConnectionStatus('needs_reauth');
        onStatusChange?.(false);
        return;
      }

      // Make a simple API call to verify the token works
      const response = await supabase.functions.invoke('google-drive', {
        body: { action: 'list_folder', folderId: 'root' }
      });

      if (response.error || response.data?.needsReauth) {
        // Attempt silent recovery first
        const { recovered } = await attemptRecovery("Drive check failed", true);
        if (recovered) {
          setConnectionStatus('connected');
          onStatusChange?.(true);
        } else {
          setConnectionStatus(hasRefreshToken ? 'connected' : 'needs_reauth');
          onStatusChange?.(hasRefreshToken);
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
