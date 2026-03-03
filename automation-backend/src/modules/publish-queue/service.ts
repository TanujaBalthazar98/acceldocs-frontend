import { db } from "../../db/client.js";
import { logger } from "../../logging/logger.js";

export interface QueuePublishParams {
  documentId: number;
  targetBranch: string;
}

export class PublishQueueService {
  queue(params: QueuePublishParams): number {
    const stmt = db.prepare(`
      INSERT INTO publish_queue (document_id, target_branch, status)
      VALUES (?, ?, 'queued')
    `);
    const result = stmt.run(params.documentId, params.targetBranch);
    logger.info({ queueId: result.lastInsertRowid, ...params }, "publish.queue.enqueued");
    return Number(result.lastInsertRowid);
  }

  pullNext(): { id: number; document_id: number; target_branch: string } | null {
    const row = db
      .prepare(
        `SELECT id, document_id, target_branch FROM publish_queue WHERE status = 'queued' ORDER BY scheduled_at ASC LIMIT 1`,
      )
      .get() as { id: number; document_id: number; target_branch: string } | undefined;

    if (!row) return null;

    db.prepare(`UPDATE publish_queue SET status = 'running', started_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
      row.id,
    );

    return row;
  }

  complete(queueId: number, commitSha: string): void {
    db.prepare(
      `UPDATE publish_queue SET status = 'completed', finished_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).run(queueId);

    db.prepare(`
      UPDATE documents
      SET last_published_commit = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT document_id FROM publish_queue WHERE id = ?)
    `).run(commitSha, queueId);
  }

  fail(queueId: number, errorMessage: string): void {
    db.prepare(
      `UPDATE publish_queue SET status = 'failed', finished_at = CURRENT_TIMESTAMP, error_message = ?, attempts = attempts + 1 WHERE id = ?`,
    ).run(errorMessage, queueId);
  }
}
