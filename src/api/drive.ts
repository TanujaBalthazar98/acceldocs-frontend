import { API_BASE_URL, fetchOrThrow, getAuthToken } from "./client";

const DRIVE_ERROR_MESSAGES: Record<string, string> = {
  google_token_expired: "Your Google account connection has expired. Please reconnect.",
  drive_file_not_found: "This file could not be found in Google Drive. It may have been deleted or moved.",
  drive_permission_denied: "You don't have permission to access this file in Google Drive.",
  drive_quota_exceeded: "Google Drive API quota exceeded. Please try again later.",
  drive_network_error: "Network error connecting to Google Drive. Check your connection.",
};

/** Map a structured Drive error code (from the backend detail field) to a user-friendly message. */
export function driveErrorMessage(err: Error): string {
  const msg = err.message ?? "";
  if (msg.startsWith("drive_api_error:")) {
    return "Google Drive is temporarily unavailable. Please try again.";
  }
  return DRIVE_ERROR_MESSAGES[msg] ?? msg;
}
import { ORG_ID_KEY } from "../lib/api/client";
import type { DriveStatus, ImportTargetType, LocalImportResult, ScanResult, SyncResult } from "./types";

function getUploadBaseUrl(): string {
  if (typeof window === "undefined") return API_BASE_URL;
  const isLocalHttps =
    window.location.protocol === "https:" &&
    /^(http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/.test(API_BASE_URL);
  return isLocalHttps ? "" : API_BASE_URL;
}

function getSelectedOrgId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(ORG_ID_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export interface LocalImportProgress {
  phase: "uploading" | "processing";
  loadedBytes: number;
  totalBytes: number | null;
}

export const driveApi = {
  status: (): Promise<DriveStatus> =>
    fetchOrThrow<DriveStatus>("/api/drive/status"),

  scan: (
    folderId: string,
    parentSectionId?: number | null,
    targetType?: ImportTargetType | null,
  ): Promise<ScanResult> =>
    fetchOrThrow<ScanResult>("/api/drive/scan", {
      method: "POST",
      body: JSON.stringify({
        folder_id: folderId,
        parent_section_id: parentSectionId ?? null,
        target_type: targetType ?? null,
      }),
    }),

  importLocal: async (params: {
    targetSectionId: number;
    targetType?: ImportTargetType | null;
    mode: "files" | "folder";
    files: File[];
    relativePaths?: string[];
    onProgress?: (progress: LocalImportProgress) => void;
  }): Promise<LocalImportResult> => {
    if (!params.files.length) {
      throw new Error("Select at least one file to import.");
    }
    const token = getAuthToken();
    if (!token) {
      throw new Error("You must be signed in to import files.");
    }

    const body = new FormData();
    body.append("target_section_id", String(params.targetSectionId));
    body.append("mode", params.mode);
    if (params.targetType) {
      body.append("target_type", params.targetType);
    }
    for (const file of params.files) {
      body.append("files", file);
    }
    if (params.relativePaths && params.relativePaths.length) {
      body.append("relative_paths_json", JSON.stringify(params.relativePaths));
    }

    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    const selectedOrgId = getSelectedOrgId();
    if (selectedOrgId !== null) {
      headers["X-Org-Id"] = String(selectedOrgId);
    }

    return new Promise<LocalImportResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${getUploadBaseUrl()}/api/drive/import/local`);
      for (const [key, value] of Object.entries(headers)) {
        xhr.setRequestHeader(key, value);
      }

      xhr.upload.onprogress = (event) => {
        if (!params.onProgress) return;
        params.onProgress({
          phase: "uploading",
          loadedBytes: event.loaded,
          totalBytes: event.lengthComputable ? event.total : null,
        });
      };

      xhr.upload.onload = () => {
        if (!params.onProgress) return;
        params.onProgress({
          phase: "processing",
          loadedBytes: 0,
          totalBytes: null,
        });
      };

      xhr.onerror = () => reject(new Error("Network error while uploading import files."));
      xhr.onabort = () => reject(new Error("Import upload was cancelled."));
      xhr.ontimeout = () => reject(new Error("Import upload timed out."));

      xhr.onload = () => {
        let payload: any = {};
        try {
          payload = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        } catch {
          payload = {};
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(payload as LocalImportResult);
          return;
        }
        reject(new Error(payload?.detail || payload?.message || `Import failed (${xhr.status})`));
      };

      xhr.send(body);
    });
  },

  syncAll: (): Promise<SyncResult> =>
    fetchOrThrow<SyncResult>("/api/drive/sync", { method: "POST" }),

  ensureDocAccess: (docId: string): Promise<{ ok: boolean; url?: string; error?: string }> =>
    fetchOrThrow<{ ok: boolean; url?: string; error?: string }>("/api/drive/ensure-doc-access", {
      method: "POST",
      body: JSON.stringify({ doc_id: docId }),
    }),

  updateRootFolder: (
    folderId: string,
  ): Promise<{
    ok: boolean;
    drive_folder_id: string;
    previous_drive_folder_id: string | null;
    folder_name: string | null;
    acl_sync: { ok: boolean; status?: string; synced?: number; failed?: number };
  }> =>
    fetchOrThrow("/api/drive/root-folder", {
      method: "PATCH",
      body: JSON.stringify({ folder_id: folderId }),
    }),
};
