import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const GOOGLE_TOKEN_KEY = "google_access_token";

export const useSyncContent = () => {
  const { toast } = useToast();
  const { googleAccessToken } = useAuth();
  const [syncing, setSyncing] = useState(false);

  const getGoogleToken = (): string | null => {
    return googleAccessToken || localStorage.getItem(GOOGLE_TOKEN_KEY);
  };

  const syncDocument = async (documentId: string, googleDocId: string): Promise<string | null> => {
    const token = getGoogleToken();
    if (!token) {
      toast({
        title: "Authentication required",
        description: "Please reconnect to Google Drive to sync content.",
        variant: "destructive",
      });
      return null;
    }

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive", {
        body: {
          action: "sync_doc_content",
          documentId,
          googleDocId,
        },
        headers: {
          "x-google-token": token,
        },
      });

      if (error) {
        console.error("Sync error:", error);
        toast({
          title: "Sync failed",
          description: error.message,
          variant: "destructive",
        });
        return null;
      }

      if (data?.needsReauth) {
        toast({
          title: "Re-authentication required",
          description: "Please reconnect to Google Drive.",
          variant: "destructive",
        });
        return null;
      }

      toast({
        title: "Content synced",
        description: "Document content has been updated.",
      });

      return data?.html || null;
    } catch (err) {
      console.error("Sync error:", err);
      toast({
        title: "Sync failed",
        description: "An error occurred while syncing content.",
        variant: "destructive",
      });
      return null;
    } finally {
      setSyncing(false);
    }
  };

  return { syncDocument, syncing };
};
