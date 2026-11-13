/** Split roster into N shard files for parallel scrape workers. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Character } from "@build-character/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const shards = parseInt(process.argv[2] ?? "8", 10);
const chars = JSON.parse(
  readFileSync(resolve(root, "data", "characters.json"), "utf-8"),
) as Character[];
const sorted = [...chars].sort((a, b) => a.id.localeCompare(b.id));
const dir = resolve(root, "data", "wiki-db", "shards");
mkdirSync(dir, { recursive: true });

for (let s = 0; s < shards; s++) {
  const ids = sorted.filter((_, i) => i % shards === s).map((c) => c.id);
  writeFileSync(
    resolve(dir, `shard-${s}.json`),
  `${JSON.stringify({ shard: s, shards, ids }, null, 2)}\n`,
    "utf-8",
  );
  console.log(`shard-${s}: ${ids.length} ids`);
}
