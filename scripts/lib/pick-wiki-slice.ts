import type { CharacterStats } from "@build-character/shared";
import type { WikiDbTabSlice } from "./wiki-db.js";

export type WikiSliceProfile = {
  tabFragments?: string[];
  statColumnIndex?: number;
  statKey?: string;
};

function uniformPhysical(s: CharacterStats): number | null {
  const vals = [s.strength, s.speed, s.abilities, s.durability];
  if (vals.every((v) => v === vals[0])) return vals[0]!;
  return null;
}

function physicalTotal(s: CharacterStats): number {
  return s.strength + s.speed + s.abilities + s.durability;
}

function degenerateSlice(s: WikiDbTabSlice): boolean {
  const u = uniformPhysical(s.stats);
  return u === 40 || u === 70;
}

function sliceScore(s: WikiDbTabSlice): number {
  if (degenerateSlice(s)) return -1;
  return physicalTotal(s.stats);
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pathMatches(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((h, i) => norm(h) === norm(b[i]!));
}

function tabPathKey(tabPath: string[]): string {
  return tabPath.map((p) => norm(p)).join(" / ");
}

function labelMatches(hay: string | null, needle: string): boolean {
  if (!hay || !needle) return false;
  const h = norm(hay);
  const n = norm(needle);
  return h === n || h.includes(n) || n.includes(h);
}

function statKeyPhrases(statKey: string): string[] {
  const parts = statKey
    .split(/[/|]/)
    .map((p) => p.trim())
    .filter(Boolean);
  return [statKey, ...parts];
}

export function pickWikiSlice(
  slices: WikiDbTabSlice[],
  profile: WikiSliceProfile | undefined,
  context?: {
    displayName?: string;
    wikiPage?: string;
    wikiStatKey?: string;
  },
): WikiDbTabSlice | null {
  if (!slices.length) return null;

  let pool = slices;

  if (profile?.tabFragments?.length) {
    const tabs = profile.tabFragments;
    const narrowed = pool.filter((s) => pathMatches(s.tabPath, tabs));
    if (narrowed.length) pool = narrowed;
  }

  if (profile?.statColumnIndex !== undefined) {
    const tabs = profile.tabFragments ?? [];
    const candidates = pool.filter(
      (s) =>
        s.columnIndex === profile.statColumnIndex &&
        (tabs.length === 0 || pathMatches(s.tabPath, tabs)),
    );
    if (candidates.length) {
      return [...candidates].sort((a, b) => sliceScore(b) - sliceScore(a))[0]!;
    }
  }

  const statKey =
    profile?.statKey ??
    context?.wikiStatKey ??
    deriveStatKeyFromWikiPage(context?.wikiPage);

  if (statKey) {
    for (const phrase of statKeyPhrases(statKey)) {
      const labeled = pool.filter((s) => labelMatches(s.columnLabel, phrase));
      if (labeled.length) {
        return pickBestAmong(labeled);
      }
      const tabHit = pool.filter((s) =>
        s.tabPath.some((p) => labelMatches(p, phrase)),
      );
      if (tabHit.length) return pickBestAmong(tabHit);
    }
  }

  if (context?.displayName) {
    const byName = pool.filter((s) =>
      labelMatches(s.columnLabel, context.displayName!),
    );
    if (byName.length) return pickBestAmong(byName);
  }

  return pickBestAmong(pool);
}

/** VS column / version fallback: best non-degenerate, else highest index (latest label). */
function pickBestAmong(pool: WikiDbTabSlice[]): WikiDbTabSlice {
  const ranked = [...pool].sort((a, b) => {
    const sa = sliceScore(a);
    const sb = sliceScore(b);
    if (sa !== sb) return sb - sa;
    const ta = tabPathKey(a.tabPath);
    const tb = tabPathKey(b.tabPath);
    if (ta !== tb) return tb.localeCompare(ta);
    return b.columnIndex - a.columnIndex;
  });
  const best = ranked.find((s) => sliceScore(s) >= 0);
  if (best) return best;
  const byLatest = [...pool].sort((a, b) => {
    const c = b.columnIndex - a.columnIndex;
    if (c !== 0) return c;
    return tabPathKey(b.tabPath).localeCompare(tabPathKey(a.tabPath));
  });
  return byLatest[0]!;
}

const SERIES_DISAMBIG = new Set([
  "one piece",
  "naruto",
  "bleach",
  "dragon ball",
  "fairy tail",
  "black clover",
  "hunter x hunter",
  "jujutsu kaisen",
  "demon slayer",
  "my hero academia",
  "attack on titan",
  "fullmetal alchemist",
  "fate",
  "pokémon",
  "pokemon",
  "one punch man",
  "sword art online",
  "tokyo ghoul",
  "record of ragnarok",
]);

export function deriveStatKeyFromWikiPage(wikiPage?: string): string | undefined {
  if (!wikiPage) return undefined;
  const m = wikiPage.match(/ \(([^)]+)\)\s*$/);
  if (!m) return undefined;
  const inner = m[1]!.trim();
  if (SERIES_DISAMBIG.has(norm(inner))) return undefined;
  return inner;
}

export function sliceDescriptor(slice: WikiDbTabSlice): {
  wikiStatKey?: string;
  wikiFragment?: string;
} {
  const wikiFragment =
    slice.tabPath.length > 0 ? slice.tabPath.join(" / ") : undefined;
  const wikiStatKey = slice.columnLabel ?? wikiFragment;
  return { wikiStatKey, wikiFragment };
}

const MANGA_RE = /\bmanga\b|manga continuity|manga only|magazine serialization/i;

/** VS tab/column is manga-only — excluded from anime/game peak apply. */
export function isMangaSlice(slice: WikiDbTabSlice): boolean {
  const parts = [...slice.tabPath, slice.columnLabel ?? ""];
  const blob = parts.join(" ");
  return MANGA_RE.test(blob);
}

export function filterNonMangaSlices(slices: WikiDbTabSlice[]): WikiDbTabSlice[] {
  const kept = slices.filter((s) => !isMangaSlice(s));
  return kept.length ? kept : slices;
}

function narrowSlicePool(
  slices: WikiDbTabSlice[],
  profile: WikiSliceProfile | undefined,
  context?: {
    displayName?: string;
    wikiPage?: string;
    wikiStatKey?: string;
  },
): WikiDbTabSlice[] {
  let pool = slices;

  if (profile?.tabFragments?.length) {
    const tabs = profile.tabFragments;
    const narrowed = pool.filter((s) => pathMatches(s.tabPath, tabs));
    if (narrowed.length) pool = narrowed;
  }

  if (profile?.statColumnIndex !== undefined) {
    const tabs = profile.tabFragments ?? [];
    pool = pool.filter(
      (s) =>
        s.columnIndex === profile.statColumnIndex &&
        (tabs.length === 0 || pathMatches(s.tabPath, tabs)),
    );
    if (!pool.length) return slices;
  }

  const statKey =
    profile?.statKey ??
    context?.wikiStatKey ??
    deriveStatKeyFromWikiPage(context?.wikiPage);

  if (statKey) {
    for (const phrase of statKeyPhrases(statKey)) {
      const labeled = pool.filter((s) => labelMatches(s.columnLabel, phrase));
      if (labeled.length) return labeled;
      const tabHit = pool.filter((s) =>
        s.tabPath.some((p) => labelMatches(p, phrase)),
      );
      if (tabHit.length) return tabHit;
    }
  }

  if (context?.displayName) {
    const byName = pool.filter((s) =>
      labelMatches(s.columnLabel, context.displayName!),
    );
    if (byName.length) return byName;
  }

  return pool;
}

const PHYSICAL: (keyof CharacterStats)[] = [
  "strength",
  "speed",
  "abilities",
  "durability",
];

/**
 * Per-category max across slices (after profile narrow + manga exclusion).
 */
export function peakPhysicalFromSlices(
  slices: WikiDbTabSlice[],
  profile?: WikiSliceProfile,
  context?: {
    displayName?: string;
    wikiPage?: string;
    wikiStatKey?: string;
  },
): {
  stats: CharacterStats;
  wikiStatKey: string;
  wikiFragment?: string;
} | null {
  if (!slices.length) return null;

  let pool = narrowSlicePool(slices, profile, context);
  pool = filterNonMangaSlices(pool);
  const usable = pool.filter((s) => !degenerateSlice(s));
  if (!usable.length) return null;

  const stats: CharacterStats = {
    strength: 0,
    speed: 0,
    abilities: 0,
    iq: 0,
    durability: 0,
  };
  for (const key of PHYSICAL) {
    let best = -1;
    for (const s of usable) {
      const v = s.stats[key];
      if (v > best) best = v;
    }
    stats[key] = Math.max(0, best);
  }

  return {
    stats,
    wikiStatKey: "peak (non-manga)",
    wikiFragment: profile?.tabFragments?.join(" / "),
  };
}
