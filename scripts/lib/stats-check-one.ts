import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Character, CharacterStats } from "@build-character/shared";
import {
  fetchWikiHtml,
  mapStatsFromWikiHtml,
  narrowHtmlToTabFragments,
  searchWikiPage,
  slicePowersAndStatsSection,
  sleep,
} from "./wiki-stats.js";

export type ProfileHint = {
  fragment?: string;
  tabFragments?: string[];
  powersSection?: boolean;
  statKey?: string;
  statColumnIndex?: number;
  statFormPhrase?: string;
  wikiUrlBase?: string;
};

export type CheckResult = {
  id: string;
  ok: boolean;
  wikiPage?: string;
  error?: string;
  expected?: CharacterStats;
  stored?: CharacterStats;
  delta?: Partial<Record<keyof CharacterStats, number>>;
};

function simplifyName(displayName: string): string {
  return displayName.replace(/\s*\([^)]*\)\s*/g, " ").trim();
}

async function resolveWikiTitle(
  c: Character,
  hints: Record<string, string>,
): Promise<string | null> {
  if (hints[c.id]) return hints[c.id]!;
  if (c.sources?.wikiPage) return c.sources.wikiPage;
  const base = simplifyName(c.displayName);
  const queries = [c.displayName, `${base} ${c.series}`, base];
  for (const q of queries) {
    const title = await searchWikiPage(q);
    if (title) return title;
    await sleep(150);
  }
  return null;
}

export async function computeStatsForCharacter(
  c: Character,
  root: string,
  hints: Record<string, string>,
  statKeys: Record<string, string>,
  profileHints: Record<string, ProfileHint>,
): Promise<{ wikiPage: string; stats: CharacterStats }> {
  const wikiTitle = await resolveWikiTitle(c, hints);
  if (!wikiTitle) throw new Error("no wiki page found");

  let html = await fetchWikiHtml(wikiTitle, root);
  const profile = profileHints[c.id];
  if (profile?.powersSection !== false) {
    html = slicePowersAndStatsSection(html);
  }
  if (profile?.tabFragments?.length) {
    html = narrowHtmlToTabFragments(html, profile.tabFragments);
  }
  const statKey = profile?.statKey ?? statKeys[c.id];
  const statColumnIndex = profile?.statColumnIndex;
  const stats = mapStatsFromWikiHtml(html, {
    statKey: statColumnIndex !== undefined ? undefined : statKey,
    statColumnIndex,
    statFormPhrase: profile?.statFormPhrase,
  });
  return { wikiPage: wikiTitle, stats };
}

function statDelta(
  stored: CharacterStats,
  expected: CharacterStats,
): Partial<Record<keyof CharacterStats, number>> {
  const keys = ["strength", "speed", "abilities", "iq", "durability"] as const;
  const d: Partial<Record<keyof CharacterStats, number>> = {};
  for (const k of keys) {
    const diff = expected[k] - stored[k];
    if (diff !== 0) d[k] = diff;
  }
  return d;
}

export async function checkOne(
  id: string,
  root: string,
): Promise<CheckResult> {
  const charactersPath = resolve(root, "data", "characters.json");
  const hintsPath = resolve(root, "data", "wiki-hints.json");
  const statKeysPath = resolve(root, "data", "wiki-stat-keys.json");
  const profileHintsPath = resolve(root, "data", "wiki-profile-hints.json");

  const chars = JSON.parse(readFileSync(charactersPath, "utf-8")) as Character[];
  const c = chars.find((x) => x.id === id);
  if (!c) return { id, ok: false, error: "unknown id" };

  const hints: Record<string, string> = existsSync(hintsPath)
    ? JSON.parse(readFileSync(hintsPath, "utf-8"))
    : {};
  const statKeys: Record<string, string> = existsSync(statKeysPath)
    ? JSON.parse(readFileSync(statKeysPath, "utf-8"))
    : {};
  const profileHints: Record<string, ProfileHint> = existsSync(
    profileHintsPath,
  )
    ? JSON.parse(readFileSync(profileHintsPath, "utf-8"))
    : {};

  const stored = c.stats ?? {
    strength: 0,
    speed: 0,
    abilities: 0,
    iq: 0,
    durability: 0,
  };

  try {
    const { wikiPage, stats: expected } = await computeStatsForCharacter(
      c,
      root,
      hints,
      statKeys,
      profileHints,
    );
    const delta = statDelta(stored, expected);
    const ok = Object.keys(delta).length === 0;
    return {
      id,
      ok,
      wikiPage,
      expected,
      stored,
      ...(ok ? {} : { delta }),
    };
  } catch (e) {
    return { id, ok: false, error: (e as Error).message, stored: c.stats };
  }
}
