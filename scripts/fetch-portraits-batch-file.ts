import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const listPath =
  process.argv[2] ?? resolve(root, "data", "roster-batch2-new-ids.txt");
const chunk = parseInt(process.argv[3] ?? "25", 10);

if (!existsSync(listPath)) {
  console.error("Missing ids file:", listPath);
  process.exit(1);
}
const ids = readFileSync(listPath, "utf-8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);
console.log(`Portrait batch: ${ids.length} ids, chunk=${chunk}`);

const tsx = resolve(root, "node_modules", "tsx", "dist", "cli.mjs");
for (let i = 0; i < ids.length; i += chunk) {
  const slice = ids.slice(i, i + chunk);
  console.log(`\n--- chunk ${i / chunk + 1} (${slice.length}) ---`);
  const r = spawnSync(process.execPath, [tsx, "fetch-portraits-ids.ts", ...slice], {
    cwd: resolve(root, "scripts"),
    stdio: "inherit",
    env: process.env,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
