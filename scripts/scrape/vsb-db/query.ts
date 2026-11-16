/**
 * Ad-hoc SQL against the VS Battles DB. Usage: npm run wiki:db-query -- "SELECT ... "
 */
import { DatabaseSync } from "node:sqlite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const db = new DatabaseSync(resolve(root, "data/wiki-db/vsb-stats.sqlite"), { readOnly: true });
const rows = db.prepare(process.argv.slice(2).join(" ")).all() as Record<string, unknown>[];
for (const r of rows) console.log(Object.values(r).map((v) => (v === null ? "∅" : String(v))).join(" | "));
console.log(`(${rows.length} rows)`);
