/**
 * Keep strongest form per character identity; plain display names (no parentheses).
 * Run: node ../node_modules/tsx/dist/cli.mjs normalize-roster-single-form.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Character } from "@build-character/shared";
import { CATEGORIES } from "@build-character/shared";
import {
  aotTitanDisplayName,
  isAotTitanRosterId,
  plainCharacterName,
  rosterFormIdentity,
} from "./lib/roster-identity.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function avgPower(c: Character): number {
  const s = c.stats;
  return (s.strength + s.speed + s.abilities + s.iq + s.durability) / 5;
}

/** When stats tie, prefer clearly peak-form roster ids. */
function formRank(id: string): number {
  if (id === "ymir-fritz-aot") return 5;
  if (isAotTitanRosterId(id)) return 4;
  if (id === "annie-aot") return 3;
  if (/base|jeju|unknown|aincrad-base/i.test(id)) return 0;
  if (/100|monarch|assault|stacia|bsm|gear|bankai|baryon|godspeed|emperor/i.test(id)) {
    return 2;
  }
  return 1;
}

function main() {
  const path = resolve(root, "data", "characters.json");
  const chars = JSON.parse(readFileSync(path, "utf-8")) as Character[];
  const groups = new Map<string, Character[]>();
  for (const c of chars) {
    const key = `${c.series}\0${rosterFormIdentity(c)}`;
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }

  const dropIds = new Set<string>();
  const statMergeInto = new Map<string, Character>();
  for (const [, list] of groups) {
    if (list.length <= 1) continue;
    const sorted = [...list].sort(
      (a, b) =>
        formRank(b.id) - formRank(a.id) ||
        avgPower(b) - avgPower(a) ||
        b.id.localeCompare(a.id),
    );
    const keep = sorted[0]!;
    statMergeInto.set(keep.id, { ...keep, stats: { ...keep.stats } });
    for (const c of sorted.slice(1)) {
      dropIds.add(c.id);
      const target = statMergeInto.get(keep.id)!;
      for (const cat of CATEGORIES) {
        target.stats[cat] = Math.max(target.stats[cat], c.stats[cat]);
      }
    }
  }

  const next = chars
    .filter((c) => !dropIds.has(c.id))
    .map((c) => {
      const merged = statMergeInto.get(c.id);
      const base = merged ?? c;
      let displayName = plainCharacterName(base.displayName);
      const titanLabel = aotTitanDisplayName(base);
      if (titanLabel) displayName = titanLabel;
      return { ...base, displayName };
    });

  writeFileSync(path, JSON.stringify(next, null, 2) + "\n");
  console.log(
    `Roster: ${chars.length} → ${next.length}. Dropped ids: ${[...dropIds].join(", ") || "(none)"}`,
  );
}

main();
