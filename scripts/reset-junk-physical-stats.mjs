/**
 * Reset uniform-40/70 physical stats to 50 so wiki-apply won't leave junk tiers.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const path = resolve(root, "data/characters.json");
const chars = JSON.parse(readFileSync(path, "utf8"));
let n = 0;
for (const c of chars) {
  const p = [
    c.stats.strength,
    c.stats.speed,
    c.stats.abilities,
    c.stats.durability,
  ];
  if (p.every((v) => v === 40) || p.every((v) => v === 70)) {
    for (const k of ["strength", "speed", "abilities", "durability"]) {
      c.stats[k] = 50;
    }
    n++;
  }
}
writeFileSync(path, JSON.stringify(chars, null, 2) + "\n", "utf8");
console.log(`reset junk physical on ${n} characters`);
