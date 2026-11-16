/**
 * Full-roster physical stat + wiki scrape status for stat-fill triage.
 * Writes data/stat-placeholder-report.json
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const chars = JSON.parse(
  readFileSync(resolve(root, "data/characters.json"), "utf8"),
);
const scrapeDir = resolve(root, "data/wiki-db/scrapes");
const out = resolve(root, "data/stat-placeholder-report.json");

function physicalBucket(c) {
  const p = [
    c.stats.strength,
    c.stats.speed,
    c.stats.abilities,
    c.stats.durability,
  ];
  if (p.every((v) => v === 50)) return "all_50";
  if (p.every((v) => v === 40)) return "all_40";
  if (p.every((v) => v === 70)) return "all_70";
  if (p.every((v) => v === p[0])) return `uniform_${p[0]}`;
  return "varied";
}

function scrapeStatus(id) {
  const sp = join(scrapeDir, `${id}.json`);
  if (!existsSync(sp)) return "missing_file";
  const sc = JSON.parse(readFileSync(sp, "utf8"));
  if (!sc.slices?.length) return "empty_slices";
  return "ok";
}

function needsRescrape(physical, scrape) {
  if (scrape === "missing_file" || scrape === "empty_slices") return true;
  return physical === "all_50" || physical === "all_40" || physical === "all_70";
}

const summary = {
  total: chars.length,
  physical: { all_50: 0, all_40: 0, all_70: 0, varied: 0, other_uniform: 0 },
  scrape: { ok: 0, empty_slices: 0, missing_file: 0 },
  needs_rescrape: 0,
};

const rows = [];
for (const c of chars) {
  const physical = physicalBucket(c);
  const scrape = scrapeStatus(c.id);
  const needs = needsRescrape(physical, scrape);

  if (physical === "all_50") summary.physical.all_50++;
  else if (physical === "all_40") summary.physical.all_40++;
  else if (physical === "all_70") summary.physical.all_70++;
  else if (physical === "varied") summary.physical.varied++;
  else summary.physical.other_uniform++;

  summary.scrape[scrape]++;
  if (needs) summary.needs_rescrape++;

  rows.push({
    id: c.id,
    displayName: c.displayName,
    physical,
    stats: {
      strength: c.stats.strength,
      speed: c.stats.speed,
      abilities: c.stats.abilities,
      durability: c.stats.durability,
    },
    scrape,
    needsRescrape: needs,
  });
}

const payload = {
  generated: new Date().toISOString(),
  summary,
  rows,
};
writeFileSync(out, JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log(JSON.stringify(summary, null, 2));
console.log(`→ ${out}`);
