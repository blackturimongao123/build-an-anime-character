/** Keep only anos-misfit for The Misfit of Demon King Academy. */
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERIES = "The Misfit of Demon King Academy";
const KEEP_ID = "anos-misfit";

const charsPath = resolve(root, "data/characters.json");
const chars = JSON.parse(readFileSync(charsPath, "utf8"));
const byId = new Map(chars.map((c) => [c.id, c]));

const anosV = byId.get("anos-voldigoad");
const anos = byId.get(KEEP_ID);
if (anos && anosV) {
  anos.stats = { ...anosV.stats };
  anos.sources = { ...anosV.sources };
  anos.portrait = anosV.portrait ?? anos.portrait;
  byId.set(KEEP_ID, anos);
}
byId.delete("anos-voldigoad");

const drop = [];
for (const [id, c] of byId) {
  if (c.series === SERIES && id !== KEEP_ID) {
    byId.delete(id);
    drop.push(id);
  }
}
if (anosV) drop.push("anos-voldigoad");

const merged = [...byId.values()].sort(
  (a, b) =>
    a.series.localeCompare(b.series) || a.displayName.localeCompare(b.displayName),
);
writeFileSync(charsPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

const misfitIds = [
  "misha-misfit",
  "sasha-misfit",
  "lay-glavielle-misfit",
  "gavel-misfit",
  "medemma-misfit",
  "shin-misfit",
  "zepes-misfit",
  "meli-misfit",
  "gusta-misfit",
  "anos-voldigoad",
  ...drop.filter((id) => id !== "anos-voldigoad"),
];
const dropSet = new Set(misfitIds);

const sidecars = [
  "anime-planet-hints.json",
  "wiki-hints.json",
  "famous-display-names.json",
  "manual-iq-overrides.json",
  "wiki-stat-keys.json",
  "wiki-profile-hints.json",
];
for (const file of sidecars) {
  const path = resolve(root, "data", file);
  if (!existsSync(path)) continue;
  const data = JSON.parse(readFileSync(path, "utf8"));
  for (const id of dropSet) delete data[id];
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

const catalogPath = resolve(root, "data/roster-batch2-catalog.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
catalog[SERIES] = [
  ["anos-misfit", "Anos", "Anos Voldigoad", "anos-voldigoad"],
];
writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

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

console.log("Dropped:", [...dropSet].sort().join(", "));
console.log(`Kept: ${KEEP_ID}`);
