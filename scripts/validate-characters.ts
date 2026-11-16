import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES, type Character } from "@build-character/shared";
import {
  plainCharacterName,
  rosterFormIdentity,
} from "./lib/roster-identity.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const charactersPath = resolve(root, "data", "characters.json");

const ALLOWED_SERIES = new Set([
  "Fate",
  "Dragon Ball",
  "One Piece",
  "Naruto",
  "Bleach",
  "Jujutsu Kaisen",
  "One Punch Man",
  "Seven Deadly Sins",
  "My Hero Academia",
  "Chainsaw Man",
  "Hellsing",
  "JoJo",
  "Attack on Titan",
  "Hunter x Hunter",
  "Death Note",
  "Fullmetal Alchemist",
  "Demon Slayer",
  "Sword Art Online",
  "Tokyo Ghoul",
  "Code Geass",
  "Mob Psycho 100",
  "Akame ga Kill",
  "The Misfit of Demon King Academy",
  "Assassination Classroom",
  "Haikyuu!!",
  "Dr. Stone",
  "Black Clover",
  "Vinland Saga",
  "Fairy Tail",
  "Gurren Lagann",
  "Overlord",
  "That Time I Got Reincarnated as a Slime",
  "Mushoku Tensei",
  "Fire Force",
  "Tokyo Revengers",
  "Kuroko's Basketball",
  "Solo Leveling",
  "Gintama",
  "The God of High School",
  "Mashle",
  "Hajime no Ippo",
  "Baki",
  "Kengan Ashura",
  "Pokémon",
  "Record of Ragnarok",
  "Parasyte",
  "The Disastrous Life of Saiki K",
]);

const ARC_PATTERN =
  /\((?:Arc|Fight|Saga|War|Invasion|Retrieval|Exam|Chunin|Cell|Buu|Namek)\)/i;

const policyPath = resolve(root, "data", "roster-form-policy.json");

function loadFormPolicy(): {
  defaultMaxForms: number;
  extendedMaxForms: number;
  extendedIdentities: string[];
} {
  if (!existsSync(policyPath)) {
    return {
      defaultMaxForms: 1,
      extendedMaxForms: 1,
      extendedIdentities: [] as string[],
    };
  }
  return JSON.parse(readFileSync(policyPath, "utf-8")) as {
    defaultMaxForms: number;
    extendedMaxForms: number;
    extendedIdentities: string[];
  };
}

function main() {
  const allowMissingPortraits = process.argv.includes("--allow-missing-portraits");
  if (!existsSync(charactersPath)) {
    console.error("Missing data/characters.json");
    process.exit(1);
  }

  const chars = JSON.parse(readFileSync(charactersPath, "utf-8")) as Character[];
  let errors = 0;

  for (const c of chars) {
    if (!ALLOWED_SERIES.has(c.series)) {
      console.error(`[series] ${c.id}: "${c.series}" not in allowlist`);
      errors++;
    }
    if (ARC_PATTERN.test(c.displayName)) {
      console.error(`[arc-name] ${c.id}: "${c.displayName}" looks arc-based`);
      errors++;
    }
    if (c.displayName.includes("(") || c.displayName.includes(")")) {
      console.error(
        `[displayName] ${c.id}: "${c.displayName}" must not include parenthetical form tags`,
      );
      errors++;
    }
    if (plainCharacterName(c.displayName) !== c.displayName.trim()) {
      console.error(
        `[displayName] ${c.id}: normalize to plain name (run normalize-roster-single-form)`,
      );
      errors++;
    }
    for (const cat of CATEGORIES) {
      const v = c.stats[cat];
      if (typeof v !== "number" || v < 0 || v > 100) {
        console.error(`[stat] ${c.id}.${cat} invalid: ${v}`);
        errors++;
      }
    }
    if (!c.portrait.startsWith("/portraits/")) {
      console.error(`[portrait] ${c.id}: path should start with /portraits/`);
      errors++;
    }
  }

  const ids = new Set<string>();
  for (const c of chars) {
    if (ids.has(c.id)) {
      console.error(`[duplicate] id ${c.id}`);
      errors++;
    }
    ids.add(c.id);
  }

  // Portrait files: must exist, and no two characters may share the same image
  // (a shared image means the fetcher saved a site placeholder).
  const portraitDir = resolve(root, "public-shared");
  const byHash = new Map<string, string[]>();
  for (const c of chars) {
    const file = resolve(portraitDir, c.portrait.replace(/^\//, ""));
    if (!existsSync(file)) {
      if (allowMissingPortraits) continue;
      console.error(`[portrait] ${c.id}: missing file public-shared${c.portrait}`);
      errors++;
      continue;
    }
    const hash = createHash("sha1").update(readFileSync(file)).digest("hex");
    byHash.set(hash, [...(byHash.get(hash) ?? []), c.id]);
  }
  const idToChar = new Map(chars.map((c) => [c.id, c]));
  for (const group of byHash.values()) {
    if (group.length <= 1) continue;
    const identities = new Set(
      group.map((id) => {
        const c = idToChar.get(id)!;
        return `${c.series}\0${rosterFormIdentity(c)}`;
      }),
    );
    if (identities.size === 1) continue;
    console.error(
      `[portrait] ${group.length} characters share the same image (placeholder?): ${group.slice(0, 5).join(", ")}${group.length > 5 ? ", …" : ""}`,
    );
    errors++;
  }

  const formPolicy = loadFormPolicy();
  const extended = new Set(
    formPolicy.extendedIdentities.map((s) => s.toLowerCase()),
  );
  const formGroups = new Map<string, string[]>();
  for (const c of chars) {
    const identity = rosterFormIdentity(c);
    const key = `${c.series}\0${identity}`;
    const list = formGroups.get(key) ?? [];
    list.push(c.id);
    formGroups.set(key, list);
  }
  for (const [key, memberIds] of formGroups) {
    const identity = key.split("\0")[1] ?? "";
    const max = extended.has(identity)
      ? formPolicy.extendedMaxForms
      : formPolicy.defaultMaxForms;
    if (memberIds.length > max) {
      console.error(
        `[forms] "${identity}" in ${key.split("\0")[0]} has ${memberIds.length} roster entries (max ${max}): ${memberIds.join(", ")}`,
      );
      errors++;
    }
  }

  if (errors === 0) {
    console.log(`OK — ${chars.length} characters validated.`);
  } else {
    console.error(`Found ${errors} issue(s).`);
    process.exit(1);
  }
}

main();
