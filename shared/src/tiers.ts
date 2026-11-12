/**
 * Maps VS Battles tier strings to a 0–100 scale (log-inspired bands).
 * Anchor meanings (0 vs 100) per stat category: docs/GAMEPLAY.md.
 */

const TIER_BASE: [RegExp, number][] = [
  [/^below average human|10-c/i, 5],
  [/^human level|10-b/i, 12],
  [/^athlete|10-a/i, 18],
  [/^street|low 9-c|9-c/i, 22],
  [/^wall|9-b/i, 28],
  [/^small building|9-a/i, 32],
  [/^building|8-c/i, 38],
  [/^large building|high 8-c/i, 42],
  [/^city block|8-b/i, 46],
  [/^multi-city|8-a/i, 50],
  [/^town|7-c/i, 52],
  [/^small city|low 7-b/i, 55],
  [/^city level|7-b/i, 58],
  [/^mountain|7-a/i, 62],
  [/^island|6-c/i, 66],
  [/^country|6-b/i, 70],
  [/^continent|6-a/i, 74],
  [/^moon|5-c/i, 76],
  [/^small planet|low 5-b/i, 78],
  [/^planet level|5-b/i, 80],
  [/^large planet|high 5-b/i, 82],
  [/^dwarf star|5-a/i, 84],
  [/^small star|low 4-c|star level|4-c/i, 86],
  [/^large star|high 4-c/i, 88],
  [/^solar system|4-b/i, 90],
  [/^multi-solar|4-a/i, 91],
  [/^galaxy|3-c/i, 92],
  [/^multi-galaxy|3-b/i, 94],
  [/^universe level|high 3-a|3-a/i, 96],
  [/^low 2-c|multiverse|2-c/i, 97],
  [/^2-b|2-a|hyperverse/i, 98],
  [/^outerversal|1-/i, 99],
  [/^high 1-a|boundless|0-/i, 100],
];

function subTierAdjust(text: string, base: number): number {
  let score = base;
  if (/\blow\b/i.test(text)) score -= 3;
  if (/\bhigh\b/i.test(text)) score += 3;
  return Math.max(0, Math.min(100, score));
}

export function tierStringToScore(tierText: string): number | null {
  const text = tierText.trim();
  if (!text || /^unknown|n\/a|none/i.test(text)) return null;

  for (const [pattern, base] of TIER_BASE) {
    if (pattern.test(text)) {
      return subTierAdjust(text, base);
    }
  }

  const classMatch = text.match(/\b(\d+)-([A-C])\b/i);
  if (classMatch) {
    const num = parseInt(classMatch[1], 10);
    if (num >= 11) return 100;
    if (num === 10) return 15;
    if (num === 9) return 30;
    if (num === 8) return 45;
    if (num === 7) return 58;
    if (num === 6) return 72;
    if (num === 5) return 80;
    if (num === 4) return 90;
    if (num === 3) return 95;
    if (num === 2) return 98;
    if (num === 1) return 99;
    if (num === 0) return 100;
  }

  return null;
}

export function clampScore(n: number): number {
  return Math.round(Math.max(0, Math.min(100, n)));
}
