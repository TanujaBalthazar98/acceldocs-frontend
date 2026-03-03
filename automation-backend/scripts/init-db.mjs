import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
const dbFile = process.env.DATABASE_URL || "./data/automation.db";
const schemaPath = path.resolve(process.cwd(), "src/db/schema.sql");
const sql = fs.readFileSync(schemaPath, "utf8");

fs.mkdirSync(path.dirname(path.resolve(process.cwd(), dbFile)), { recursive: true });
const db = new Database(path.resolve(process.cwd(), dbFile));
db.exec(sql);
db.close();

console.log("Database initialized:", dbFile);
