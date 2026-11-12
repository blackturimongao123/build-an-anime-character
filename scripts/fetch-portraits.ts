import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Character } from "@build-character/shared";
import { animePlanetPortraitUrl } from "./lib/anime-planet.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const hintsPath = resolve(root, "data", "anime-planet-hints.json");
const apSlugHints: Record<string, string> = existsSync(hintsPath)
  ? JSON.parse(readFileSync(hintsPath, "utf-8"))
  : {};
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
  Page(perPage: 8) {
    characters(search: $search) {
      id
      name { full }
      image { large medium }
    }
  }
}
`;

async function anilistSearch(name: string): Promise<string | null> {
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { search: name } }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: {
      Page?: {
        characters?: Array<{ image?: { large?: string; medium?: string } }>;
      };
    };
  };
  const chars = json.data?.Page?.characters ?? [];
  return chars[0]?.image?.large ?? chars[0]?.image?.medium ?? null;
}

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

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
}

function portraitAlready(id: string): string | null {
  for (const ext of [".webp", ".jpg", ".jpeg", ".png"]) {
    const p = resolve(outDir, `${id}${ext}`);
    if (existsSync(p)) return ext;
  }
  return null;
}

async function main() {
  const force = process.argv.includes("--force");
  const sourceArg = process.argv.find((a) => a.startsWith("--source="));
  const source = sourceArg?.split("=")[1] ?? "animeplanet";
  const chars = JSON.parse(readFileSync(charactersPath, "utf-8")) as Character[];
  mkdirSync(outDir, { recursive: true });
  mkdirSync(clientPortraits, { recursive: true });

  let changed = false;

  for (const c of chars) {
    const existingExt = portraitAlready(c.id);
    if (!force && existingExt) {
      const webPath = `/portraits/${c.id}${existingExt}`;
      if (c.portrait !== webPath) {
        c.portrait = webPath;
        changed = true;
      }
      console.log(`Skip existing ${c.id}${existingExt}`);
      continue;
    }

    const baseName = simplifyName(c.displayName);
    const seriesLabel = SERIES_ANILIST[c.series] ?? c.series;
    const queries = [
      c.displayName,
      baseName,
      `${baseName} ${seriesLabel}`,
    ];

    const useAnimePlanet = source === "animeplanet" || source === "both";
    const useAnilist = source === "anilist" || source === "both";

    let imageUrl: string | null = null;
    if (useAnimePlanet) {
      imageUrl = await animePlanetPortraitUrl(c.displayName, {
        series: seriesLabel,
        characterSlug: apSlugHints[c.id],
      });
      await new Promise((r) => setTimeout(r, 280));
    }
    if (!imageUrl && useAnilist) {
      for (const q of queries) {
        imageUrl = await anilistSearch(q);
        if (imageUrl) break;
        await new Promise((r) => setTimeout(r, 320));
      }
    }

    if (!imageUrl) {
      console.warn(`No image for ${c.id} (${c.displayName})`);
      continue;
    }

    const ext = extFromUrl(imageUrl);
    const dest = resolve(outDir, `${c.id}${ext}`);
    try {
      await download(imageUrl, dest);
      const clientDest = resolve(clientPortraits, `${c.id}${ext}`);
      writeFileSync(clientDest, readFileSync(dest));
      c.portrait = `/portraits/${c.id}${ext}`;
      changed = true;
      console.log(`Saved ${c.id} -> ${dest}`);
    } catch (e) {
      console.warn(`Download failed ${c.id}:`, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 380));
  }

  if (changed) {
    writeFileSync(charactersPath, JSON.stringify(chars, null, 2) + "\n", "utf-8");
    console.log("Updated portrait paths in data/characters.json");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
