/**
 * Merge data/manual-curated-stats.json into data/characters.json (partial stat patches).
 * Run after data:stats-check-apply and data:iq-apply.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Character, CharacterStats } from "@build-character/shared";
import { clampScore } from "@build-character/shared";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const charsPath = resolve(root, "data", "characters.json");
const curatedPath = resolve(root, "data", "manual-curated-stats.json");

const raw = JSON.parse(readFileSync(curatedPath, "utf-8")) as Record<
  string,
  Partial<CharacterStats> & { _doc?: string }
>;
const curated: Record<string, Partial<CharacterStats>> = {};
for (const [id, v] of Object.entries(raw)) {
  if (id.startsWith("_")) continue;
  curated[id] = v;
}

const chars = JSON.parse(readFileSync(charsPath, "utf-8")) as Character[];
let touched = 0;
for (const c of chars) {
  const patch = curated[c.id];
  if (!patch) continue;
  let changed = false;
  for (const k of Object.keys(patch) as (keyof CharacterStats)[]) {
    const next = clampScore(patch[k]!);
    if (c.stats[k] !== next) {
      c.stats[k] = next;
      changed = true;
    }
  }
  if (changed) touched++;
}

writeFileSync(charsPath, `${JSON.stringify(chars, null, 2)}\n`, "utf-8");
console.log(`Applied curated stat patches: ${touched} characters updated`);
