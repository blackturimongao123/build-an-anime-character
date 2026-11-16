/**
 * One-off helper: for every series in data/sources/series-codes.json, try the series title directly on
 * VS Battles and list Category:Anime / Category:Manga members with a similar name.
 * Used to fill in the `wikiTitles` table in series-codes.json.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { VsbApi } from "./api.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const codes = JSON.parse(readFileSync(resolve(root, "data/sources/series-codes.json"), "utf8")).codes as Record<string, string>;
const api = new VsbApi(resolve(root, "data/wiki-db/vsb-cache.sqlite"));
const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const members = [
  ...(await api.categoryMembers("Category:Anime")),
  ...(await api.categoryMembers("Category:Manga")),
  ...(await api.categoryMembers("Category:Webtoons")),
].filter((m) => m.ns === 0).map((m) => m.title);

for (const series of Object.keys(codes)) {
  const direct = await api.page(series);
  const directInfo = direct
    ? `${direct.title}${direct.categories.some((c) => /Disambiguation/i.test(c)) ? " [DISAMBIG]" : ""} links=${direct.links.length}`
    : "—";
  const n = norm(series);
  const firstWord = n.split(" ")[0];
  const similar = [...new Set(members)].filter((t) => norm(t).includes(n) || (firstWord.length > 3 && norm(t).startsWith(firstWord)));
  console.log(`${series.padEnd(42)} direct: ${directInfo.padEnd(40)} similar: ${similar.slice(0, 6).join(" | ")}`);
}
console.log(`requests ${api.requests}, cache hits ${api.cacheHits}`);
api.close();
