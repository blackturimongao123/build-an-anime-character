import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, "..", "..", "data", "characters.json");

/** @type {import("@build-character/shared").Character[]} */
let pool = [];

export function loadCharacterPool() {
  const raw = readFileSync(dataPath, "utf-8");
  pool = JSON.parse(raw);
  return pool;
}

export function getPool() {
  if (pool.length === 0) loadCharacterPool();
  return pool;
}
