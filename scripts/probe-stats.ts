import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchWikiHtml,
  mapStatsFromWikiHtml,
  narrowHtmlToTabFragments,
  slicePowersAndStatsSection,
} from "./lib/wiki-stats.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const profilePath = resolve(root, "data", "wiki-profile-hints.json");
const hintsPath = resolve(root, "data", "wiki-hints.json");

const ids = process.argv.slice(2);
const profiles = JSON.parse(readFileSync(profilePath, "utf-8")) as Record<
  string,
  {
    tabFragments?: string[];
    statKey?: string;
    statColumnIndex?: number;
    statFormPhrase?: string;
  }
>;
const hints = JSON.parse(readFileSync(hintsPath, "utf-8")) as Record<
  string,
  string
>;

for (const id of ids) {
  const title = hints[id];
  const profile = profiles[id];
  if (!title) {
    console.log(id, "missing hint");
    continue;
  }
  let html = await fetchWikiHtml(title, root);
  html = slicePowersAndStatsSection(html);
  if (profile?.tabFragments?.length) {
    html = narrowHtmlToTabFragments(html, profile.tabFragments);
  }
  const stats = mapStatsFromWikiHtml(html, {
    statKey:
      profile?.statColumnIndex !== undefined ? undefined : profile?.statKey,
    statColumnIndex: profile?.statColumnIndex,
    statFormPhrase: profile?.statFormPhrase,
  });
  console.log(JSON.stringify({ id, title, stats }));
}
