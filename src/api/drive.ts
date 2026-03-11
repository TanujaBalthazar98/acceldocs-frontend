import { fetchOrThrow } from "./client";
import type { DriveStatus, ScanResult, SyncResult } from "./types";

export const driveApi = {
  status: (): Promise<DriveStatus> =>
    fetchOrThrow<DriveStatus>("/api/drive/status"),

  scan: (folderId: string, parentSectionId?: number | null): Promise<ScanResult> =>
    fetchOrThrow<ScanResult>("/api/drive/scan", {
      method: "POST",
      body: JSON.stringify({
        folder_id: folderId,
        parent_section_id: parentSectionId ?? null,
      }),
    }),

  syncAll: (): Promise<SyncResult> =>
    fetchOrThrow<SyncResult>("/api/drive/sync", { method: "POST" }),
};
