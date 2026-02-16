import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface JoinRequestUpdate {
  id: string;
  status: string;
  organization_id: string;
  organization_name?: string;
}

export const useJoinRequestNotifications = (userId: string | undefined) => {
  const { toast } = useToast();
  const [approvedOrgId, setApprovedOrgId] = useState<string | null>(null);
  const [approvedOrgName, setApprovedOrgName] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    // Supabase realtime retired; no-op in Strapi mode.
    return;

    // Subscribe to changes on join_requests for this user
  }, [userId, toast]);

  const switchToApprovedWorkspace = async () => {
    if (!approvedOrgId || !userId) return false;
    
    // The approve_join_request function already updates the profile
    // Return true to signal the caller should refetch data (no hard reload needed)
    return true;
  };

  const clearApproval = () => {
    setApprovedOrgId(null);
    setApprovedOrgName(null);
  };

  return {
    approvedOrgId,
    approvedOrgName,
    switchToApprovedWorkspace,
    clearApproval,
  };
};
