import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  createdTime?: string;
}

export const useGoogleDrive = () => {
  const { toast } = useToast();

  const getGoogleToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    console.log("Session provider_token exists:", !!session?.provider_token);
    console.log("Session provider_refresh_token exists:", !!session?.provider_refresh_token);
    return session?.provider_token || null;
  };

  const listFolder = async (folderId: string): Promise<{ files: DriveFile[] | null; needsDriveAccess?: boolean }> => {
    const token = await getGoogleToken();
    if (!token) {
      toast({
        title: "Authentication required",
        description: "Please sign in with Google again to access Drive.",
        variant: "destructive",
      });
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

    // Check for scope/drive access needed
    if (data?.needsDriveAccess) {
      return { files: null, needsDriveAccess: true };
    }

    return { files: data?.files || [] };
  };

  const createFolder = async (name: string, parentFolderId: string) => {
    const token = await getGoogleToken();
    if (!token) {
      toast({
        title: "Authentication required",
        description: "Please sign in with Google again to access Drive.",
        variant: "destructive",
      });
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
      toast({
        title: "Re-authentication required",
        description: "Please sign out and sign in again with Google.",
        variant: "destructive",
      });
      return null;
    }

    return data?.folder || null;
  };

  const createDoc = async (title: string, parentFolderId: string) => {
    const token = await getGoogleToken();
    if (!token) {
      toast({
        title: "Authentication required",
        description: "Please sign in with Google again to access Drive.",
        variant: "destructive",
      });
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
      toast({
        title: "Re-authentication required",
        description: "Please sign out and sign in again with Google.",
        variant: "destructive",
      });
      return null;
    }

    return data?.doc || null;
  };

  return { listFolder, createFolder, createDoc, getGoogleToken };
};
