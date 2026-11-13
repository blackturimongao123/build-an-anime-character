/**
 * One-off: fix stray space in yuta-rika-jjk roster id across data files.
 */
import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OLD = " yuta-rika-jjk";
const NEW = "yuta-rika-jjk";

const jsonFiles = [
  "data/characters.json",
  "data/wiki-stat-keys.json",
  "data/famous-display-names.json",
  "data/anime-planet-hints.json",
  "data/wiki-hints.json",
  "data/roster-batch2-catalog.json",
  "data/physical-stat-audit.json",
  "data/stats-check-report.json",
];

for (const rel of jsonFiles) {
  const p = resolve(root, rel);
  if (!existsSync(p)) continue;
  const raw = readFileSync(p, "utf8");
  if (!raw.includes(OLD)) continue;
  writeFileSync(p, raw.replaceAll(OLD, NEW), "utf8");
  console.log(`fixed ${rel}`);
}

const scrapeOld = join(root, "data/wiki-db/scrapes", `${OLD.trim()}.json`);
const scrapeNew = join(root, "data/wiki-db/scrapes", `${NEW}.json`);
if (existsSync(scrapeOld) && !existsSync(scrapeNew)) {
  renameSync(scrapeOld, scrapeNew);
  console.log("renamed scrape json");
}
