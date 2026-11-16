/**
 * Remove curated non-anime roster entries (data/non-anime-roster-removals.json).
 * Does not scrape AP — safe, explicit list only.
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const listPath = resolve(root, "data/non-anime-roster-removals.json");
const { ids: toDrop } = JSON.parse(readFileSync(listPath, "utf8"));

const charsPath = resolve(root, "data/characters.json");
const sidecars = [
  resolve(root, "data/anime-planet-hints.json"),
  resolve(root, "data/wiki-hints.json"),
  resolve(root, "data/famous-display-names.json"),
  resolve(root, "data/manual-iq-overrides.json"),
  resolve(root, "data/wiki-stat-keys.json"),
  resolve(root, "data/wiki-profile-hints.json"),
];

const chars = JSON.parse(readFileSync(charsPath, "utf8"));
const dropSet = new Set(toDrop);
const keep = chars.filter((c) => !dropSet.has(c.id));
const removed = chars.filter((c) => dropSet.has(c.id)).map((c) => c.id);
const missing = toDrop.filter((id) => !chars.some((c) => c.id === id));

writeFileSync(charsPath, `${JSON.stringify(keep, null, 2)}\n`, "utf8");

for (const path of sidecars) {
  if (!existsSync(path)) continue;
  const data = JSON.parse(readFileSync(path, "utf8"));
  for (const id of toDrop) delete data[id];
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
  writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}

const portraitDir = resolve(root, "public-shared/portraits");
const clientPortraitDir = resolve(root, "client/public/portraits");
for (const id of toDrop) {
  for (const dir of [portraitDir, clientPortraitDir]) {
    for (const ext of [".jpg", ".webp", ".png", ".jpeg"]) {
      const p = join(dir, `${id}${ext}`);
      if (existsSync(p)) unlinkSync(p);
    }
  }
}

console.log("Removed:", removed.join(", ") || "(none)");
if (missing.length) console.log("Not in roster (skipped):", missing.join(", "));
console.log(`Roster: ${chars.length} → ${keep.length}`);
