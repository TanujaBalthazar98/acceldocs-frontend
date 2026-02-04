import { supabase, IS_SUPABASE_CONFIGURED } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useDriveRecovery } from "@/hooks/useDriveRecovery";

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
  const { googleAccessToken } = useAuth();
  const { attemptRecovery, isInCooldown } = useDriveRecovery();

  const getGoogleToken = (): string | null => {
    // First try from context, then from localStorage
    const token = googleAccessToken || localStorage.getItem(GOOGLE_TOKEN_KEY);
    console.log("Google token available:", !!token);
    return token;
  };

  // Centralized Drive call wrapper with automatic recovery
  const invokeDriveFunction = async <T>(
    body: Record<string, unknown>,
    errorMessage: string
  ): Promise<{ data: T | null; needsDriveAccess?: boolean }> => {
    if (!IS_SUPABASE_CONFIGURED) {
      toast({
        title: "Supabase config missing",
        description: "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY).",
        variant: "destructive",
        duration: 12000,
      });
      return { data: null };
    }

    const token = getGoogleToken();

    const invokeOptions = {
      body,
      ...(token ? { headers: { "x-google-token": token } } : {}),
    };

    const { data, error } = await supabase.functions.invoke("google-drive", invokeOptions);

    // Handle invoke-level errors
    if (error) {
      const action = body.action as string | undefined;
      const errorStatus = (error as { context?: { status?: number } })?.context?.status;
      const errorBody = (error as { context?: { body?: string } })?.context?.body;
      const isNotFound =
        errorStatus === 404 ||
        (typeof errorBody === "string" && errorBody.includes("File not found")) ||
        (typeof errorBody === "string" && errorBody.includes("\"notFound\""));
      if (action === "trash_file" && isNotFound) {
        return { data: { success: true, alreadyDeleted: true } as T };
      }

      console.error(`${errorMessage}:`, error);
      
      // Try recovery if not in cooldown
      if (!isInCooldown()) {
        const recovery = await attemptRecovery(errorMessage);
        if (recovery.recovered && recovery.shouldRetry) {
          // Retry the call once after successful recovery
          const retryResult = await supabase.functions.invoke("google-drive", invokeOptions);
          if (!retryResult.error && !retryResult.data?.needsReauth) {
            return { data: retryResult.data as T };
          }
        }
      }

      toast({
        title: errorMessage,
        description: error.message,
        variant: "destructive",
        duration: 12000,
      });
      return { data: null };
    }

    // Handle Drive-specific auth errors (needsReauth, needsDriveAccess)
    if (data?.needsReauth || data?.needsDriveAccess) {
      if (!isInCooldown()) {
        const recovery = await attemptRecovery(data?.error || errorMessage);
        if (recovery.recovered && recovery.shouldRetry) {
          // Retry once after recovery
          const retryResult = await supabase.functions.invoke("google-drive", invokeOptions);
          if (!retryResult.error && !retryResult.data?.needsReauth) {
            return { data: retryResult.data as T };
          }
        }
      }
      return { data: null, needsDriveAccess: true };
    }

    // Handle API-level errors from Drive
    if (data?.error) {
      // Check for auth-related errors that need recovery
      const isAuthError = 
        data.error.includes("401") || 
        data.error.includes("403") ||
        data.error.includes("invalid_grant") ||
        data.error.includes("Token has been expired");

      if (isAuthError && !isInCooldown()) {
        const recovery = await attemptRecovery(data.error);
        if (recovery.recovered && recovery.shouldRetry) {
          const retryResult = await supabase.functions.invoke("google-drive", invokeOptions);
          if (!retryResult.error && !retryResult.data?.error) {
            return { data: retryResult.data as T };
          }
        }
      }

      toast({
        title: errorMessage,
        description: data.error,
        variant: "destructive",
        duration: 12000,
      });
      return { data: null };
    }

    return { data: data as T };
  };

  const listFolder = async (
    folderId: string,
  ): Promise<{ files: DriveFile[] | null; needsDriveAccess?: boolean }> => {
    const result = await invokeDriveFunction<{ files: DriveFile[] }>(
      { action: "list_folder", folderId },
      "Failed to list folder"
    );
    
    if (result.needsDriveAccess) {
      return { files: null, needsDriveAccess: true };
    }
    
    return { files: result.data?.files || [] };
  };

  const checkFolderAccess = async (
    folderId: string,
    projectId?: string,
  ): Promise<{ exists: boolean; needsDriveAccess?: boolean; error?: string; errorCode?: string }> => {
    const token = getGoogleToken();
    const invokeOptions = {
      body: { action: "list_folder", folderId, ...(projectId ? { projectId } : {}) },
      ...(token ? { headers: { "x-google-token": token } } : {}),
    };

    const { data, error } = await supabase.functions.invoke("google-drive", invokeOptions);

    if (error) {
      return { exists: false, error: error.message, errorCode: "INVOKE_ERROR" };
    }

    if (data?.needsDriveAccess || data?.needsReauth) {
      return { exists: false, needsDriveAccess: true, errorCode: "NEEDS_REAUTH" };
    }

    if (data?.errorCode === "FOLDER_NOT_ACCESSIBLE") {
      return { exists: false, error: data?.error, errorCode: "FOLDER_NOT_ACCESSIBLE" };
    }

    if (data?.error) {
      return { exists: false, error: data?.error, errorCode: "DRIVE_ERROR" };
    }

    return { exists: true };
  };

  const createFolder = async (
    name: string,
    parentFolderId: string,
  ): Promise<{ id: string; name: string } | null> => {
    const result = await invokeDriveFunction<{ folder: { id: string; name: string } }>(
      { action: "create_folder", name, parentFolderId },
      "Failed to create folder"
    );
    
    return result.data?.folder || null;
  };

  const createDoc = async (title: string, parentFolderId: string) => {
    const result = await invokeDriveFunction<{ doc: { id: string; name: string } }>(
      { action: "create_doc", title, parentFolderId },
      "Failed to create document"
    );
    
    return result.data?.doc || null;
  };

  const moveFile = async (
    fileId: string,
    targetFolderId: string,
    projectId?: string,
  ): Promise<{ success: boolean; alreadyInFolder?: boolean; error?: string }> => {
    const result = await invokeDriveFunction<{ success: boolean; alreadyInFolder?: boolean; error?: string }>(
      { action: "move_file", fileId, targetFolderId, ...(projectId ? { projectId } : {}) },
      "Failed to move file"
    );

    if (result.needsDriveAccess) {
      return { success: false, error: "Reconnect required" };
    }

    if (!result.data) {
      return { success: false, error: "Move failed" };
    }

    if (result.data.error) {
      return { success: false, error: result.data.error };
    }

    return result.data;
  };

  const trashFile = async (
    fileId: string,
  ): Promise<{ success: boolean; alreadyDeleted?: boolean; error?: string; errorCode?: string }> => {
    const result = await invokeDriveFunction<{ success: boolean; error?: string; errorReason?: string }>(
      { action: "trash_file", fileId },
      "Failed to trash file"
    );
    
    if (result.needsDriveAccess) {
      return { success: false, error: "Reconnect required", errorCode: "NEEDS_REAUTH" };
    }
    
    if (!result.data) {
      return { success: false, error: "Operation failed", errorCode: "UNKNOWN" };
    }

    if (result.data.error) {
      const errorReason = result.data.errorReason || "";
      return {
        success: false,
        error: result.data.error,
        errorCode:
          errorReason === "appNotAuthorizedToChild"
            ? "NOT_AUTHORIZED"
            : errorReason === "notFound"
              ? "NOT_FOUND"
              : "DRIVE_ERROR",
      };
    }

    if ((result.data as { alreadyDeleted?: boolean })?.alreadyDeleted) {
      return { success: true, alreadyDeleted: true };
    }

    return { success: result.data.success || false };
  };

  return { listFolder, checkFolderAccess, createFolder, createDoc, moveFile, trashFile, getGoogleToken };
};
