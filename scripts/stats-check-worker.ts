/**
 * Long-lived worker: one JSON line in ({ "id": "..." }), one JSON CheckResult out.
 * Used by stats-check (Rust) for parallel wiki stat verification.
 */
import * as readline from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkOne } from "./lib/stats-check-one.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

for await (const line of rl) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  try {
    const { id } = JSON.parse(trimmed) as { id: string };
    const result = await checkOne(id, root);
    process.stdout.write(JSON.stringify(result) + "\n");
  } catch (e) {
    process.stdout.write(
      JSON.stringify({
        id: "unknown",
        ok: false,
        error: (e as Error).message,
      }) + "\n",
    );
  }
}
