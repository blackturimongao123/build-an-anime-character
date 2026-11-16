/**
 * Parses the "Powers and Stats" section of a VS Battles page (raw wikitext) into forms (keys),
 * per-form stat lines with ranks, abilities and notable attacks.
 */

// ---------- ordinal scales ----------
export const TIERS = [
  "11-C", "11-B", "11-A", "10-C", "10-B", "10-A", "9-C", "9-B", "9-A", "8-C", "High 8-C", "8-B", "8-A",
  "Low 7-C", "7-C", "High 7-C", "Low 7-B", "7-B", "7-A", "High 7-A", "6-C", "High 6-C", "Low 6-B", "6-B", "High 6-B",
  "6-A", "High 6-A", "5-C", "Low 5-B", "5-B", "5-A", "High 5-A", "Low 4-C", "4-C", "High 4-C", "4-B", "4-A",
  "3-C", "3-B", "3-A", "High 3-A", "Low 2-C", "2-C", "2-B", "2-A", "Low 1-C", "1-C", "High 1-C", "1-B", "High 1-B",
  "Low 1-A", "1-A", "High 1-A", "0",
];
const TIER_RANK = new Map(TIERS.map((t, i) => [t.toLowerCase(), i]));

/** Attack potency / durability level names -> tier code. Longest names first when matching. */
const LEVELS: [string, string][] = [
  ["below average level", "10-C"], ["human level", "10-B"], ["athlete level", "10-A"], ["street level", "9-C"],
  ["wall level", "9-B"], ["small building level", "9-A"], ["large building level", "High 8-C"], ["building level", "8-C"],
  ["multi-city block level", "8-A"], ["city block level", "8-B"], ["small town level", "Low 7-C"], ["large town level", "High 7-C"],
  ["town level", "7-C"], ["small city level", "Low 7-B"], ["city level", "7-B"], ["large mountain level", "High 7-A"],
  ["mountain level", "7-A"], ["large island level", "High 6-C"], ["island level", "6-C"], ["small country level", "Low 6-B"],
  ["large country level", "High 6-B"], ["country level", "6-B"], ["multi-continent level", "High 6-A"], ["continent level", "6-A"],
  ["moon level", "5-C"], ["small planet level", "Low 5-B"], ["large planet level", "5-A"], ["planet level", "5-B"],
  ["dwarf star level", "High 5-A"], ["small star level", "Low 4-C"], ["large star level", "High 4-C"], ["star level", "4-C"],
  ["multi-solar system level", "4-A"], ["solar system level", "4-B"], ["multi-galaxy level", "3-B"], ["galaxy level", "3-C"],
  ["high universe level", "High 3-A"], ["universe level+", "Low 2-C"], ["universe level", "3-A"], ["low multiverse level", "2-C"],
  ["multiverse level+", "2-A"], ["multiverse level", "2-B"], ["low complex multiverse level", "Low 1-C"],
  ["high complex multiverse level", "High 1-C"], ["complex multiverse level", "1-C"], ["low hyperverse level", "1-B"],
  ["high hyperverse level", "High 1-B"], ["hyperverse level", "1-B"], ["low outerverse level", "Low 1-A"],
  ["high outerverse level", "High 1-A"], ["outerverse level", "1-A"], ["boundless", "0"],
];
/** Striking strength classes -> rough tier code (VS Battles energy table). */
const STRIKE_CLASSES: [string, string][] = [
  ["class kj", "8-C"], ["class mj", "8-B"], ["class gj", "7-C"], ["class tj", "7-A"], ["class pj", "6-C"], ["class ej", "6-A"],
  ["class zj", "5-B"], ["class yj", "5-A"], ["class xkj", "Low 4-C"], ["multi-stellar", "4-A"], ["stellar", "4-C"],
  ["multi-galactic", "3-B"], ["galactic", "3-C"], ["universal+", "High 3-A"], ["universal", "3-A"], ["multiversal+", "2-A"],
  ["multiversal", "2-B"], ["hyperversal", "1-B"], ["outerversal", "1-A"], ["boundless", "0"],
];
export const SPEEDS = [
  "below average human", "normal human", "average human", "athletic human", "peak human", "superhuman", "subsonic", "subsonic+",
  "transonic", "supersonic", "supersonic+", "hypersonic", "hypersonic+", "high hypersonic", "high hypersonic+",
  "massively hypersonic", "massively hypersonic+", "sub-relativistic", "sub-relativistic+", "relativistic", "relativistic+",
  "speed of light", "ftl", "ftl+", "massively ftl", "massively ftl+", "infinite", "immeasurable", "irrelevant", "omnipresent",
];
export const LIFTS = [
  "below average", "regular human", "average human", "athletic human", "peak human", "superhuman", "class 1", "class 5", "class 10",
  "class 25", "class 50", "class 100", "class k", "class m", "class g", "class t", "class p", "class e", "class z", "class y",
  "stellar", "multi-stellar", "galactic", "multi-galactic", "universal", "multiversal", "infinite", "immeasurable", "irrelevant",
];

// ---------- text helpers ----------
export function plain(raw: string): string {
  let t = raw;
  t = t.replace(/<!--[\s\S]*?-->/g, "");
  t = t.replace(/<ref[^>]*\/>/gi, "").replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  for (let i = 0; i < 4; i++) t = t.replace(/\{\{([^{}|]+)\}\}/g, "$1").replace(/\{\{[^{}]*\}\}/g, "");
  t = t.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1");
  t = t.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]*)\]/g, "$1").replace(/\[https?:\/\/[^\]]+\]/g, "");
  t = t.replace(/'''?/g, "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "");
  return t.replace(/\s+/g, " ").trim();
}

/** Split on "|" that is not inside [[ ]], {{ }} or <...>. */
export function splitTop(s: string, sep = "|"): string[] {
  const out: string[] = [];
  let depthL = 0, depthT = 0, depthH = 0, cur = "";
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2);
    if (two === "[[") { depthL++; cur += two; i++; continue; }
    if (two === "]]") { depthL = Math.max(0, depthL - 1); cur += two; i++; continue; }
    if (two === "{{") { depthT++; cur += two; i++; continue; }
    if (two === "}}") { depthT = Math.max(0, depthT - 1); cur += two; i++; continue; }
    if (s[i] === "<") depthH++;
    if (s[i] === ">") depthH = Math.max(0, depthH - 1);
    if (s[i] === sep && !depthL && !depthT && !depthH) { out.push(cur); cur = ""; continue; }
    cur += s[i];
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

/** Words right before a match that make it a "maybe" rather than a firm value. */
const SOFT = /(possibly|likely|probably|potentially|perhaps|maybe|unknown,?|at most)\s+(?:[\w'-]+\s+){0,2}$/i;

function bestOf(text: string, table: [string, string][] | string[], rankOf: (v: string) => number) {
  const lower = text.toLowerCase();
  let firm = -1, firmVal = "", soft = -1, softVal = "";
  const entries: [string, string][] = Array.isArray(table[0]) ? (table as [string, string][]) : (table as string[]).map((x) => [x, x]);
  const sorted = [...entries].sort((a, b) => b[0].length - a[0].length);
  const taken: [number, number][] = [];
  for (const [name, value] of sorted) {
    let from = 0;
    for (;;) {
      const i = lower.indexOf(name, from);
      if (i < 0) break;
      from = i + name.length;
      const before = lower[i - 1], after = lower[i + name.length];
      if ((before && /[a-z0-9]/.test(before)) || (after && /[a-z0-9]/.test(after) && !name.endsWith("+"))) continue;
      if (taken.some(([a, b]) => i < b && i + name.length > a)) continue; // inside a longer match
      taken.push([i, i + name.length]);
      const r = rankOf(value);
      const isSoft = SOFT.test(lower.slice(Math.max(0, i - 40), i));
      if (isSoft) { if (r > soft) { soft = r; softVal = value; } }
      else if (r > firm) { firm = r; firmVal = value; }
    }
  }
  return firm >= 0 ? { value: firmVal, rank: firm, soft: false } : soft >= 0 ? { value: softVal, rank: soft, soft: true } : null;
}

const tierRank = (code: string) => TIER_RANK.get(code.toLowerCase()) ?? -1;

export function rankTier(raw: string) {
  const codes = [...raw.matchAll(/\{\{\s*((?:Low |High )?\d{1,2}-[A-C]|0)\s*\}\}/gi)].map((m) => m[1]);
  const text = plain(raw);
  const fromText = bestOf(text, TIERS.map((t) => [t.toLowerCase(), t] as [string, string]), tierRank);
  // Templates are firm unless preceded by a soft word.
  let best: { value: string; rank: number; soft: boolean } | null = fromText;
  for (const c of codes) {
    const r = tierRank(c);
    const at = raw.indexOf(c);
    const soft = SOFT.test(raw.slice(Math.max(0, at - 50), at).replace(/'''|\{\{/g, ""));
    if (!best || (!soft && (best.soft || r > best.rank)) || (soft && best.soft && r > best.rank)) best = { value: c, rank: r, soft };
  }
  return best;
}
export const rankLevel = (raw: string) => bestOf(plain(raw), LEVELS, tierRank) ?? rankTier(raw);
export const rankStrike = (raw: string) => bestOf(plain(raw), [...LEVELS, ...STRIKE_CLASSES], tierRank) ?? rankTier(raw);
export const rankSpeed = (raw: string) => bestOf(plain(raw), SPEEDS, (v) => SPEEDS.indexOf(v));
export const rankLift = (raw: string) => bestOf(plain(raw), LIFTS, (v) => LIFTS.indexOf(v));

export function qualifierOf(text: string): string {
  const t = text.toLowerCase();
  if (/^\s*unknown\b/.test(t)) return "unknown";
  if (/^\s*varies\b/.test(t)) return "varies";
  if (/^\s*at least\b/.test(t)) return "at least";
  if (/^\s*(possibly|likely|probably)\b/.test(t)) return "possibly";
  return "";
}

// ---------- section parsing ----------
const LABELS: Record<string, string> = {
  "tier": "tier", "key": "key", "attack potency": "attack_potency", "speed": "speed", "lifting strength": "lifting_strength",
  "striking strength": "striking_strength", "durability": "durability", "stamina": "stamina", "range": "range",
  "standard equipment": "equipment", "intelligence": "intelligence", "weaknesses": "weaknesses", "weakness": "weaknesses",
  "notable attacks/techniques": "attacks", "notable attacks / techniques": "attacks", "notable techniques": "attacks",
  "powers and abilities": "abilities", "note": "note", "notes": "note", "origin": "origin",
};
export const STAT_CATEGORIES = ["tier", "attack_potency", "speed", "lifting_strength", "striking_strength", "durability", "stamina", "range", "equipment", "intelligence", "weaknesses"];

const LABEL_LINE = /^\s*'''\s*(?:\[\[(?:[^\]|]*\|)?)?([A-Za-z][A-Za-z /]*?)(?:\]\])?\s*(?::\s*'''|'''\s*:)\s*(.*)$/;
/** Free-text lines that are often not split per key; when the split doesn't match the keys, they apply to all forms. */
const FREE_TEXT = new Set(["weaknesses", "equipment", "intelligence", "range", "stamina"]);

export interface ParsedPage {
  keys: string[];
  stats: Record<string, string[]>; // category -> raw text per key
  abilities: { section: string; ability: string; detail: string }[];
  attacks: string[];
  origin: string;
  note: string;
  issues: string[];
}

export function parsePage(wikitext: string): ParsedPage {
  const issues: string[] = [];
  const start = wikitext.search(/==\s*Powers and Stats\s*==/i);
  const origin = plain((wikitext.match(/'''Origin:'''\s*(.*)/i) ?? [])[1] ?? "");
  if (start < 0) return { keys: [], stats: {}, abilities: [], attacks: [], origin, note: "", issues: ["no Powers and Stats section"] };
  const rest = wikitext.slice(start).replace(/^==\s*Powers and Stats\s*==/i, "");
  const endRel = rest.search(/\n==[^=]/);
  const section = endRel >= 0 ? rest.slice(0, endRel) : rest;

  // Blocks: label line + following lines until the next label line.
  const blocks: { key: string; value: string }[] = [];
  for (const line of section.split("\n")) {
    const m = line.match(LABEL_LINE);
    const label = m ? LABELS[m[1].trim().toLowerCase()] : undefined;
    if (m && label) blocks.push({ key: label, value: m[2] });
    else if (blocks.length) blocks[blocks.length - 1].value += "\n" + line;
  }
  const get = (k: string) => blocks.find((b) => b.key === k)?.value ?? "";

  let keys = splitTop(get("key").split("\n")[0]).map(plain).filter(Boolean);
  // Some pages give the key as separate bold names without pipes; fall back to one form.
  const tierParts = splitTop(get("tier").split("\n")[0]);
  if (!keys.length) keys = tierParts.length > 1 ? tierParts.map((_, i) => `Form ${i + 1}`) : ["Base"];
  if (tierParts.length > 1 && tierParts.length !== keys.length) issues.push(`tier has ${tierParts.length} values but ${keys.length} keys`);

  const stats: Record<string, string[]> = {};
  for (const cat of STAT_CATEGORIES) {
    const v = get(cat).trim();
    if (!v) { if (["tier", "attack_potency", "speed", "durability"].includes(cat)) issues.push(`missing ${cat}`); continue; }
    const firstPara = FREE_TEXT.has(cat) ? v : v.split(/\n\s*\n/)[0];
    const flat = firstPara.replace(/\n/g, " ");
    const parts = splitTop(flat);
    if (parts.length === keys.length) stats[cat] = parts;
    else if (parts.length === 1 || FREE_TEXT.has(cat)) stats[cat] = keys.map(() => flat);
    else {
      stats[cat] = keys.map((_, i) => parts[Math.min(i, parts.length - 1)]);
      issues.push(`${cat} has ${parts.length} values but ${keys.length} keys`);
    }
  }

  // Abilities: bullet lines inside the Powers and Abilities block; section = current tab name.
  const abilities: { section: string; ability: string; detail: string }[] = [];
  let section2 = "";
  for (const line of get("abilities").split("\n")) {
    const tab = line.match(/(?:\|-\||\{\{!\}\}-\{\{!\}\})\s*([^=|{}]+?)\s*=/);
    if (tab) section2 = plain(tab[1]);
    const b = line.match(/^\s*(\*+)\s*(.*)$/);
    if (!b) continue;
    // The ability names are the bold text at the start of the bullet: '''[[Fire Manipulation]]''' & '''[[Sealing]]''' (...)
    const lead = b[2].match(/^((?:\s*(?:'''[^']*?(?:\[\[[^\]]*\]\][^']*?)*'''|Limited|Enhanced|&|,|and|\/)\s*)+)/i)?.[1] ?? b[2].split(/\s\(/)[0];
    const names = [...lead.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)].map((m) => m[1].trim());
    const label = names.length ? names : [plain(lead).replace(/:$/, "")].filter((x) => x && x.length < 60);
    for (const n of label) abilities.push({ section: section2, ability: n, detail: plain(b[2]).slice(0, 300) });
  }

  const attacks: string[] = [];
  for (const line of get("attacks").split("\n")) {
    const m = line.match(/^\s*\*?\s*'''([^']{2,80})'''/) ?? line.match(/^\s*\*\s*''([^']{2,80})''/);
    if (m) attacks.push(plain(m[1]).replace(/:$/, ""));
  }
  return { keys, stats, abilities, attacks, origin, note: plain(get("note")).slice(0, 500), issues };
}
