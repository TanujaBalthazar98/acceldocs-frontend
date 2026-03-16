import { driveApi } from "@/api/drive";
import { toast } from "@/hooks/use-toast";

export async function openGoogleDocWithAcl(googleDocId: string): Promise<void> {
  const trimmedId = (googleDocId || "").trim();
  if (!trimmedId) return;

  try {
    const result = await driveApi.ensureDocAccess(trimmedId);
    if (!result?.ok || !result?.url) {
      throw new Error(result?.error || "Unable to grant Google Docs access");
    }

    window.open(result.url, "_blank", "noopener,noreferrer");
  } catch (error) {
    console.error("Failed to open Google Doc with ACL sync:", error);
    toast({
      title: "Google Doc access required",
      description:
        "Could not grant access automatically. Ask the workspace owner/admin to sync Drive permissions and try again.",
      variant: "destructive",
    });
  }
}
