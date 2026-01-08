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
  const { googleAccessToken, requestDriveAccess, signOut } = useAuth();

  const getGoogleToken = (): string | null => {
    // First try from context, then from localStorage
    const token = googleAccessToken || localStorage.getItem(GOOGLE_TOKEN_KEY);
    console.log("Google token available:", !!token);
    return token;
  };

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

  // Handle re-authentication automatically: prompt user to sign out and back in
  const handleReauthRequired = () => {
    toast({
      title: "Session expired",
      description: "Your Google session has expired. Signing you out so you can sign back in.",
      variant: "destructive",
    });
    // Give user time to read the message, then sign out
    setTimeout(() => {
      signOut();
    }, 2000);
  };

  const listFolder = async (folderId: string): Promise<{ files: DriveFile[] | null; needsDriveAccess?: boolean }> => {
    const token = getGoogleToken();
    if (!token) {
      toast({
        title: "Authentication required",
        description: "Please sign in with Google again to access Drive.",
        variant: "destructive",
      });
      return { files: null };
    }

    // Ensure session is fresh
    const sessionValid = await ensureFreshSession();
    if (!sessionValid) {
      handleReauthRequired();
      return { files: null };
    }

    const { data, error } = await supabase.functions.invoke("google-drive", {
      body: {
        action: "list_folder",
        folderId,
      },
      headers: {
        "x-google-token": token,
      },
    });

    if (error) {
      console.error("List folder error:", error);
      toast({
        title: "Failed to list folder",
        description: error.message,
        variant: "destructive",
      });
      return { files: null };
    }

    // Check for reauth needed - automatically handle it
    if (data?.needsReauth) {
      handleReauthRequired();
      return { files: null, needsDriveAccess: true };
    }

    // Check for scope/drive access needed
    if (data?.needsDriveAccess) {
      return { files: null, needsDriveAccess: true };
    }

    return { files: data?.files || [] };
  };

  const createFolder = async (name: string, parentFolderId: string): Promise<{ id: string; name: string } | null> => {
    const token = getGoogleToken();
    if (!token) {
      toast({
        title: "Authentication required",
        description: "Please sign in with Google again to access Drive.",
        variant: "destructive",
      });
      return null;
    }

    // Ensure session is fresh
    const sessionValid = await ensureFreshSession();
    if (!sessionValid) {
      handleReauthRequired();
      return null;
    }

    const { data, error } = await supabase.functions.invoke("google-drive", {
      body: {
        action: "create_folder",
        name,
        parentFolderId,
      },
      headers: {
        "x-google-token": token,
      },
    });

    if (error) {
      console.error("Create folder error:", error);
      toast({
        title: "Failed to create folder",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    if (data?.needsReauth) {
      handleReauthRequired();
      return null;
    }
    
    if (data?.error) {
      toast({
        title: "Failed to create folder",
        description: data.error,
        variant: "destructive",
      });
      return null;
    }

    return data?.folder || null;
  };

  const createDoc = async (title: string, parentFolderId: string) => {
    const token = getGoogleToken();
    if (!token) {
      toast({
        title: "Authentication required",
        description: "Please sign in with Google again to access Drive.",
        variant: "destructive",
      });
      return null;
    }

    // Ensure session is fresh
    const sessionValid = await ensureFreshSession();
    if (!sessionValid) {
      handleReauthRequired();
      return null;
    }

    const { data, error } = await supabase.functions.invoke("google-drive", {
      body: {
        action: "create_doc",
        title,
        parentFolderId,
      },
      headers: {
        "x-google-token": token,
      },
    });

    if (error) {
      console.error("Create doc error:", error);
      toast({
        title: "Failed to create document",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    if (data?.needsReauth) {
      handleReauthRequired();
      return null;
    }

    return data?.doc || null;
  };

  const trashFile = async (fileId: string): Promise<{ success: boolean; error?: string; errorCode?: string }> => {
    const token = getGoogleToken();
    if (!token) {
      console.log("No Google token for trash operation");
      return { success: false, error: "No authentication token", errorCode: "NO_TOKEN" };
    }

    // Ensure session is fresh
    const sessionValid = await ensureFreshSession();
    if (!sessionValid) {
      handleReauthRequired();
      return { success: false, error: "Session expired", errorCode: "SESSION_EXPIRED" };
    }

    const { data, error } = await supabase.functions.invoke("google-drive", {
      body: {
        action: "trash_file",
        fileId,
      },
      headers: {
        "x-google-token": token,
      },
    });

    if (error) {
      console.error("Trash file error:", error);
      return { success: false, error: error.message, errorCode: "INVOKE_ERROR" };
    }

    if (data?.needsReauth) {
      handleReauthRequired();
      return { success: false, error: "Session expired", errorCode: "NEEDS_REAUTH" };
    }

    if (data?.error) {
      // Check for specific Google Drive error
      const errorReason = data.errorReason || "";
      return { 
        success: false, 
        error: data.error, 
        errorCode: errorReason === "appNotAuthorizedToChild" ? "NOT_AUTHORIZED" : "DRIVE_ERROR" 
      };
    }

    return { success: data?.success || false };
  };

  return { listFolder, createFolder, createDoc, trashFile, getGoogleToken };
};
