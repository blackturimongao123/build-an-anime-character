/**
 * One-off: fetch a portrait sample from pic.re (Danbooru-style tag filter).
 * Docs: https://doc.pic.re/usage-shi-yong/api.md
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "..", "data", "portrait-samples");

type PicReMeta = {
  file_url: string;
  tags: string[];
  width: number;
  height: number;
  author: string;
  _id: number;
};

const PICRE_TAG: Record<string, string> = {
  tanjiro: "kamado_tanjirou",
  naruto: "uzumaki_naruto",
  luffy: "monkey_d._luffy",
  goku: "son_goku",
};

/** pic.re documents `in` — live filter is unreliable; pull random + verify tags. */
async function picReRandom(): Promise<PicReMeta | null> {
  const res = await fetch("https://pic.re/image.json?compress=true");
  if (!res.ok) return null;
  const json = (await res.json()) as PicReMeta & { _id?: number };
  if (!json._id || !json.file_url) return null;
  return json;
}

const PORTRAIT_NIN = ["genderswap", "2girls", "comic", "chibi", "meme"];

function normalizeFileUrl(fileUrl: string): string {
  if (fileUrl.startsWith("http")) return fileUrl;
  return `https://${fileUrl.replace(/^\/+/, "")}`;
}

async function downloadImage(meta: PicReMeta, dest: string) {
  const imageUrl = normalizeFileUrl(meta.file_url);
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Image HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
}

function acceptablePortrait(meta: PicReMeta, requiredTag: string): boolean {
  if (!meta.tags.includes(requiredTag)) return false;
  return !meta.tags.some((t) => PORTRAIT_NIN.includes(t));
}

async function pickSample(
  slug: string,
  requiredTag: string,
  attempts = 12000,
): Promise<PicReMeta> {
  const concurrency = 24;
  let found: PicReMeta | null = null;
  let done = 0;

  async function worker() {
    while (!found && done < attempts) {
      const meta = await picReRandom();
      done++;
      if (!meta) continue;
      if (acceptablePortrait(meta, requiredTag)) found = meta;
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  if (!found) {
    throw new Error(
      `No pic.re image with tag "${requiredTag}" after ${done} tries (${slug})`,
    );
  }
  return found;
}

const slug = process.argv[2] ?? "tanjiro";
const tag = PICRE_TAG[slug] ?? slug;

mkdirSync(outDir, { recursive: true });

const meta = await pickSample(slug, tag);
const ext = meta.file_url.toLowerCase().includes(".png") ? "png" : "webp";
const dest = resolve(outDir, `${slug}-picre.${ext}`);
await downloadImage(meta, dest);

console.log(
  JSON.stringify(
    {
      slug,
      tag,
      dest,
      id: meta._id,
      author: meta.author,
      size: `${meta.width}x${meta.height}`,
      tags: meta.tags.filter((t) => t.includes("kamado") || t.includes("tanjir")),
    },
    null,
    2,
  ),
);
