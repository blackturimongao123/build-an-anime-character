import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Character } from "@build-character/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const charactersPath = resolve(root, "data", "characters.json");
const manualDir = resolve(root, "public-shared", "portraits", "manual");
const outDir = resolve(root, "public-shared", "portraits");
const clientPortraits = resolve(root, "client", "public", "portraits");

const EXT_OK = new Set([".png", ".webp", ".jpg", ".jpeg"]);

function main() {
  if (!existsSync(manualDir)) {
    console.error("Manual folder missing:", manualDir);
    process.exit(1);
  }

  const chars = JSON.parse(readFileSync(charactersPath, "utf-8")) as Character[];
  const byId = new Map(chars.map((c) => [c.id, c]));
  mkdirSync(outDir, { recursive: true });
  mkdirSync(clientPortraits, { recursive: true });

  const files = readdirSync(manualDir).filter((f) => EXT_OK.has(extname(f).toLowerCase()));
  if (files.length === 0) {
    console.log("No images in manual folder.");
    return;
  }

  let changed = false;

  for (const c of chars) {
    const candidates = [c.id];
    let match: string | null = null;
    for (const base of candidates) {
      for (const ext of EXT_OK) {
        const name = `${base}${ext}`;
        if (files.includes(name)) {
          match = name;
          break;
        }
      }
      if (match) break;
    }
    if (!match) continue;

    const ext = extname(match);
    const src = resolve(manualDir, match);
    const destId = `${c.id}${ext}`;
    const dest = resolve(outDir, destId);
    const clientDest = resolve(clientPortraits, destId);
    copyFileSync(src, dest);
    copyFileSync(src, clientDest);
    const webPath = `/portraits/${c.id}${ext}`;
    if (c.portrait !== webPath) {
      c.portrait = webPath;
      changed = true;
    }
    console.log(`Imported ${match} -> ${c.id}`);
  }

  for (const f of files) {
    const base = f.replace(/\.[^.]+$/, "");
    const known = byId.has(base);
    if (!known) {
      console.warn(`Unused manual file (no matching character id): ${f}`);
    }
  }

  if (changed) {
    writeFileSync(charactersPath, JSON.stringify(chars, null, 2) + "\n", "utf-8");
    console.log("Updated data/characters.json");
  }
}

main();
