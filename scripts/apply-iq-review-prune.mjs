/**
 * Remove roster entries marked IQ 50 in an IQ review HTML export (+ optional franchise trims).
 *
 * Final IQ = SEED_EDITS[id] ?? proposed ?? overrideIq ?? current (matches review UI seeds).
 *
 * Usage:
 *   node scripts/apply-iq-review-prune.mjs <path-to-iq-revision-review.html>
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const htmlPath = resolve(process.argv[2] ?? "");
if (!htmlPath || !existsSync(htmlPath)) {
  console.error("Usage: node scripts/apply-iq-review-prune.mjs <iq-revision-review.html>");
  process.exit(1);
}

const html = readFileSync(htmlPath, "utf8");
const rosterMatch = html.match(/const ROSTER = (\[[\s\S]*?\]);/);
const seedMatch = html.match(/const SEED_EDITS = (\{[\s\S]*?\});/);
if (!rosterMatch) {
  console.error("No ROSTER array in HTML");
  process.exit(1);
}

const roster = JSON.parse(rosterMatch[1]);
const seedEdits = seedMatch ? JSON.parse(seedMatch[1]) : {};

function finalIq(row) {
  if (seedEdits[row.id] != null) return Number(seedEdits[row.id]);
  return Number(row.proposed ?? row.overrideIq ?? row.current);
}

const htmlById = new Map(roster.map((r) => [r.id, r]));
const dropFromHtml = new Set();
for (const row of roster) {
  if (finalIq(row) === 50) dropFromHtml.add(row.id);
}

const charsPath = resolve(root, "data/characters.json");
const chars = JSON.parse(readFileSync(charsPath, "utf8"));
const overridesPath = resolve(root, "data/manual-iq-overrides.json");
const overrides = existsSync(overridesPath)
  ? JSON.parse(readFileSync(overridesPath, "utf8"))
  : {};

const dropSet = new Set(dropFromHtml);

/** Franchise: Hellsing → Alucard only. */
const HELLSING_KEEP = "alucard";
for (const c of chars) {
  if (c.series === "Hellsing" && c.id !== HELLSING_KEEP) dropSet.add(c.id);
}

/** Present in roster but absent from this HTML snapshot: drop if IQ override is 50. */
for (const c of chars) {
  if (htmlById.has(c.id)) continue;
  const iq = overrides[c.id] ?? c.stats?.iq;
  if (iq === 50) dropSet.add(c.id);
}

dropSet.delete(HELLSING_KEEP);

const keep = chars.filter((c) => !dropSet.has(c.id));
const removed = chars.filter((c) => dropSet.has(c.id)).map((c) => c.id);

writeFileSync(charsPath, `${JSON.stringify(keep, null, 2)}\n`, "utf8");

const catalogOnlyExtra = ["alucard-hellsing"];
for (const id of catalogOnlyExtra) dropSet.add(id);

const sidecars = [
  "anime-planet-hints.json",
  "wiki-hints.json",
  "famous-display-names.json",
  "manual-iq-overrides.json",
  "wiki-stat-keys.json",
  "wiki-profile-hints.json",
  "roster-stat-placeholders.json",
];
for (const file of sidecars) {
  const path = resolve(root, "data", file);
  if (!existsSync(path)) continue;
  const data = JSON.parse(readFileSync(path, "utf8"));
  for (const id of dropSet) delete data[id];
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

const catalogPath = resolve(root, "data/roster-batch2-catalog.json");
if (existsSync(catalogPath)) {
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  for (const rows of Object.values(catalog)) {
    if (!Array.isArray(rows)) continue;
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      if (Array.isArray(row) && dropSet.has(row[0])) rows.splice(i, 1);
    }
  }
  catalog.Hellsing = [["alucard", "Alucard", "Alucard (Hellsing)", "alucard"]];
  writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}

const portraitDir = resolve(root, "public-shared/portraits");
const clientPortraitDir = resolve(root, "client/public/portraits");
for (const id of dropSet) {
  for (const dir of [portraitDir, clientPortraitDir]) {
    for (const ext of [".jpg", ".webp", ".png", ".jpeg"]) {
      const p = join(dir, `${id}${ext}`);
      if (existsSync(p)) unlinkSync(p);
    }
  }
}

const logPath = resolve(root, "data/iq-review-prune-log.json");
writeFileSync(
  logPath,
  `${JSON.stringify(
    {
      sourceHtml: htmlPath,
      removedCount: removed.length,
      rosterBefore: chars.length,
      rosterAfter: keep.length,
      removedIds: removed.sort(),
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`IQ 50 removals (from HTML): ${dropFromHtml.size}`);
console.log(`Total removed: ${removed.length}`);
console.log(`Roster: ${chars.length} → ${keep.length}`);
console.log(`Log: ${logPath}`);