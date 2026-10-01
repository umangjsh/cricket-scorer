import { JSONFilePreset } from "lowdb/node";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "db.json");

const defaultData = {
  teams: [],
  players: [],
  matches: [],
};

let dbPromise;

/**
 * Returns a singleton lowdb instance backed by a JSON file on disk.
 * Swap this module out for a real database (Postgres/Mongo) later —
 * every other module only talks to the small API exported here.
 */
export function getDB() {
  if (!dbPromise) {
    dbPromise = JSONFilePreset(DB_PATH, defaultData);
  }
  return dbPromise;
}

export async function saveDB() {
  const db = await getDB();
  await db.write();
}
