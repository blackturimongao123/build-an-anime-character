/**
 * Full-roster readiness: portraits on disk, wiki scrape, stats buckets.
 * Writes data/roster-readiness.json
 */
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const chars = JSON.parse(
  readFileSync(resolve(root, "data/characters.json"), "utf8"),
);
const portraitDir = resolve(root, "public-shared", "portraits");
const scrapeDir = resolve(root, "data/wiki-db/scrapes");
const files = new Set(readdirSync(portraitDir));

function portraitOk(c) {
  const id = c.id;
  return [...files].some((f) => f.startsWith(`${id}.`));
}

function bucket(c) {
  const p = [c.stats.strength, c.stats.speed, c.stats.abilities, c.stats.durability];
  if (p.every((v) => v === 50)) return "placeholder_50";
  if (p.every((v) => v === 40)) return "uniform_40";
  return "applied";
}

const summary = {
  total: chars.length,
  missing_portrait: 0,
  placeholder_50: 0,
  uniform_40: 0,
  applied: 0,
  no_scrape: 0,
  scrape_empty: 0,
  scrape_ok: 0,
};
const missingPortrait = [];
const placeholder = [];
const noScrape = [];

for (const c of chars) {
  const b = bucket(c);
  summary[b]++;
  if (!portraitOk(c)) {
    summary.missing_portrait++;
    missingPortrait.push(c.id);
  }
  if (b === "placeholder_50") placeholder.push(c.id);
  const sp = join(scrapeDir, `${c.id}.json`);
  if (!existsSync(sp)) {
    summary.no_scrape++;
    noScrape.push(c.id);
    continue;
  }
  const sc = JSON.parse(readFileSync(sp, "utf8"));
  if (!sc.slices?.length) summary.scrape_empty++;
  else summary.scrape_ok++;
}

const payload = {
  generated: new Date().toISOString(),
  summary,
  missingPortrait,
  placeholder,
  noScrape,
};
writeFileSync(
  resolve(root, "data/roster-readiness.json"),
  JSON.stringify(payload, null, 2) + "\n",
);

const md = [
  "# Roster readiness",
  "",
  `Generated: ${payload.generated}`,
  "",
  "## Summary",
  "",
  "| Metric | Count |",
  "| --- | ---: |",
  ...Object.entries(summary).map(([k, v]) => `| ${k} | ${v} |`),
  "",
  "## Commands",
  "",
  "- `npm run data:needs-wiki-scrape-8` — rescrape ids with missing/empty wiki slices or placeholder stats",
  "- `npm run data:wiki-apply` — apply per-stat peak (non-manga) from wiki DB",
  "- `npm run data:stats-check-apply` — live VS table repair for stubborn ids",
  "- `npm run data:form-policy` — refresh multi-form allowlist for validate",
  "- `npx tsx scripts/fetch-portraits-ids.ts <id>…` — portrait gaps",
  "",
  summary.missing_portrait
    ? `## Missing portraits (${missingPortrait.length})\n\n${missingPortrait.map((id) => `- \`${id}\``).join("\n")}\n`
    : "## Missing portraits\n\nNone.\n",
].join("\n");
writeFileSync(resolve(root, "data/ROSTER_READINESS.md"), md);

console.log(summary);
console.log("→ data/roster-readiness.json, data/ROSTER_READINESS.md");
