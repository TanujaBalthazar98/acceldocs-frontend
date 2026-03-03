import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config/index.js";
import { logger } from "./logging/logger.js";
import { db } from "./db/client.js";
import { DriveConnector } from "./modules/drive/connector.js";
import { IngestionService } from "./modules/ingestion/service.js";
import { MarkdownService } from "./modules/markdown/service.js";
import { PublishQueueService } from "./modules/publish-queue/service.js";
import { JobRunner } from "./jobs/runner.js";
import { registerRoutes } from "./api/routes.js";

function initializeSchema() {
  const schemaPath = path.resolve(process.cwd(), "src/db/schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  db.exec(sql);
}

async function bootstrap() {
  initializeSchema();

  const app = Fastify({ logger: false });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  const drive = new DriveConnector();
  const ingestionService = new IngestionService(drive);
  const markdownService = new MarkdownService();
  const publishQueue = new PublishQueueService();
  const jobs = new JobRunner(publishQueue);

  registerRoutes(app, { ingestionService, markdownService, publishQueue });

  setInterval(() => {
    void jobs.runPublishOnce();
  }, 5000).unref();

  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  logger.info({ port: config.PORT }, "automation-backend.started");
}

void bootstrap();
