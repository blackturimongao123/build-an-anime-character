import { parseAnimeCastPage } from "./lib/anime-planet.ts";

const UA = "BuildCharacterPortraitBot/1.0";
const res = await fetch("https://www.anime-planet.com/anime/mashle/characters", {
  headers: { "User-Agent": UA },
});
const rows = parseAnimeCastPage(await res.text());
console.log("count", rows.length);
for (const r of rows) console.log(r.path.replace("/characters/", ""), "—", r.name);
