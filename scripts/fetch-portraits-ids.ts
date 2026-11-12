/**
 * Fetch portraits for specific roster ids (Anime-Planet, then AniList).
 * Rejects saving if two ids get identical image bytes in one run.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Character } from "@build-character/shared";
import { animePlanetPortraitUrl } from "./lib/anime-planet.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const charactersPath = resolve(root, "data", "characters.json");
const outDir = resolve(root, "public-shared", "portraits");
const clientPortraits = resolve(root, "client", "public", "portraits");

const SERIES_ANILIST: Record<string, string> = {
  "Dragon Ball": "Dragon Ball Super",
  "One Piece": "One Piece",
  Naruto: "Naruto",
  Bleach: "Bleach",
  "Jujutsu Kaisen": "Jujutsu Kaisen",
  "One Punch Man": "One Punch Man",
  "Seven Deadly Sins": "Nanatsu no Taizai",
  "My Hero Academia": "Boku no Hero Academia",
  "Chainsaw Man": "Chainsaw Man",
  Hellsing: "Hellsing Ultimate",
  JoJo: "JoJo's Bizarre Adventure",
  Fate: "Fate/stay night",
  "Attack on Titan": "Shingeki no Kyojin",
  "Hunter x Hunter": "Hunter x Hunter",
  "Death Note": "Death Note",
  "Fullmetal Alchemist": "Fullmetal Alchemist: Brotherhood",
  "Demon Slayer": "Kimetsu no Yaiba",
  "Sword Art Online": "Sword Art Online",
  "Tokyo Ghoul": "Tokyo Ghoul",
  "Code Geass": "Code Geass",
  "Mob Psycho 100": "Mob Psycho 100",
  "Akame ga Kill": "Akame ga Kill",
  "The Misfit of Demon King Academy": "Maou Gakuin",
  "Assassination Classroom": "Ansatsu Kyoushitsu",
  "Haikyuu!!": "Haikyuu!!",
  "Dr. Stone": "Dr. STONE",
  "Black Clover": "Black Clover",
  "Vinland Saga": "Vinland Saga",
  "Fairy Tail": "Fairy Tail",
  "Gurren Lagann": "Tengen Toppa Gurren Lagann",
  Overlord: "Overlord",
  "That Time I Got Reincarnated as a Slime": "Tensei shitara Slime Datta Ken",
  "Mushoku Tensei": "Mushoku Tensei",
  "Fire Force": "Enen no Shouboutai",
  "Tokyo Revengers": "Tokyo Revengers",
  "Kuroko's Basketball": "Kuroko no Basket",
  "Solo Leveling": "Ore dake Level Up na Ken",
  Gintama: "Gintama",
  "The God of High School": "The God of High School",
  Mashle: "Mashle",
  "Hajime no Ippo": "Hajime no Ippo",
  Baki: "Baki",
  "Kengan Ashura": "Kengan Ashura",
  "Pokémon": "Pokemon",
  "Record of Ragnarok": "Shuumatsu no Valkyrie",
  Parasyte: "Kiseijuu",
  "The Disastrous Life of Saiki K": "Saiki Kusuo no Psi-nan",
};

const QUERY = `
query ($search: String) {
  Page(perPage: 12) {
    characters(search: $search) {
      name { full userPreferred }
      image { large medium }
    }
  }
}
`;

const SEARCH_OVERRIDES: Record<string, string[]> = {
  "dio-part-3": ["Dio Brando", "DIO"],
  "goku-ssj2": ["Son Goku", "Goku Dragon Ball"],
  "gojo-satoru": ["Satoru Gojo", "Gojo"],
  "ichigo-bankai": ["Ichigo Kurosaki"],
  "eren-founding-anime": ["Eren Yeager"],
  "father-fma": ["Father Fullmetal Alchemist"],
  "ho-oh-anime": ["Ho-Oh Pokemon"],
  "hajun-record": ["Hajun Record of Ragnarok"],
  "gon-adult-anime": ["Gon Freecss"],
  aizen: ["Sōsuke Aizen", "Aizen Bleach", "Sosuke Aizen"],
  "father-fma": ["Father Homunculus", "Dwarf in the Flask"],
  "eto-yoshimura": ["Eto Yoshimura Tokyo Ghoul", "One-Eyed Owl"],
};

function simplifyName(displayName: string): string {
  return displayName.replace(/\s*\([^)]*\)\s*/g, " ").trim();
}

function extFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (path.endsWith(".png")) return ".png";
    if (path.endsWith(".webp")) return ".webp";
    if (path.endsWith(".gif")) return ".gif";
  } catch {
    /* ignore */
  }
  return ".jpg";
}

function nameScore(want: string, got: string): number {
  const a = want.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const b = got.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (a === b) return 100;
  if (b.includes(a) || a.includes(b)) return 80;
  const aw = a.split(/\s+/);
  const bw = new Set(b.split(/\s+/));
  const hits = aw.filter((w) => bw.has(w)).length;
  return hits >= 2 ? 60 + hits * 5 : hits === 1 ? 40 : 0;
}

async function anilistSearch(
  name: string,
  prefer?: string,
): Promise<string | null> {
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { search: name } }),
  });
  if (res.status === 429) return null;
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: {
      Page?: {
        characters?: Array<{
          name?: { full?: string; userPreferred?: string };
          image?: { large?: string; medium?: string };
        }>;
      };
    };
  };
  const chars = json.data?.Page?.characters ?? [];
  const needle = prefer ?? name;
  let best: { url: string; score: number } | null = null;
  for (const c of chars) {
    const label = c.name?.userPreferred ?? c.name?.full ?? "";
    const url = c.image?.large ?? c.image?.medium;
    if (!url) continue;
    const score = nameScore(needle, label);
    if (!best || score > best.score) best = { url, score };
  }
  if (!best || best.score < 40) return null;
  return best.url;
}

function removePortraitFiles(id: string) {
  for (const ext of [".webp", ".jpg", ".jpeg", ".png"]) {
    for (const dir of [outDir, clientPortraits]) {
      const p = resolve(dir, `${id}${ext}`);
      if (existsSync(p)) unlinkSync(p);
    }
  }
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const targetIds = new Set(process.argv.slice(2));
  if (targetIds.size === 0) {
    console.error("Usage: tsx fetch-portraits-ids.ts <id> …");
    process.exit(1);
  }
  mkdirSync(outDir, { recursive: true });
  mkdirSync(clientPortraits, { recursive: true });

  const chars = JSON.parse(readFileSync(charactersPath, "utf-8")) as Character[];
  const byId = new Map(chars.map((c) => [c.id, c]));
  const pending = new Map<string, { url: string; bytes: Buffer; ext: string }>();

  for (const id of targetIds) {
    const c = byId.get(id);
    if (!c) {
      console.warn(`Unknown id ${id}`);
      continue;
    }
    removePortraitFiles(id);

    const baseName = simplifyName(c.displayName);
    const queries = [
      ...(SEARCH_OVERRIDES[id] ?? []),
      baseName,
      c.displayName,
      `${baseName} ${SERIES_ANILIST[c.series] ?? c.series}`,
    ];

    const anilistOnly = process.argv.includes("--anilist-only");
  const rejectPlaceholder = (url: string) =>
    /kakashi-hatake/i.test(url) || url.includes("characters/primary/default");

    let imageUrl: string | null = null;
    if (!anilistOnly) {
      imageUrl =
        (await animePlanetPortraitUrl(baseName)) ??
        (await animePlanetPortraitUrl(c.displayName));
      await new Promise((r) => setTimeout(r, 260));
      if (imageUrl && rejectPlaceholder(imageUrl)) imageUrl = null;
    }
    if (!imageUrl) {
      for (const q of queries) {
        imageUrl = await anilistSearch(q, baseName);
        if (imageUrl && !rejectPlaceholder(imageUrl)) break;
        imageUrl = null;
        await new Promise((r) => setTimeout(r, 3200));
      }
    }

    if (!imageUrl) {
      console.warn(`MISS ${id} (${c.displayName})`);
      continue;
    }

    try {
      const bytes = await download(imageUrl);
      const ext = extFromUrl(imageUrl);
      pending.set(id, { url: imageUrl, bytes, ext });
      console.log(`GET ${id} (${bytes.length} bytes) ${imageUrl}`);
    } catch (e) {
      console.warn(`FAIL ${id}:`, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const byHash = new Map<string, string[]>();
  for (const [id, { bytes }] of pending) {
    const h = createHash("sha1").update(bytes).digest("hex");
    byHash.set(h, [...(byHash.get(h) ?? []), id]);
  }
  const dupIds = new Set<string>();
  for (const ids of byHash.values()) {
    if (ids.length > 1) ids.forEach((id) => dupIds.add(id));
  }

  let changed = false;
  for (const [id, { url, bytes, ext }] of pending) {
    if (dupIds.has(id)) {
      console.warn(
        `REJECT ${id}: same image as other character(s); likely placeholder (${url})`,
      );
      continue;
    }
    const filename = `${id}${ext}`;
    writeFileSync(resolve(outDir, filename), bytes);
    writeFileSync(resolve(clientPortraits, filename), bytes);
    const c = byId.get(id)!;
    c.portrait = `/portraits/${filename}`;
    changed = true;
    console.log(`OK ${id} -> /portraits/${filename}`);
  }

  if (changed) {
    writeFileSync(charactersPath, JSON.stringify(chars, null, 2) + "\n", "utf-8");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
