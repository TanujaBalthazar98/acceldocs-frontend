import { useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  createdTime?: string;
}

const GOOGLE_TOKEN_KEY = "google_access_token";

export const useGoogleDrive = () => {
  const { toast } = useToast();
  const { googleAccessToken, requestDriveAccess, user } = useAuth();
  const reauthInFlightRef = useRef(false);
  const isOrgOwnerRef = useRef<boolean | null>(null);

  const getGoogleToken = (): string | null => {
    // First try from context, then from localStorage
    const token = googleAccessToken || localStorage.getItem(GOOGLE_TOKEN_KEY);
    console.log("Google token available:", !!token);
    return token;
  };

  // Check if current user is the organization owner (only owners should be prompted for reauth)
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

  // Ensure session is fresh before making edge function calls
  const ensureFreshSession = async (): Promise<boolean> => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      // Try to refresh
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.log("Session refresh failed:", refreshError.message);
        return false;
      }
    }
    return true;
  };

  // Handle re-authentication - ONLY for org owners
  // Non-owners should never be prompted to reconnect Drive since only the owner's Drive is used
  const handleReauthRequired = async (): Promise<boolean> => {
    // Check if current user is org owner before prompting for reauth
    const isOwner = await checkIsOrgOwner();
    
    if (!isOwner) {
      // Non-owners should see a different message - they can't fix this themselves
      toast({
        title: "Drive access issue",
        description: "The workspace owner needs to reconnect Google Drive. Please contact your admin.",
        duration: 12000,
        variant: "destructive",
      });
      return false;
    }

    if (reauthInFlightRef.current) return false;
    reauthInFlightRef.current = true;

    toast({
      title: "Reconnect required",
      description: "Reconnecting to Google Drive to refresh your access…",
      duration: 12000,
      variant: "destructive",
    });

    const { error } = await requestDriveAccess();
    if (error) {
      reauthInFlightRef.current = false;
      toast({
        title: "Reconnect failed",
        description: error.message,
        duration: 12000,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const listFolder = async (
    folderId: string,
  ): Promise<{ files: DriveFile[] | null; needsDriveAccess?: boolean }> => {
    const token = getGoogleToken();

    // Ensure session is fresh
    const sessionValid = await ensureFreshSession();
    if (!sessionValid) {
      await handleReauthRequired();
      return { files: null, needsDriveAccess: true };
    }

    const invokeOptions = {
      body: {
        action: "list_folder",
        folderId,
      },
      ...(token
        ? {
            headers: {
              "x-google-token": token,
            },
          }
        : {}),
    };

    const { data, error } = await supabase.functions.invoke("google-drive", invokeOptions);

    if (error) {
      console.error("List folder error:", error);
      toast({
        title: "Failed to list folder",
        description: error.message,
        variant: "destructive",
        duration: 12000,
      });
      return { files: null };
    }

    // Check for reauth needed - automatically handle it
    if (data?.needsReauth) {
      await handleReauthRequired();
      return { files: null, needsDriveAccess: true };
    }

    // Check for scope/drive access needed
    if (data?.needsDriveAccess) {
      return { files: null, needsDriveAccess: true };
    }

    return { files: data?.files || [] };
  };

  const createFolder = async (
    name: string,
    parentFolderId: string,
  ): Promise<{ id: string; name: string } | null> => {
    const token = getGoogleToken();

    // Ensure session is fresh
    const sessionValid = await ensureFreshSession();
    if (!sessionValid) {
      await handleReauthRequired();
      return null;
    }

    const invokeOptions = {
      body: {
        action: "create_folder",
        name,
        parentFolderId,
      },
      ...(token
        ? {
            headers: {
              "x-google-token": token,
            },
          }
        : {}),
    };

    const { data, error } = await supabase.functions.invoke("google-drive", invokeOptions);

    if (error) {
      console.error("Create folder error:", error);
      toast({
        title: "Failed to create folder",
        description: error.message,
        variant: "destructive",
        duration: 12000,
      });
      return null;
    }

    if (data?.needsReauth) {
      await handleReauthRequired();
      return null;
    }

    if (data?.needsDriveAccess) {
      await handleReauthRequired();
      return null;
    }

    if (data?.error) {
      toast({
        title: "Failed to create folder",
        description: data.error,
        variant: "destructive",
        duration: 12000,
      });
      return null;
    }

    return data?.folder || null;
  };

  const createDoc = async (title: string, parentFolderId: string) => {
    const token = getGoogleToken();

    // Ensure session is fresh
    const sessionValid = await ensureFreshSession();
    if (!sessionValid) {
      await handleReauthRequired();
      return null;
    }

    const invokeOptions = {
      body: {
        action: "create_doc",
        title,
        parentFolderId,
      },
      ...(token
        ? {
            headers: {
              "x-google-token": token,
            },
          }
        : {}),
    };

    const { data, error } = await supabase.functions.invoke("google-drive", invokeOptions);

    if (error) {
      console.error("Create doc error:", error);
      toast({
        title: "Failed to create document",
        description: error.message,
        variant: "destructive",
        duration: 12000,
      });
      return null;
    }

    if (data?.needsReauth || data?.needsDriveAccess) {
      await handleReauthRequired();
      return null;
    }

    return data?.doc || null;
  };

  const trashFile = async (
    fileId: string,
  ): Promise<{ success: boolean; error?: string; errorCode?: string }> => {
    const token = getGoogleToken();

    // Ensure session is fresh
    const sessionValid = await ensureFreshSession();
    if (!sessionValid) {
      await handleReauthRequired();
      return { success: false, error: "Session expired", errorCode: "SESSION_EXPIRED" };
    }

    const invokeOptions = {
      body: {
        action: "trash_file",
        fileId,
      },
      ...(token
        ? {
            headers: {
              "x-google-token": token,
            },
          }
        : {}),
    };

    const { data, error } = await supabase.functions.invoke("google-drive", invokeOptions);

    if (error) {
      console.error("Trash file error:", error);
      return { success: false, error: error.message, errorCode: "INVOKE_ERROR" };
    }

    if (data?.needsReauth || data?.needsDriveAccess) {
      await handleReauthRequired();
      return { success: false, error: "Reconnect required", errorCode: "NEEDS_REAUTH" };
    }

    if (data?.error) {
      // Check for specific Google Drive error
      const errorReason = data.errorReason || "";
      return {
        success: false,
        error: data.error,
        errorCode: errorReason === "appNotAuthorizedToChild" ? "NOT_AUTHORIZED" : "DRIVE_ERROR",
      };
    }

    return { success: data?.success || false };
  };

  return { listFolder, createFolder, createDoc, trashFile, getGoogleToken };
};
