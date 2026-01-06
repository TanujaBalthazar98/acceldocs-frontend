import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

    // Subscribe to changes on join_requests for this user
    const channel = supabase
      .channel(`join-requests-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'join_requests',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const newRecord = payload.new as JoinRequestUpdate;
          
          // Fetch organization name
          const { data: org } = await supabase
            .from("organizations")
            .select("name")
            .eq("id", newRecord.organization_id)
            .single();
          
          const orgName = org?.name || "the workspace";
          
          if (newRecord.status === 'approved') {
            setApprovedOrgId(newRecord.organization_id);
            setApprovedOrgName(orgName);
            
            toast({
              title: "Request Approved! 🎉",
              description: `Your request to join ${orgName} has been approved. Click to switch workspaces.`,
              duration: 10000,
            });
          } else if (newRecord.status === 'rejected') {
            toast({
              title: "Request Declined",
              description: `Your request to join ${orgName} was not approved.`,
              variant: "destructive",
              duration: 8000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, toast]);

  const switchToApprovedWorkspace = async () => {
    if (!approvedOrgId || !userId) return false;
    
    // The approve_join_request function already updates the profile
    // Just need to reload the page to pick up the new org
    window.location.reload();
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
