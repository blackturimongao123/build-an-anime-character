import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shards = parseInt(process.argv[2] ?? "8", 10);
const src = resolve(root, process.argv[3] ?? "data/roster-batch2-new-ids.txt");
const dir = resolve(root, "data", "wiki-db", "shards", "batch-new");
mkdirSync(dir, { recursive: true });
const ids = readFileSync(src, "utf-8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);
for (let s = 0; s < shards; s++) {
  const slice = ids.filter((_, i) => i % shards === s);
  writeFileSync(resolve(dir, `shard-${s}.txt`), slice.join("\n") + "\n");
  console.log(`shard-${s}: ${slice.length}`);
}
