import { logger } from "../logging/logger.js";
import { PublishQueueService } from "../modules/publish-queue/service.js";
import { MkDocsPublisher } from "../modules/mkdocs/publisher.js";
import { db } from "../db/client.js";

export class JobRunner {
  private publisher = new MkDocsPublisher();

  constructor(private readonly publishQueue: PublishQueueService) {}

  async runPublishOnce(): Promise<void> {
    const job = this.publishQueue.pullNext();
    if (!job) return;

    logger.info({ queueId: job.id, documentId: job.document_id }, "publish.job.started");

    try {
      // Get the document's organization to publish
      const doc = db.prepare(
        "SELECT organization_id FROM documents WHERE id = ?"
      ).get(job.document_id) as { organization_id: number } | undefined;

      if (!doc) {
        this.publishQueue.fail(job.id, "Document not found");
        return;
      }

      const result = await this.publisher.publish({
        organizationId: doc.organization_id,
        branch: job.target_branch,
      });

      if (result.success && result.commitSha) {
        this.publishQueue.complete(job.id, result.commitSha);
        logger.info({ queueId: job.id, commitSha: result.commitSha }, "publish.job.completed");
      } else {
        this.publishQueue.fail(job.id, result.error || "Publish failed");
        logger.error({ queueId: job.id, error: result.error }, "publish.job.failed");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown publish error";
      this.publishQueue.fail(job.id, message);
      logger.error({ queueId: job.id, err: error }, "publish.job.failed");
    }
  }
}
