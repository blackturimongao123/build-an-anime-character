/** Print cast-list portrait URL for a name on a given anime slug. */
import { pickCastRow, parseAnimeCastPage, castThumbToPrimaryUrl } from "./lib/anime-planet.ts";

const anime = process.argv[2];
const name = process.argv.slice(3).join(" ");
const res = await fetch(
  `https://www.anime-planet.com/anime/${anime}/characters`,
  { headers: { "User-Agent": "BuildCharacterPortraitBot/1.0" } },
);
const rows = parseAnimeCastPage(await res.text());
const row = pickCastRow(rows, name, [name]);
if (!row?.thumbUrl) {
  console.log("MISS");
  process.exit(1);
}
console.log(castThumbToPrimaryUrl(row.thumbUrl), row.path);
