import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchWikiHtml } from "./lib/wiki-stats.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pages = [
  "Yami Sukehiro",
  "Son Goku (DBS Anime)",
  "Monkey D. Luffy (Emperor)",
  "Kirito (Aincrad)",
  "Kirito (Post-Aincrad)",
  "Ichigo Kurosaki (Pre-Timeskip)",
  "Naruto Uzumaki (Part II: War Arc)",
];

for (const p of pages) {
  await fetchWikiHtml(p, root);
  console.log("OK", p);
}
