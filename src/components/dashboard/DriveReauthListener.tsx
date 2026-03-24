import { useEffect } from "react";
import { useDriveRecovery } from "@/hooks/useDriveRecovery";
import { useDriveAuth } from "@/hooks/useDriveAuth";

const DRIVE_AUTO_RECONNECT_KEY = "drive_auto_reconnect";

export const DriveReauthListener = () => {
  const { attemptRecovery } = useDriveRecovery();
  const { requestDriveAccess } = useDriveAuth();

  useEffect(() => {
    const handler = async () => {
      const autoReconnect = localStorage.getItem(DRIVE_AUTO_RECONNECT_KEY) === "1";
      if (autoReconnect) {
        await requestDriveAccess();
        return;
      }
      await attemptRecovery("Google Drive access expired");
    };

    window.addEventListener("drive:reauth", handler as EventListener);
    return () => window.removeEventListener("drive:reauth", handler as EventListener);
  }, [attemptRecovery, requestDriveAccess]);

  return null;
};
