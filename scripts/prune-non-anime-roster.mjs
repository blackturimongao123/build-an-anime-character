/**
 * @deprecated Use `apply-non-anime-removals.mjs` (curated list).
 * Dry-run: report audit lines for manual review only — never writes roster.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const auditPath = resolve(root, "data/audit-anime-cast-misses.txt");

console.log(
  "Automatic AP-cast pruning was disabled (false positives on incomplete slug maps).",
);
console.log("Add confirmed ids to data/non-anime-roster-removals.json");
console.log("Then: node node_modules/tsx/dist/cli.mjs scripts/apply-non-anime-removals.mjs");
console.log("");

if (readFileSync(auditPath, "utf8").includes("NOT on anime cast")) {
  console.log(`See ${auditPath} for candidates (verify each before adding).`);
}
