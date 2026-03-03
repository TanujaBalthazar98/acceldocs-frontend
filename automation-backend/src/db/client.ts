import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "../config/index.js";

const dbPath = path.resolve(process.cwd(), config.DATABASE_URL);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);

export function closeDb() {
  db.close();
}
