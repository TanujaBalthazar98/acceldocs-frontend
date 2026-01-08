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

interface DriveStatusIndicatorProps {
  onStatusChange?: (connected: boolean) => void;
}

type ConnectionStatus = 'connected' | 'disconnected' | 'needs_reauth' | 'checking' | null;

export const DriveStatusIndicator = ({ onStatusChange }: DriveStatusIndicatorProps) => {
  const { requestDriveAccess, user } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const hasCheckedRef = useRef(false);

  const checkDriveConnection = async () => {
    if (!user || hasCheckedRef.current) return;
    hasCheckedRef.current = true;
    
    setConnectionStatus('checking');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.provider_token;
      
      // Check if user has a refresh token stored
      const { data: profile } = await supabase
        .from('profiles')
        .select('google_refresh_token')
        .eq('id', user.id)
        .maybeSingle();

      const hasRefreshToken = !!profile?.google_refresh_token;
      
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
        setConnectionStatus(hasRefreshToken ? 'connected' : 'needs_reauth');
        onStatusChange?.(hasRefreshToken);
      } else {
        setConnectionStatus('connected');
        onStatusChange?.(true);
      }
    } catch (error) {
      console.error('Error checking Drive connection:', error);
      setConnectionStatus('needs_reauth');
      onStatusChange?.(false);
    }
  };

  useEffect(() => {
    checkDriveConnection();
  }, [user]);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    hasCheckedRef.current = false;
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
