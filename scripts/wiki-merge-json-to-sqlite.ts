/** Rebuild wiki-stats.sqlite from data/wiki-db/scrapes/*.json */
import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  initWikiDb,
  upsertScrapeSqlite,
  type WikiDbCharacterScrape,
  wikiDbDir,
} from "./lib/wiki-db.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = resolve(wikiDbDir(root), "scrapes");
initWikiDb(root);
let n = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const record = JSON.parse(
    readFileSync(resolve(dir, file), "utf-8"),
  ) as WikiDbCharacterScrape;
  if (upsertScrapeSqlite(root, record)) n++;
}
console.log(`Merged ${n} characters into wiki-stats.sqlite`);
