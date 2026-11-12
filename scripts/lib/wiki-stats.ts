import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tierStringToScore, clampScore } from "@build-character/shared";
import type { CharacterStats } from "@build-character/shared";

const WIKI_API = "https://vsbattles.fandom.com/api.php";

export const DELAY_MS = 500;

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function cacheDirFrom(root: string) {
  return resolve(root, "data", "raw-wiki");
}

export async function searchWikiPage(query: string): Promise<string | null> {
  const url = new URL(WIKI_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", query);
  url.searchParams.set("srlimit", "8");
  url.searchParams.set("format", "json");

  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    query?: { search?: Array<{ title: string }> };
  };
  const hits = json.query?.search ?? [];
  const forbidden = /category:|tier |vs battles|discussion|policy/i;
  for (const hit of hits) {
    if (forbidden.test(hit.title)) continue;
    return hit.title;
  }
  return hits[0]?.title ?? null;
}

export async function fetchWikiHtml(
  title: string,
  root: string,
): Promise<string> {
  const cacheDir = cacheDirFrom(root);
  mkdirSync(cacheDir, { recursive: true });
  const safe = title.replace(/[^\w()-]+/g, "_");
  const cacheFile = resolve(cacheDir, `${safe}.html`);

  if (existsSync(cacheFile)) {
    return readFileSync(cacheFile, "utf-8");
  }

  const url = new URL(WIKI_API);
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", title);
  url.searchParams.set("format", "json");
  url.searchParams.set("prop", "text");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wiki fetch failed: ${title} ${res.status}`);
  const json = (await res.json()) as { parse?: { text?: { "*": string } } };
  const html = json.parse?.text?.["*"];
  if (!html) throw new Error(`No parse content for ${title}`);

  writeFileSync(cacheFile, html, "utf-8");
  await sleep(DELAY_MS);
  return html;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

/** VS Battles uses <a href="/wiki/Attack_Potency">…</a>:</b> …</p> (not only tables). */
export function extractStatBlock(html: string, wikiSlug: string): string | null {
  const re = new RegExp(
    `<a[^>]*href="/wiki/${wikiSlug}"[^>]*>[\\s\\S]*?</a>\\s*:?\\s*</b>\\s*([\\s\\S]*?)</p>`,
    "gi",
  );
  const chunks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const text = stripHtml(m[1]);
    if (text) chunks.push(text);
  }
  if (chunks.length) return chunks.join(" | ");

  for (const label of [wikiSlug.replace(/_/g, " "), wikiSlug]) {
    const re2 = new RegExp(
      `${label}[\\s\\S]{0,200}?<td[^>]*>([\\s\\S]*?)</td>`,
      "i",
    );
    const m2 = html.match(re2);
    if (m2?.[1]) {
      const text = stripHtml(m2[1]);
      if (text) return text;
    }
  }
  return null;
}

const TIER_PHRASE =
  /(?:High |Low |At least |Likely |Up to |Possibly )?(?:\d+-[A-C]|(?:Small |Large |Multi-)?[A-Za-z][\w\- ]*levels?|Boundless|Universe(?:\s+level)?|Multiversal|Hyperversal|Outerversal|Galaxy(?:\s+level)?|Solar System(?:\s+level)?|Star(?:\s+level)?|Continent(?:\s+level)?|Country(?:\s+level)?|Island(?:\s+level)?|Mountain(?:\s+level)?|City(?:\s+Block)?(?:\s+level)?|Building(?:\s+level)?|Wall(?:\s+level)?|Street(?:\s+level)?|Human(?:\s+level)?|Athlete(?:\s+level)?|Below Average Human(?:\s+level)?|Large Town level|Small Town level|Town level)/gi;

const EXTRA_PHRASE_SCORES: [RegExp, number][] = [
  [/boundless/i, 100],
  [/multi-outerversal|high 1-a/i, 99],
  [/outerversal|1-[abc]/i, 98],
  [/multiversal|2-[abc]/i, 96],
  [/universal|3-a|high 3-a/i, 95],
  [/galaxy|3-[bc]/i, 92],
  [/solar system|4-b/i, 90],
  [/large star|high 4-c/i, 88],
  [/star level|4-c/i, 86],
  [/large planet|high 5-b/i, 82],
  [/planet level|5-b/i, 80],
  [/multi-continent/i, 78],
  [/large country|high 6-b/i, 74],
  [/country level|6-b/i, 70],
  [/large island|high 6-c/i, 68],
  [/island level|6-c/i, 66],
  [/mountain level|7-a/i, 62],
  [/city level|7-b/i, 58],
  [/large town level|high 7-c/i, 54],
  [/town level|7-c/i, 52],
  [/city block|8-b/i, 46],
  [/building level|8-c/i, 38],
  [/wall level|9-b/i, 28],
  [/street level|9-c/i, 22],
  [/sub-relativistic\+?|mftl|ftl/i, 88],
  [/relativistic/i, 82],
  [/hypersonic\+?/i, 68],
  [/supersonic\+?/i, 48],
  [/transonic|subsonic/i, 32],
  [/class y|multi-solar system/i, 90],
  [/class x|solar system/i, 88],
  [/class p\b|billion tons/i, 88],
  [/class e\b|exajoule/i, 90],
  [/class z\b/i, 85],
  [/class\s*1000\b/i, 48],
  [/class\s*500\b/i, 44],
  [/class\s*100\b/i, 40],
  [/class\s*50\b/i, 52],
  [/class\s*25\b/i, 44],
  [/class\s*10\b/i, 28],
  [/class\s*5\b/i, 32],
  [/class\s*1\b/i, 20],
  [/superhuman\b/i, 36],
  [/class m\b|million tons/i, 58],
  [/class g\b|billion tons/i, 68],
  [/class k\b|thousand tons/i, 48],
  [/class mj|megajoule/i, 35],
  [/class kj/i, 28],
];

export function maxTierScore(text: string | null, fallback = 40): number {
  if (!text) return fallback;
  let best = 0;
  const matches = text.match(TIER_PHRASE) ?? [];
  for (const phrase of matches) {
    const s = tierStringToScore(phrase);
    if (s !== null) best = Math.max(best, s);
  }
  for (const [re, score] of EXTRA_PHRASE_SCORES) {
    if (re.test(text)) best = Math.max(best, score);
  }
  const whole = tierStringToScore(text);
  if (whole !== null) best = Math.max(best, whole);
  return clampScore(best > 0 ? best : fallback);
}

export function maxSpeedScore(text: string | null): number {
  return maxTierScore(text, 40);
}

export function maxStrengthScore(text: string | null): number {
  return maxTierScore(text, 40);
}

/** Techniques that are not treated as physical movement/combat speed (e.g. Instant Transmission). */
const NON_PHYSICAL_SPEED =
  /instant(?:aneous)?\s+travel|instant\s+transmission|teleportation|\bteleport\b|flying\s+raijin|kunai\s+swap|swap\s+places|time\s+stop|time\s+freeze|omnipresence|dimensional\s+(travel|hop)|body\s+flicker\s+technique/i;

/** Prefer the highest **physical** speed tier in a pipe- or comma-separated VS Battles row. */
export function maxPhysicalSpeedScore(text: string | null, fallback = 40): number {
  if (!text) return fallback;
  const parts = text.split(/\|/).flatMap((col) => col.split(/\s*,\s*(?=[A-Za-z])/));
  let best = 0;
  let keptPhysical = false;
  for (const part of parts) {
    const p = part.trim();
    if (!p || NON_PHYSICAL_SPEED.test(p)) continue;
    keptPhysical = true;
    best = Math.max(best, maxTierScore(p, 0));
  }
  if (!keptPhysical) return maxTierScore(text, fallback);
  return clampScore(best > 0 ? best : fallback);
}

const DURABILITY_ANCHORS: [RegExp, number][] = [
  [/true immortality|cannot die|can't die|immortal(?:ity)?/i, 99],
  [/invulnerab|intangib|cannot be (?:harmed|damaged|killed)/i, 97],
  [/cannot be erased|existence erasure|resist(?:ance)?\s+to\s+reality/i, 96],
  [/resist(?:ance)?\s+to\s+time|time paradox/i, 94],
];

export function maxDurabilityScore(text: string | null, fallback = 40): number {
  let best = maxTierScore(text, fallback);
  if (text) {
    for (const [re, score] of DURABILITY_ANCHORS) {
      if (re.test(text)) best = Math.max(best, score);
    }
  }
  return clampScore(best);
}

export function slicePowersAndAbilitiesSection(html: string): string | null {
  const m = html.match(
    /<h2>[\s\S]*?id="Powers_and_Abilities"[\s\S]*?<\/h2>/i,
  );
  if (m?.index === undefined) return null;
  const start = m.index;
  const tail = html.slice(start + m[0].length);
  const next = tail.search(/<h2[\s>]/i);
  const chunk = next >= 0 ? tail.slice(0, next) : tail.slice(0, 14_000);
  const text = stripHtml(chunk);
  return text || null;
}

const INT_WORD_SCORES: [RegExp, number][] = [
  [/omniscient|genius|superhuman intelligence/i, 85],
  [/genius|masterful strategist|gifted/i, 72],
  [/above average|high|acute/i, 55],
  [/average|normal/i, 35],
  [/below average|low|incompetent/i, 22],
  [/animal|mindless/i, 12],
];

function intelligenceToScore(text: string | null): number | null {
  if (!text) return null;
  const tier = tierStringToScore(text);
  if (tier !== null) return tier;
  for (const [re, score] of INT_WORD_SCORES) {
    if (re.test(text)) return score;
  }
  return null;
}

export type WikiStatSliceOptions = {
  /** Match a column in pipe-separated VS Battles "Key:" timelines (partial match). */
  statKey?: string;
  /** 0-based pipe column for multi-timeline stat rows (overrides statKey). */
  statColumnIndex?: number;
  /** Narrow stat text to clauses mentioning this form (e.g. "Super Saiyan 2"). */
  statFormPhrase?: string;
};

function normalizeTabHash(input: string): string {
  const decoded = decodeURIComponent(input.replace(/\+/g, " "));
  return decoded
    .replace(/[▾▼]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/'/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

function hashMatches(dataHash: string, target: string): boolean {
  return normalizeTabHash(dataHash) === normalizeTabHash(target);
}

function extractTabberPanels(
  tabberHtml: string,
): { hashes: string[]; panels: string[] } | null {
  const tabsUl = tabberHtml.match(/<ul class="wds-tabs">([\s\S]*?)<\/ul>/);
  if (!tabsUl) return null;
  const hashes: string[] = [];
  for (const m of tabsUl[1].matchAll(/data-hash="([^"]+)"/g)) hashes.push(m[1]);
  if (!hashes.length) return null;

  const wrapperEnd = tabberHtml.indexOf(tabsUl[0]) + tabsUl[0].length;
  let rest = tabberHtml.slice(wrapperEnd);
  const close = rest.indexOf("</div>");
  if (close >= 0) rest = rest.slice(close + "</div>".length);

  const panels: string[] = [];
  for (let i = 0; i < hashes.length; i++) {
    const open = rest.match(/<div class="wds-tab__content[^"]*">/);
    if (!open || open.index === undefined) break;
    const start = open.index;
    const innerStart = start + open[0].length;
    const next = rest.slice(innerStart).search(/<div class="wds-tab__content[^"]*">/);
    const end = next >= 0 ? innerStart + next : rest.length;
    panels.push(rest.slice(start, end));
    rest = rest.slice(end);
  }
  return panels.length ? { hashes, panels } : null;
}

function firstTabberAfter(html: string, start: number): number {
  return html.indexOf('<div class="tabber wds-tabber">', start);
}

/** Drill into nested Fandom tabbers by data-hash (first matching tabber at each step). */
export function narrowHtmlToTabFragments(
  html: string,
  fragments: string[],
): string {
  let scope = html;
  let searchFrom = 0;
  for (const frag of fragments) {
    const candidates: string[] = [];
    let pos = firstTabberAfter(scope, searchFrom);
    while (pos >= 0) {
      const panels = extractTabberPanels(scope.slice(pos));
      if (panels) {
        const idx = panels.hashes.findIndex((h) => hashMatches(h, frag));
        if (idx >= 0 && panels.panels[idx]) {
          candidates.push(panels.panels[idx]);
        }
      }
      pos = firstTabberAfter(scope, pos + 1);
    }
    const found =
      candidates.find((p) => /href="\/wiki\/Attack_Potency"/i.test(p)) ?? null;
    if (!found) return scope;
    scope = found;
    searchFrom = 0;
  }
  return scope;
}

/** Slice page HTML from the Powers and Stats headline through end of parse output. */
export function slicePowersAndStatsSection(html: string): string {
  const m = html.match(
    /<h2>[\s\S]*?id="Powers_and_Stats"[\s\S]*?<\/h2>/i,
  );
  if (m?.index !== undefined) return html.slice(m.index);
  return html;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Prefer pipe-column clauses that name a specific transformation. */
function sliceStatTextForForm(text: string, phrase: string): string {
  if (!phrase.trim()) return text;
  const re = new RegExp(
    `((?:with|as)\\s+${escapeRegExp(phrase)}[\\s\\S]*?)(?=\\s*,\\s*(?:with|as)\\s+|\\s*\\|\\s*|$)`,
    "i",
  );
  const parts = text.split("|").map((s) => s.trim());
  for (const part of parts) {
    if (part.toLowerCase().includes(phrase.toLowerCase())) return part;
    const m = part.match(re);
    if (m?.[1]) return m[1];
  }
  const whole = text.match(re);
  if (whole?.[1]) return whole[1];
  const idx = text.toLowerCase().indexOf(phrase.toLowerCase());
  if (idx >= 0) {
    return text.slice(Math.max(0, idx - 80), idx + phrase.length + 160);
  }
  return text;
}

function extractKeyColumnIndex(html: string, statKey: string): number | null {
  const re = /<p>\s*<b>\s*Key:\s*<\/b>\s*([\s\S]*?)<\/p>/i;
  const m = html.match(re);
  if (!m?.[1]) return null;
  const parts = stripHtml(m[1])
    .split("|")
    .map((s) => s.trim());
  const needle = statKey.toLowerCase();
  const idx = parts.findIndex((p) => p.toLowerCase().includes(needle));
  return idx >= 0 ? idx : null;
}

function slicePipeColumn(text: string, index: number | null): string {
  if (index === null || index < 0) return text;
  const parts = text.split("|").map((s) => s.trim());
  if (index < parts.length && parts[index]) return parts[index];
  return text;
}

function applyStatFormPhrase(text: string | null, phrase?: string): string | null {
  if (!text || !phrase?.trim()) return text;
  const sliced = sliceStatTextForForm(text, phrase);
  if (
    sliced === text &&
    !new RegExp(escapeRegExp(phrase), "i").test(text)
  ) {
    return text;
  }
  return sliced;
}

function extractFirstStatBlock(html: string, wikiSlug: string): string | null {
  const re = new RegExp(
    `<a[^>]*href="/wiki/${wikiSlug}"[^>]*>[\\s\\S]*?</a>\\s*:?\\s*</b>\\s*([\\s\\S]*?)</p>`,
    "i",
  );
  const m = html.match(re);
  if (m?.[1]) {
    const text = stripHtml(m[1]);
    if (text) return text;
  }
  return null;
}

/** Prefer the pipe-richest stat row (matches VS Battles "Key:" timelines). */
function extractKeyedStatBlock(html: string, wikiSlug: string): string | null {
  const keyMatch = html.match(/<p>\s*<b>\s*Key:\s*<\/b>/i);
  const scope =
    keyMatch?.index !== undefined ? html.slice(keyMatch.index) : html;
  const re = new RegExp(
    `<a[^>]*href="/wiki/${wikiSlug}"[^>]*>[\\s\\S]*?</a>\\s*:?\\s*</b>\\s*([\\s\\S]*?)</p>`,
    "gi",
  );
  let best: string | null = null;
  let bestPipes = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(scope))) {
    const text = stripHtml(m[1]);
    if (!text) continue;
    const pipes = (text.match(/\|/g) ?? []).length;
    if (pipes > bestPipes) {
      best = text;
      bestPipes = pipes;
    }
  }
  return best ?? extractFirstStatBlock(html, wikiSlug);
}

function extractStatBlockForKey(
  html: string,
  wikiSlug: string,
  keyIndex: number | null,
): string | null {
  const raw =
    keyIndex !== null
      ? extractKeyedStatBlock(html, wikiSlug)
      : extractStatBlock(html, wikiSlug);
  if (!raw) return null;
  return slicePipeColumn(raw, keyIndex);
}

export function mapStatsFromWikiHtml(
  html: string,
  options?: WikiStatSliceOptions,
): CharacterStats {
  const keyIndex =
    options?.statColumnIndex !== undefined
      ? options.statColumnIndex
      : options?.statKey
        ? extractKeyColumnIndex(html, options.statKey)
        : null;

  const formPhrase = options?.statFormPhrase;

  let liftingRaw = extractStatBlockForKey(html, "Lifting_Strength", keyIndex);
  let strikingRaw = extractStatBlockForKey(html, "Striking_Strength", keyIndex);
  const lifting = applyStatFormPhrase(liftingRaw, formPhrase);
  const striking = applyStatFormPhrase(strikingRaw, formPhrase);
  const speed = applyStatFormPhrase(
    extractStatBlockForKey(html, "Speed", keyIndex) ??
      extractStatBlockForKey(html, "Combat_Speed", keyIndex),
    formPhrase,
  );
  const ap = applyStatFormPhrase(
    extractStatBlockForKey(html, "Attack_Potency", keyIndex) ??
      extractStatBlockForKey(html, "Destructive_Capacity", keyIndex),
    formPhrase,
  );
  const powers = slicePowersAndAbilitiesSection(html);
  const iqRaw = applyStatFormPhrase(
    extractStatBlockForKey(html, "Intelligence", keyIndex),
    formPhrase,
  );
  const dur = applyStatFormPhrase(
    extractStatBlockForKey(html, "Durability", keyIndex) ??
      extractStatBlockForKey(html, "Stamina", keyIndex),
    formPhrase,
  );

  const liftingScore = maxStrengthScore(
    lifting && !/^unknown/i.test(lifting.trim()) ? lifting : striking,
  );
  const strikingScore = maxStrengthScore(striking);
  const strength = Math.max(liftingScore, strikingScore);
  const speedScore = maxPhysicalSpeedScore(speed);
  let abilities = Math.max(
    maxTierScore(ap),
    powers ? maxTierScore(powers) : 0,
  );
  if (formPhrase && abilities <= 40) {
    const tier = applyStatFormPhrase(
      extractStatBlockForKey(html, "Tiering_System", keyIndex),
      formPhrase,
    );
    abilities = Math.max(maxTierScore(tier), abilities);
  }
  const iqFromWords = intelligenceToScore(iqRaw);
  const iqScore =
    iqFromWords !== null
      ? clampScore(iqFromWords)
      : maxTierScore(iqRaw, 40);
  const durability = maxDurabilityScore(dur);

  return {
    strength,
    speed: speedScore,
    abilities,
    iq: iqScore,
    durability,
  };
}
