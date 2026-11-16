/**
 * Exodia has no usable Anime-Planet art — import full-body anime art via Yugipedia.
 */
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "BuildCharacterBot/1.0";

async function searchFiles(term) {
  const url = new URL("https://yugipedia.com/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", term);
  url.searchParams.set("srnamespace", "6");
  url.searchParams.set("format", "json");
  const j = await (await fetch(url, { headers: { "User-Agent": UA } })).json();
  return (j.query?.search ?? []).map((x) => x.title);
}

async function fileUrl(title) {
  const url = new URL("https://yugipedia.com/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", title);
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url");
  url.searchParams.set("format", "json");
  const j = await (await fetch(url, { headers: { "User-Agent": UA } })).json();
  const page = Object.values(j.query.pages)[0];
  return page?.imageinfo?.[0]?.url ?? null;
}

const candidates = [
  "File:Exodiaanime.jpg",
  "File:Exodia-DPBC-EN-UR-1E.png",
  "File:ExodiatheForbiddenOne-LOB-EN-UR-UE.png",
  "File:ExodiatheForbiddenOne-MRD-EN-UR-UE.png",
  "File:Exodia-OW.png",
];

let titles = [...candidates];
for (const term of ["Exodia anime character", "Exodia the Forbidden One"]) {
  titles.push(...(await searchFiles(term)));
}
titles = [...new Set(titles)].filter((t) => !/Left|Right|Arm|Leg|Forbidden One piece/i.test(t));

const urls = [];
for (const title of titles) {
  if (!title.startsWith("File:")) continue;
  if (/Left Arm|Right Leg|Left Leg|Right Arm|piece/i.test(title)) continue;
  const u = await fileUrl(title);
  if (u) urls.push({ title, url: u });
}
urls.sort((a, b) => {
  const score = (x) =>
    (/Complete|assembled|full/i.test(x.title) ? 4 : 0) +
    (/Deck|card/i.test(x.title) ? -2 : 0) +
    (/Forbidden One/i.test(x.title) ? 1 : 0);
  return score(b) - score(a);
});
const pick = urls[0];
const imageUrl = pick?.url ?? null;
const usedTitle = pick?.title ?? "";

if (!imageUrl) {
  console.error("No whole-Exodia image found on Yugipedia");
  process.exit(1);
}

console.log("Using", usedTitle);
console.log(imageUrl);

const outDir = resolve(root, "public-shared", "portraits");
mkdirSync(outDir, { recursive: true });
const ext = imageUrl.match(/\.(png|jpg|jpeg|webp)/i)?.[1]?.toLowerCase() ?? "jpg";
const outPath = resolve(outDir, `exodia-ygo.${ext}`);

const res = await fetch(imageUrl, { headers: { "User-Agent": UA } });
if (!res.ok) throw new Error(`Download failed ${res.status}`);
await pipeline(Readable.fromWeb(res.body), createWriteStream(outPath));
console.log("Saved", outPath);
