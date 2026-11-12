import type { Character } from "@build-character/shared";

/** Plain roster label: no parenthetical form suffixes. */
export function plainCharacterName(displayName: string): string {
  let n = displayName.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  n = n.replace(/\s+SSJ\d+$/i, "").trim();
  return n;
}

/** Group roster slots that represent the same character (for form-count limits). */
export function rosterFormIdentity(c: Character): string {
  const name = plainCharacterName(c.displayName);
  const lower = name.toLowerCase();
  if (lower.includes("goku")) return "goku";
  if (lower.startsWith("vegeta")) return "vegeta";
  if (/sung\s+jin/i.test(name)) return "sung jinwoo";
  if (/kirito/i.test(name)) return "kirito";
  if (/shigeo|mob\b/i.test(name)) return "shigeo kageyama";
  if (/midoriya|deku/i.test(name)) return "deku";
  if (/meliodas/i.test(name)) return "meliodas";
  return lower;
}
