import { API_BASE_URL, fetchOrThrow, getAuthToken } from "./client";
import type { DriveStatus, ImportTargetType, LocalImportResult, ScanResult, SyncResult } from "./types";

const ORG_ID_KEY = "acceldocs_current_org_id";

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

    const response = await fetch(`${getUploadBaseUrl()}/api/drive/import/local`, {
      method: "POST",
      headers,
      body,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.detail || payload?.message || `Import failed (${response.status})`);
    }
    return response.json() as Promise<LocalImportResult>;
  },

  syncAll: (): Promise<SyncResult> =>
    fetchOrThrow<SyncResult>("/api/drive/sync", { method: "POST" }),

  ensureDocAccess: (docId: string): Promise<{ ok: boolean; url?: string; error?: string }> =>
    fetchOrThrow<{ ok: boolean; url?: string; error?: string }>("/api/drive/ensure-doc-access", {
      method: "POST",
      body: JSON.stringify({ doc_id: docId }),
    }),
};
