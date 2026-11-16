/**
 * Remove roster id keys from data JSON that are not in characters.json.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const chars = JSON.parse(
  readFileSync(resolve(root, "data/characters.json"), "utf8"),
);
const ids = new Set(chars.map((c) => c.id));

const maps = [
  "data/manual-iq-overrides.json",
  "data/wiki-hints.json",
  "data/anime-planet-hints.json",
  "data/famous-display-names.json",
  "data/wiki-stat-keys.json",
];

for (const rel of maps) {
  const path = resolve(root, rel);
  if (!existsSync(path)) continue;
  const data = JSON.parse(readFileSync(path, "utf8"));
  let pruned = 0;
  for (const key of Object.keys(data)) {
    if (key.startsWith("_")) continue;
    if (!ids.has(key)) {
      delete data[key];
      pruned++;
    }
  }
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`${rel}: pruned ${pruned} orphan id(s)`);
}
