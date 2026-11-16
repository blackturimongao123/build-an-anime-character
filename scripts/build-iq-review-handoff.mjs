/**
 * Portable IQ review folder + zip: HTML + local portraits (offline-friendly).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  buildIqRoster,
  renderIqReviewHtml,
  resolvePortraitFile,
  apCdnPortraitUrl,
} from "./lib/iq-review-build.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dataDir = path.join(root, "data");
const outDir = path.join(root, "dist", "iq-review-handoff");
const portraitsOut = path.join(outDir, "portraits");
const zipPath = path.join(root, "dist", "iq-revision-review-handoff.zip");

async function main() {
const characters = JSON.parse(
  fs.readFileSync(path.join(dataDir, "characters.json"), "utf8"),
);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(portraitsOut, { recursive: true });

let copied = 0;
let fetched = 0;
let missing = 0;
const handoffPortraitById = new Map();

async function fetchToFile(url, dest) {
  const res = await fetch(url, {
    headers: { "User-Agent": "BuildCharacterPortraitBot/1.0" },
  });
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return true;
}

for (const c of characters) {
  const local = resolvePortraitFile(root, c);
  if (local) {
    const dest = path.join(portraitsOut, local.relName);
    fs.copyFileSync(local.abs, dest);
    handoffPortraitById.set(c.id, `portraits/${local.relName}`);
    copied++;
    continue;
  }
  const cdn = apCdnPortraitUrl(root, c);
  if (cdn) {
    const dest = path.join(portraitsOut, `${c.id}.jpg`);
    if (await fetchToFile(cdn, dest)) {
      handoffPortraitById.set(c.id, `portraits/${c.id}.jpg`);
      fetched++;
    } else {
      missing++;
    }
  } else {
    missing++;
  }
}

const { roster, seedEdits, framework } = buildIqRoster(root, {
  portraitPrefix: "portraits",
});

for (const row of roster) {
  const rel = handoffPortraitById.get(row.id);
  if (rel) row.portraitSrc = rel;
  else row.portraitSrc = null;
}

const html = renderIqReviewHtml(
  roster,
  seedEdits,
  framework,
  path.join(__dirname, "iq-revision-review.template.html"),
);

fs.writeFileSync(
  path.join(outDir, "iq-revision-review.html"),
  "\uFEFF" + html,
  "utf8",
);

fs.writeFileSync(
  path.join(outDir, "README.txt"),
  `IQ revision review (offline)

1. Extract this folder anywhere.
2. Open iq-revision-review.html in a browser (double-click).
3. portraits/ must stay next to the HTML file.

Generated: ${new Date().toISOString()}
Roster: ${roster.length} characters
Local portraits copied: ${copied}
Fetched from Anime-Planet CDN: ${fetched}
No image (initials placeholder in UI): ${missing}
`,
  "utf8",
);

const repoBundle = buildIqRoster(root);
const repoHtml = renderIqReviewHtml(
  repoBundle.roster,
  repoBundle.seedEdits,
  repoBundle.framework,
  path.join(__dirname, "iq-revision-review.template.html"),
);
fs.writeFileSync(
  path.join(dataDir, "iq-revision-review.html"),
  "\uFEFF" + repoHtml,
  "utf8",
);
console.log(
  `Updated data/iq-revision-review.html (${repoBundle.roster.length} characters)`,
);

if (process.platform === "win32") {
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  const ps = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${outDir.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
    ],
    { stdio: "inherit" },
  );
  if (ps.status !== 0) {
    console.error("Zip failed; handoff folder is still at", outDir);
    process.exit(ps.status ?? 1);
  }
} else {
  const ps = spawnSync("zip", ["-r", zipPath, "."], {
    cwd: outDir,
    stdio: "inherit",
  });
  if (ps.status !== 0) {
    console.warn("zip not available; handoff folder:", outDir);
  }
}

console.log(`Handoff folder: ${outDir}`);
console.log(`Zip: ${zipPath}`);
console.log(
  `Portraits: ${copied} copied, ${fetched} fetched, ${missing} missing`,
);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
