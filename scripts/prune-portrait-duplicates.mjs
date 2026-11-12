import { readFileSync, readdirSync, unlinkSync, existsSync } from "node:fs";
import { resolve, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const chars = JSON.parse(
  readFileSync(resolve(root, "data", "characters.json"), "utf-8"),
);
const exts = new Set([".webp", ".jpg", ".jpeg", ".png"]);
const ids = new Set(chars.map((c) => c.id));
const canonical = new Map(
  chars.map((c) => [c.id, extname(c.portrait).toLowerCase()]),
);

for (const dir of [
  resolve(root, "public-shared", "portraits"),
  resolve(root, "client", "public", "portraits"),
]) {
  if (!existsSync(dir)) continue;
  let removed = 0;
  for (const name of readdirSync(dir)) {
    if (name === "manual") continue;
    const ext = extname(name).toLowerCase();
    if (!exts.has(ext)) continue;
    const id = basename(name, ext);
    if (!ids.has(id)) {
      unlinkSync(resolve(dir, name));
      removed++;
      continue;
    }
    const keep = canonical.get(id);
    if (keep && ext !== keep) {
      unlinkSync(resolve(dir, name));
      removed++;
    }
  }
  console.log(`${dir}: removed ${removed} stale/duplicate file(s)`);
}
