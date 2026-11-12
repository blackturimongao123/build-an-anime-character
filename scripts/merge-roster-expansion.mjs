/**
 * One-time merge helper — roster-expansion.json → characters.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = JSON.parse(readFileSync(resolve(root, "data", "characters.json"), "utf-8"));
const add = JSON.parse(readFileSync(resolve(root, "data", "roster-expansion.json"), "utf-8"));

const byId = new Map(base.map((c) => [c.id, c]));
for (const c of add) {
  if (byId.has(c.id)) {
    console.warn(`Replacing existing id: ${c.id}`);
  }
  byId.set(c.id, c);
}

const merged = [...byId.values()].sort((a, b) =>
  a.series.localeCompare(b.series) || a.displayName.localeCompare(b.displayName),
);
writeFileSync(resolve(root, "data", "characters.json"), JSON.stringify(merged, null, 2) + "\n");
console.log(`Merged roster: ${merged.length} characters.`);
