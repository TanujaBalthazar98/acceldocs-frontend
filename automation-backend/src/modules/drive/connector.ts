import { logger } from "../../logging/logger.js";
import { db } from "../../db/client.js";
import { config } from "../../config/index.js";

export interface DriveNode {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  parents?: string[];
}

function decryptToken(encrypted: string): string {
  return Buffer.from(encrypted, "base64").toString("utf-8");
}

function encryptToken(token: string): string {
  return Buffer.from(token).toString("base64");
}

export class DriveConnector {
  private accessToken: string | null = null;
  private userId: number | null = null;

  /**
   * Initialize with a user's access token (from x-google-token header or DB)
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Initialize from a user ID by looking up their stored Google tokens.
   * Automatically refreshes expired tokens.
   */
  async initFromUserId(userId: number): Promise<boolean> {
    this.userId = userId;
    const row = db.prepare(
      "SELECT access_token_encrypted, refresh_token_encrypted FROM google_tokens WHERE user_id = ?"
    ).get(userId) as { access_token_encrypted: string; refresh_token_encrypted: string | null } | undefined;

    if (!row) {
      logger.warn({ userId }, "drive.initFromUserId: no tokens found");
      return false;
    }

    this.accessToken = decryptToken(row.access_token_encrypted);

    // Verify token is valid, refresh if needed
    const valid = await this.verifyToken();
    if (!valid && row.refresh_token_encrypted) {
      const refreshed = await this.refreshAccessToken(decryptToken(row.refresh_token_encrypted));
      if (!refreshed) return false;
    } else if (!valid) {
      return false;
    }

    return true;
  }

  private async verifyToken(): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      const res = await fetch(
        `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${this.accessToken}`
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  private async refreshAccessToken(refreshToken: string): Promise<boolean> {
    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.GOOGLE_CLIENT_ID || "",
          client_secret: config.GOOGLE_CLIENT_SECRET || "",
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!res.ok) {
        logger.error({ status: res.status }, "drive.refreshAccessToken failed");
        return false;
      }

      const data = (await res.json()) as { access_token: string };
      this.accessToken = data.access_token;

      // Update stored token
      if (this.userId) {
        db.prepare(
          "UPDATE google_tokens SET access_token_encrypted = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
        ).run(encryptToken(this.accessToken), this.userId);
      }

      logger.info("drive.refreshAccessToken success");
      return true;
    } catch (err) {
      logger.error({ err }, "drive.refreshAccessToken error");
      return false;
    }
  }

  async listChildren(folderId: string): Promise<DriveNode[]> {
    if (!this.accessToken) {
      logger.warn("drive.listChildren: no access token");
      return [];
    }

    try {
      const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
      const fields = encodeURIComponent("files(id,name,mimeType,modifiedTime,parents)");
      const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=name&pageSize=1000`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      if (!res.ok) {
        const body = await res.text();
        logger.error({ status: res.status, body }, "drive.listChildren failed");
        return [];
      }

      const data = (await res.json()) as { files: DriveNode[] };
      logger.info({ folderId, count: data.files?.length ?? 0 }, "drive.listChildren");
      return data.files || [];
    } catch (err) {
      logger.error({ err, folderId }, "drive.listChildren error");
      return [];
    }
  }

  async exportGoogleDocHtml(fileId: string): Promise<string> {
    if (!this.accessToken) {
      logger.warn("drive.exportGoogleDocHtml: no access token");
      return "";
    }

    try {
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/html`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      if (!res.ok) {
        const body = await res.text();
        logger.error({ status: res.status, fileId, body }, "drive.exportGoogleDocHtml failed");
        return "";
      }

      const html = await res.text();
      logger.info({ fileId, length: html.length }, "drive.exportGoogleDocHtml");
      return html;
    } catch (err) {
      logger.error({ err, fileId }, "drive.exportGoogleDocHtml error");
      return "";
    }
  }

  async resolveFolderPath(fileId: string): Promise<string[]> {
    if (!this.accessToken) return [];

    const path: string[] = [];
    let currentId = fileId;

    try {
      for (let depth = 0; depth < 20; depth++) {
        const url = `https://www.googleapis.com/drive/v3/files/${currentId}?fields=id,name,parents`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });

        if (!res.ok) break;

        const file = (await res.json()) as { id: string; name: string; parents?: string[] };
        path.unshift(file.name);

        if (!file.parents || file.parents.length === 0) break;
        currentId = file.parents[0];
      }
    } catch (err) {
      logger.error({ err, fileId }, "drive.resolveFolderPath error");
    }

    return path;
  }

  /**
   * Create a folder in Google Drive
   */
  async createFolder(name: string, parentId: string): Promise<DriveNode | null> {
    if (!this.accessToken) return null;

    try {
      const res = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentId],
        }),
      });

      if (!res.ok) return null;
      return (await res.json()) as DriveNode;
    } catch {
      return null;
    }
  }

  /**
   * Create a Google Doc in a folder
   */
  async createDoc(name: string, parentId: string): Promise<DriveNode | null> {
    if (!this.accessToken) return null;

    try {
      const res = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          mimeType: "application/vnd.google-apps.document",
          parents: [parentId],
        }),
      });

      if (!res.ok) return null;
      return (await res.json()) as DriveNode;
    } catch {
      return null;
    }
  }

  /**
   * Move a file to trash
   */
  async trashFile(fileId: string): Promise<boolean> {
    if (!this.accessToken) return false;

    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trashed: true }),
      });

      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Sync (export) a Google Doc's content as HTML
   */
  async syncDocContent(fileId: string): Promise<{ html: string; title: string } | null> {
    if (!this.accessToken) return null;

    try {
      // Get file metadata
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,modifiedTime`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
      if (!metaRes.ok) return null;
      const meta = (await metaRes.json()) as DriveNode;

      // Export as HTML
      const html = await this.exportGoogleDocHtml(fileId);
      if (!html) return null;

      return { html, title: meta.name };
    } catch {
      return null;
    }
  }
}
