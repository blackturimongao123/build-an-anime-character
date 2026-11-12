import { searchWikiPage } from "./lib/wiki-stats.js";

const queries = process.argv.slice(2);
for (const q of queries) {
  const title = await searchWikiPage(q);
  console.log(JSON.stringify({ q, title }));
}
