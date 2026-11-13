/**
 * Ensure manual-iq-overrides.json lists every roster id with current stats.iq
 * (preserves extra keys not on roster; sorts alphabetically).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const charsPath = resolve(root, "data/characters.json");
const iqPath = resolve(root, "data/manual-iq-overrides.json");

const chars = JSON.parse(readFileSync(charsPath, "utf8"));
const prev = JSON.parse(readFileSync(iqPath, "utf8"));
const rosterIds = new Set(chars.map((c) => c.id));

const out = { ...prev };
let added = 0;
let updated = 0;
for (const c of chars) {
  const iq = Math.min(100, Math.max(0, Math.round(Number(c.stats?.iq) || 50)));
  if (out[c.id] === undefined) {
    out[c.id] = iq;
    added++;
  } else if (out[c.id] !== iq) {
    out[c.id] = iq;
    updated++;
  }
}
for (const key of Object.keys(out)) {
  if (!rosterIds.has(key)) delete out[key];
}

const sorted = Object.fromEntries(
  Object.keys(out)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => [k, out[k]]),
);

writeFileSync(iqPath, JSON.stringify(sorted, null, 2) + "\n", "utf8");
console.log(
  `manual-iq-overrides.json: ${Object.keys(sorted).length} ids (+${added} new, ${updated} synced from characters.json)`,
);
