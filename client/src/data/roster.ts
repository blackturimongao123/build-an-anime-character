import type { Character } from "@build-character/shared";
import rosterJson from "../../../data/characters.json";

export const ROSTER: Character[] = rosterJson as Character[];

export function pickSpinCharacters(
  count: number,
  excludeIds: Set<string>,
): Character[] {
  const pool = ROSTER.filter((c) => !excludeIds.has(c.id));
  if (pool.length === 0) return ROSTER.slice(0, count);
  const out: Character[] = [];
  for (let i = 0; i < count; i++) {
    out.push(pool[Math.floor(Math.random() * pool.length)]!);
  }
  return out;
}
