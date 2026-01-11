import { useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// Centralized Drive failure recovery:
// 1. Silent token refresh attempt
// 2. For owners: single reconnect prompt (no spam)
// 3. For non-owners: clear "ask admin" message (once per session)

const RECOVERY_COOLDOWN_MS = 30000; // 30 seconds between recovery attempts
const NON_OWNER_NOTIFIED_KEY = "drive_non_owner_notified";

export interface DriveRecoveryState {
  isRecovering: boolean;
  lastRecoveryAttempt: number | null;
  ownerNotified: boolean;
}

export const useDriveRecovery = () => {
  const { toast } = useToast();
  const { requestDriveAccess, user } = useAuth();
  
  const isRecoveringRef = useRef(false);
  const lastRecoveryRef = useRef<number | null>(null);
  const ownerNotifiedRef = useRef(false);
  const isOrgOwnerRef = useRef<boolean | null>(null);

  // Check if current user is the organization owner
  const checkIsOrgOwner = useCallback(async (): Promise<boolean> => {
    if (isOrgOwnerRef.current !== null) return isOrgOwnerRef.current;
    if (!user) return false;

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.organization_id) {
        isOrgOwnerRef.current = false;
        return false;
      }

      const { data: org } = await supabase
        .from("organizations")
        .select("owner_id")
        .eq("id", profile.organization_id)
        .maybeSingle();

      isOrgOwnerRef.current = org?.owner_id === user.id;
      return isOrgOwnerRef.current;
    } catch {
      return false;
    }
  }, [user]);

  // Attempt silent session refresh
  const attemptSilentRefresh = async (): Promise<boolean> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        const { error: refreshError, data } = await supabase.auth.refreshSession();
        if (refreshError || !data.session) {
          console.log("Silent session refresh failed:", refreshError?.message);
          return false;
        }
        console.log("Silent session refresh successful");
        return true;
      }
      return true;
    } catch (err) {
      console.error("Silent refresh error:", err);
      return false;
    }
  };

  // Main recovery function - handles all Drive auth failures
  const attemptRecovery = useCallback(async (errorContext?: string): Promise<{
    recovered: boolean;
    shouldRetry: boolean;
    isOwner: boolean;
  }> => {
    // Prevent concurrent recovery attempts
    if (isRecoveringRef.current) {
      return { recovered: false, shouldRetry: false, isOwner: false };
    }

    // Check cooldown to prevent spam
    const now = Date.now();
    if (lastRecoveryRef.current && (now - lastRecoveryRef.current) < RECOVERY_COOLDOWN_MS) {
      console.log("Recovery on cooldown, skipping");
      return { recovered: false, shouldRetry: false, isOwner: isOrgOwnerRef.current ?? false };
    }

    isRecoveringRef.current = true;
    lastRecoveryRef.current = now;

    try {
      // Step 1: Try silent session refresh
      const refreshed = await attemptSilentRefresh();
      if (refreshed) {
        // Try to verify the token works by making a simple call
        const verifyResponse = await supabase.functions.invoke("google-drive", {
          body: { action: "list_folder", folderId: "root" }
        });

        if (!verifyResponse.error && !verifyResponse.data?.needsReauth) {
          console.log("Silent recovery successful");
          isRecoveringRef.current = false;
          return { recovered: true, shouldRetry: true, isOwner: isOrgOwnerRef.current ?? false };
        }
      }

      // Step 2: Silent refresh didn't work - check if user is owner
      const isOwner = await checkIsOrgOwner();

      if (!isOwner) {
        // Non-owner: show "ask admin" message once per session
        const alreadyNotified = sessionStorage.getItem(NON_OWNER_NOTIFIED_KEY) === "1";
        
        if (!alreadyNotified) {
          sessionStorage.setItem(NON_OWNER_NOTIFIED_KEY, "1");
          toast({
            title: "Drive access issue",
            description: "The workspace owner needs to reconnect Google Drive. Please contact your admin.",
            duration: 12000,
            variant: "destructive",
          });
        }
        
        isRecoveringRef.current = false;
        return { recovered: false, shouldRetry: false, isOwner: false };
      }

      // Step 3: Owner - show reconnect prompt (once)
      if (!ownerNotifiedRef.current) {
        ownerNotifiedRef.current = true;
        
        toast({
          title: "Google Drive access expired",
          description: "Reconnecting to restore file access...",
          duration: 5000,
        });

        // Auto-trigger reconnect flow for owner
        const { error } = await requestDriveAccess();
        
        if (error) {
          toast({
            title: "Reconnect failed",
            description: error.message,
            duration: 12000,
            variant: "destructive",
          });
          isRecoveringRef.current = false;
          return { recovered: false, shouldRetry: false, isOwner: true };
        }
        
        // requestDriveAccess triggers a redirect, so we won't reach here normally
        isRecoveringRef.current = false;
        return { recovered: false, shouldRetry: false, isOwner: true };
      }

      // Already notified owner, don't spam
      isRecoveringRef.current = false;
      return { recovered: false, shouldRetry: false, isOwner: true };

    } catch (err) {
      console.error("Recovery attempt failed:", err);
      isRecoveringRef.current = false;
      return { recovered: false, shouldRetry: false, isOwner: isOrgOwnerRef.current ?? false };
    }
  }, [checkIsOrgOwner, requestDriveAccess, toast]);

  // Reset state (e.g., after successful reconnect)
  const resetRecoveryState = useCallback(() => {
    isRecoveringRef.current = false;
    lastRecoveryRef.current = null;
    ownerNotifiedRef.current = false;
    sessionStorage.removeItem(NON_OWNER_NOTIFIED_KEY);
  }, []);

  // Check if we're in a recovery cooldown
  const isInCooldown = useCallback((): boolean => {
    if (!lastRecoveryRef.current) return false;
    return (Date.now() - lastRecoveryRef.current) < RECOVERY_COOLDOWN_MS;
  }, []);

  return {
    attemptRecovery,
    resetRecoveryState,
    isInCooldown,
    checkIsOrgOwner,
  };
};
