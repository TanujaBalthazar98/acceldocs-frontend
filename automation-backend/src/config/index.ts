import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4001),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().default("./data/automation.db"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  DRIVE_ROOT_FOLDER: z.string().default("Documentation"),
  DOCS_REPO_PATH: z.string().default("../docs-site"),
  PREVIEW_BRANCH: z.string().default("docs-preview"),
  PROD_BRANCH: z.string().default("main"),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL: z.string().default("http://localhost:5173/auth/callback/github"),
  GITHUB_APP_NAME: z.string().default("acceldocs"),
});

export const config = EnvSchema.parse(process.env);
