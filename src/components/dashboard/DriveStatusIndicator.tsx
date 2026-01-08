import { useState, useEffect } from "react";
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

export const DriveStatusIndicator = ({ onStatusChange }: DriveStatusIndicatorProps) => {
  const { requestDriveAccess, user } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const checkDriveConnection = async () => {
    if (!user) return;
    
    setIsChecking(true);
    try {
      // Try to list a folder to verify the token works
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.provider_token;
      
      if (!token) {
        setIsConnected(false);
        onStatusChange?.(false);
        return;
      }

      // Make a simple API call to verify the token
      const response = await supabase.functions.invoke('google-drive', {
        body: { action: 'list_folder', folderId: 'root' }
      });

      if (response.error || response.data?.needsReauth) {
        setIsConnected(false);
        onStatusChange?.(false);
      } else {
        setIsConnected(true);
        onStatusChange?.(true);
      }
    } catch (error) {
      console.error('Error checking Drive connection:', error);
      setIsConnected(false);
      onStatusChange?.(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkDriveConnection();
  }, [user]);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      await requestDriveAccess();
      // Re-check connection after a short delay
      setTimeout(() => {
        checkDriveConnection();
        setIsReconnecting(false);
      }, 2000);
    } catch (error) {
      console.error('Error reconnecting to Drive:', error);
      setIsReconnecting(false);
    }
  };

  if (isChecking || isConnected === null) {
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

  if (isConnected) {
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
