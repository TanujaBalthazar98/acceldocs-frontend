import { logger } from "../../logging/logger.js";
import { DriveConnector } from "../drive/connector.js";
import type { IngestedDocumentMeta } from "../../db/types.js";

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";

export class IngestionService {
  constructor(private readonly drive: DriveConnector) {}

  async runRecursiveScan(rootFolderId: string): Promise<IngestedDocumentMeta[]> {
    logger.info({ rootFolderId }, "ingestion.scan.start");

    const collected: IngestedDocumentMeta[] = [];
    await this.walk(rootFolderId, [], collected);

    logger.info({ count: collected.length }, "ingestion.scan.completed");
    return collected;
  }

  private async walk(
    folderId: string,
    lineage: string[],
    out: IngestedDocumentMeta[],
  ): Promise<void> {
    const children = await this.drive.listChildren(folderId);

    for (const item of children) {
      const nextLineage = [...lineage, item.name];

      if (item.mimeType === "application/vnd.google-apps.folder") {
        await this.walk(item.id, nextLineage, out);
        continue;
      }

      if (item.mimeType !== GOOGLE_DOC_MIME) {
        continue;
      }

      const parsed = this.mapPathToMeta(nextLineage, item.id, item.modifiedTime);
      if (parsed) out.push(parsed);
    }
  }

  private mapPathToMeta(
    lineageWithDocTitle: string[],
    driveFileId: string,
    modifiedAt?: string,
  ): IngestedDocumentMeta | null {
    // Expected: Documentation/<Project>/<Version>/<Public|Internal>/<Sections...>/<Doc>
    if (lineageWithDocTitle.length < 5) {
      logger.warn({ lineageWithDocTitle }, "ingestion.skip.invalid_path");
      return null;
    }

    const [root, project, version, visibilityRaw, ...rest] = lineageWithDocTitle;
    const title = rest[rest.length - 1] ?? "untitled";
    const sectionPath = rest.slice(0, -1);

    if (root !== "Documentation") {
      logger.warn({ root }, "ingestion.skip.non_documentation_root");
      return null;
    }

    const visibility = visibilityRaw.toLowerCase() === "public" ? "public" : "internal";
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "page";

    return {
      driveFileId,
      googleDocId: driveFileId,
      title,
      slug,
      visibility,
      drivePath: lineageWithDocTitle.join("/"),
      project,
      version,
      sectionPath,
      modifiedAt,
    };
  }
}
