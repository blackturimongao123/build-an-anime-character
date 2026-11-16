/**
 * Apply data/ap-portrait-proxies.json (manual AP slug fallbacks when no dedicated page).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const proxies = JSON.parse(
  readFileSync(resolve(root, "data/ap-portrait-proxies.json"), "utf8"),
);
const hints = JSON.parse(
  readFileSync(resolve(root, "data/anime-planet-hints.json"), "utf8"),
);

for (const [id, slug] of Object.entries(proxies)) {
  hints[id] = slug;
}
writeFileSync(
  resolve(root, "data/anime-planet-hints.json"),
  JSON.stringify(hints, null, 2) + "\n",
);

const ids = Object.keys(proxies);
console.log(`Proxy fetch for ${ids.length} ids…`);
const r = spawnSync(
  "npx",
  ["tsx", "scripts/fetch-portraits-ids.ts", ...ids],
  { cwd: root, stdio: "inherit", shell: true },
);
process.exit(r.status ?? 1);
