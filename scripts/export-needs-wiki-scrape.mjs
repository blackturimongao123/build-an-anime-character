/**
 * IDs needing wiki rescrape: no file, empty slices, or placeholder physical stats.
 * Writes data/wiki-db/shards/needs-scrape.txt
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const chars = JSON.parse(
  readFileSync(resolve(root, "data/characters.json"), "utf8"),
);
const scrapeDir = resolve(root, "data/wiki-db/scrapes");
const out = resolve(root, "data/wiki-db/shards/needs-scrape.txt");

const ids = new Set();
for (const c of chars) {
  const p = [
    c.stats.strength,
    c.stats.speed,
    c.stats.abilities,
    c.stats.durability,
  ];
  const placeholder = p.every((v) => v === 50);
  const junkUniform = p.every((v) => v === 40);
  const sp = join(scrapeDir, `${c.id}.json`);
  if (!existsSync(sp)) {
    ids.add(c.id);
    continue;
  }
  const sc = JSON.parse(readFileSync(sp, "utf8"));
  if (!sc.slices?.length) ids.add(c.id);
  else if (placeholder || junkUniform) ids.add(c.id);
}

writeFileSync(out, [...ids].sort().join("\n") + "\n", "utf8");
console.log(`needs-scrape: ${ids.size} → ${out}`);
