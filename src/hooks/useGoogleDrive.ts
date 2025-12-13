import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useGoogleDrive = () => {
  const { toast } = useToast();

  const getGoogleToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.provider_token || null;
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

    const { data: { session } } = await supabase.auth.getSession();
    
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

  return { createFolder, createDoc };
};
