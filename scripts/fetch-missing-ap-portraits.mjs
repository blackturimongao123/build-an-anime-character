/**
 * Fetch missing portraits (Anime-Planet first) for non-Pokémon roster gaps.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readiness = JSON.parse(
  readFileSync(resolve(root, "data/roster-readiness.json"), "utf8"),
);
const chars = JSON.parse(
  readFileSync(resolve(root, "data/characters.json"), "utf8"),
);

const ids = readiness.missingPortrait.filter((id) => {
  const c = chars.find((x) => x.id === id);
  return c && c.series !== "Pokémon";
});

if (!ids.length) {
  console.log("No missing non-Pokémon portraits.");
  process.exit(0);
}

console.log(`Fetching ${ids.length} ids (AP first, AniList fallback)…`);
const r = spawnSync(
  "npx",
  ["tsx", "scripts/fetch-portraits-ids.ts", ...ids],
  { cwd: root, stdio: "inherit", shell: true },
);
process.exit(r.status ?? 1);
