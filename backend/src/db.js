import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const databaseFile = process.env.DATABASE_FILE || "../database/db.json";
const dbPath = path.resolve(__dirname, "..", databaseFile);

export function readDb() {
  return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

export function writeDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

export function publicUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}
