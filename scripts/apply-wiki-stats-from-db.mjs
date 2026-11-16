/**
 * Apply wiki DB stats to characters.json, then refresh placeholder sidecar.
 *
 * Pipeline:
 *   npm run data:wiki-stat-keys   (optional; data:wiki-apply runs this first)
 *   node scripts/apply-wiki-stats-from-db.mjs
 *
 * Manual:
 *   npx tsx scripts/wiki-apply-from-db.ts
 *   npm run data:stat-placeholders-sync
 */
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("npx", ["tsx", "scripts/wiki-apply-from-db.ts"]);
run("node", ["scripts/sync-stat-placeholders.mjs"]);
