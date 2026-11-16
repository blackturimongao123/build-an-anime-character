import type { Character } from "@build-character/shared";
import { expandTitanDisplayName } from "./roster-display-name.js";

/** AoT: one roster slot per titan type — human shifter ids alias to the same identity. */
const AOT_TITAN_SHIFTER_IDENTITY: Record<string, string> = {
  "pieck-aot": "cart-titan",
  "cart-aot": "cart-titan",
  "porco-aot": "jaw-titan",
  "ymir-jaw-aot": "jaw-titan",
  "zeke-aot": "beast-titan",
  "ymir-beast-aot": "beast-titan",
  "reiner-armored-anime": "armored-titan",
  "ymir-armored-aot": "armored-titan",
  "armin-colossal-anime": "colossal-titan",
  "bertolt-aot": "colossal-titan",
  "ymir-colossal-aot": "colossal-titan",
  "eren-founding-anime": "eren-yeager",
  "ymir-attack-aot": "eren-yeager",
  "ymir-fritz-aot": "eren-yeager",
  "annie-aot": "female-titan",
  "annie-crystal-aot": "female-titan",
  "ymir-female-aot": "female-titan",
  "levi-ackerman": "levi",
  "levi-anime-aot": "levi",
  "warhammer-aot": "warhammer-titan",
  "ymir-warhammer-aot": "warhammer-titan",
};

const AOT_TITAN_ROSTER_ID =
  /^(cart-aot|warhammer-aot|ymir-(armored|attack|beast|colossal|jaw|female|warhammer|fritz)-aot)$/;

export function isAotTitanRosterId(id: string): boolean {
  return AOT_TITAN_ROSTER_ID.test(id);
}

/** Canonical in-game label when the kept id is a titan slot or sole female-titan holder. */
export function aotTitanDisplayName(
  c: Pick<Character, "id" | "displayName" | "sources">,
): string | undefined {
  if (c.id === "annie-aot") return "Female Titan";
  if (!isAotTitanRosterId(c.id)) return undefined;
  const wiki = c.sources?.wikiPage;
  return expandTitanDisplayName(c.id, c.displayName, wiki);
}

/** Plain roster label: no parenthetical form suffixes. */
export function plainCharacterName(displayName: string): string {
  let n = displayName.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  n = n.replace(/\s+SSJ\d+$/i, "").trim();
  return n;
}

/** Group roster slots that represent the same character (for form-count limits). */
export function rosterFormIdentity(c: Character): string {
  if (c.id === "buu-dragon-ball") return "nice-buu";
  if (c.id === "evil-buu-dragon-ball") return "evil-buu";
  if (c.id === "yugi-ygo") return "yugi";
  if (c.id === "yami-yugi-ygo") return "yami-yugi";
  if (c.id === "kaiba-ygo") return "kaiba";
  if (c.series === "Attack on Titan") {
    const alias = AOT_TITAN_SHIFTER_IDENTITY[c.id];
    if (alias) return alias;
  }
  if (
    c.series === "Fullmetal Alchemist" &&
    (c.id === "king-bradley-fma" || c.id === "wrath-fma")
  ) {
    return "king bradley";
  }
  if (
    c.series === "That Time I Got Reincarnated as a Slime" &&
    (c.id === "deeno-slime" || c.id === "dino-slime")
  ) {
    return "deeno";
  }
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
