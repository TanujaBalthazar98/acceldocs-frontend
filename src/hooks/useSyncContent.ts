import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useDriveRecovery } from "@/hooks/useDriveRecovery";

const GOOGLE_TOKEN_KEY = "google_access_token";

export const useSyncContent = () => {
  const { toast } = useToast();
  const { googleAccessToken } = useAuth();
  const { attemptRecovery, isInCooldown } = useDriveRecovery();
  const [syncing, setSyncing] = useState(false);

  const getGoogleToken = (): string | null => {
    return googleAccessToken || localStorage.getItem(GOOGLE_TOKEN_KEY);
  };

  const syncDocument = async (documentId: string, googleDocId: string): Promise<string | null> => {
    const token = getGoogleToken();
    
    // Allow calls even without token - backend can use owner's refresh token
    setSyncing(true);
    try {
      const invokeOptions = {
        body: {
          action: "sync_doc_content",
          documentId,
          googleDocId,
        },
        ...(token ? { headers: { "x-google-token": token } } : {}),
      };

      const { data, error } = await supabase.functions.invoke("google-drive", invokeOptions);

      if (error) {
        console.error("Sync error:", error);
        
        // Try recovery if not in cooldown
        if (!isInCooldown()) {
          const recovery = await attemptRecovery("sync document");
          if (recovery.recovered && recovery.shouldRetry) {
            // Retry the call once after successful recovery
            const retryResult = await supabase.functions.invoke("google-drive", invokeOptions);
            if (!retryResult.error && !retryResult.data?.needsReauth) {
              toast({
                title: "Content synced",
                description: "Document content has been updated.",
              });
              return retryResult.data?.html || null;
            }
          }
        }

        toast({
          title: "Sync failed",
          description: error.message,
          variant: "destructive",
          duration: 12000,
        });
        return null;
      }

      if (data?.needsReauth) {
        // Try automatic recovery
        if (!isInCooldown()) {
          const recovery = await attemptRecovery("sync document");
          if (recovery.recovered && recovery.shouldRetry) {
            const retryResult = await supabase.functions.invoke("google-drive", invokeOptions);
            if (!retryResult.error && !retryResult.data?.needsReauth) {
              toast({
                title: "Content synced",
                description: "Document content has been updated.",
              });
              return retryResult.data?.html || null;
            }
          }
        }
        // Recovery already shows appropriate toast
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
        duration: 12000,
      });
      return null;
    } finally {
      setSyncing(false);
    }
  };

  return { syncDocument, syncing };
};
