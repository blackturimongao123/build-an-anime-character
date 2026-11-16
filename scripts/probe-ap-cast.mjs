import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { parseAnimeCastPage, pickCastRow, castThumbToPrimaryUrl } = await import(
  "./lib/anime-planet.ts"
);

const UA = "BuildCharacterPortraitBot/1.0";
const args = process.argv.slice(2);
const anime = args[0];
const names = args.slice(1);

const res = await fetch(
  `https://www.anime-planet.com/anime/${anime}/characters`,
  { headers: { "User-Agent": UA } },
);
const html = await res.text();
const rows = parseAnimeCastPage(html);
console.log("cast rows parsed:", rows.length);
for (const name of names) {
  const row = pickCastRow(rows, name);
  const url = row?.thumbUrl ? castThumbToPrimaryUrl(row.thumbUrl) : null;
  console.log(name, row?.path ?? "—", url ?? "—");
}
