/**
 * Build data/roster-stat-placeholders.json from characters.json (sidecar; not on Character type).
 * Each physical stat is placeholder when still at roster default (50) or wiki junk reset (40).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PHYSICAL = ["strength", "speed", "abilities", "durability"];
const PLACEHOLDER_VALUES = new Set([50, 40]);

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const charsPath = resolve(root, "data/characters.json");
const outPath = resolve(root, "data/roster-stat-placeholders.json");

function isPlaceholderValue(v) {
  const n = Math.round(Number(v));
  return PLACEHOLDER_VALUES.has(n);
}

function placeholdersForCharacter(c) {
  const flags = {};
  for (const k of PHYSICAL) {
    flags[k] = isPlaceholderValue(c.stats?.[k]);
  }
  return flags;
}

const chars = JSON.parse(readFileSync(charsPath, "utf8"));
const out = {};

for (const c of chars) {
  const flags = placeholdersForCharacter(c);
  if (PHYSICAL.some((k) => flags[k])) {
    out[c.id] = flags;
  }
}

const sorted = Object.fromEntries(
  Object.keys(out)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => [k, out[k]]),
);

writeFileSync(outPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");

const withAny = Object.keys(sorted).length;
const allFour = Object.values(sorted).filter((f) =>
  PHYSICAL.every((k) => f[k]),
).length;
console.log(
  `roster-stat-placeholders.json: ${withAny} ids with any placeholder (${allFour} all-four @50/40) → ${outPath}`,
);
