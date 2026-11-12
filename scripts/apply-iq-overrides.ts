/**
 * Merge data/manual-iq-overrides.json into data/characters.json (iq column only).
 * Run after stats-check --apply so wiki physical stats stay aligned.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Character } from "@build-character/shared";
import { clampScore } from "@build-character/shared";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const charsPath = resolve(root, "data", "characters.json");
const iqPath = resolve(root, "data", "manual-iq-overrides.json");

const iqOverrides: Record<string, number> = JSON.parse(
  readFileSync(iqPath, "utf-8"),
);
const chars = JSON.parse(readFileSync(charsPath, "utf-8")) as Character[];

let changed = 0;
for (const c of chars) {
  const next = iqOverrides[c.id];
  if (next === undefined) continue;
  const iq = clampScore(next);
  if (c.stats.iq !== iq) {
    c.stats.iq = iq;
    changed++;
  }
}

writeFileSync(charsPath, `${JSON.stringify(chars, null, 2)}\n`, "utf-8");
console.log(`Applied anime IQ overrides: ${changed} characters updated`);
