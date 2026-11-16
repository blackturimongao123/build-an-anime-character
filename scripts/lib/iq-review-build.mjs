import fs from "node:fs";
import path from "node:path";

const PORTRAIT_EXTS = [".webp", ".jpg", ".jpeg", ".png"];

/** @returns {{ abs: string, relName: string } | null} */
export function resolvePortraitFile(root, c) {
  const portraitDir = path.join(root, "public-shared", "portraits");
  for (const ext of PORTRAIT_EXTS) {
    const file = path.join(portraitDir, `${c.id}${ext}`);
    if (fs.existsSync(file)) {
      return { abs: file, relName: `${c.id}${ext}` };
    }
  }
  const fromPortrait =
    typeof c.portrait === "string" &&
    c.portrait.startsWith("/portraits/") &&
    c.portrait.slice("/portraits/".length);
  if (fromPortrait) {
    const base = fromPortrait.replace(/\.(jpg|webp|png|jpeg)$/i, "");
    for (const ext of PORTRAIT_EXTS) {
      const file = path.join(portraitDir, `${base}${ext}`);
      if (fs.existsSync(file)) {
        return { abs: file, relName: `${base}${ext}` };
      }
    }
  }
  return null;
}

export function apCdnPortraitUrl(root, c) {
  const dataDir = path.join(root, "data");
  const apHints = JSON.parse(
    fs.readFileSync(path.join(dataDir, "anime-planet-hints.json"), "utf8"),
  );
  const proxiesPath = path.join(dataDir, "ap-portrait-proxies.json");
  const apProxies = fs.existsSync(proxiesPath)
    ? JSON.parse(fs.readFileSync(proxiesPath, "utf8"))
    : {};
  const slug = apHints[c.id] ?? apProxies[c.id];
  if (slug) {
    return `https://cdn.anime-planet.com/characters/primary/${slug}.jpg`;
  }
  return null;
}

/** @param {string} [portraitPrefix] e.g. "../public-shared/portraits" or "portraits" */
export function portraitSrcFor(c, root, portraitPrefix = "../public-shared/portraits") {
  const local = resolvePortraitFile(root, c);
  if (local) {
    return `${portraitPrefix}/${local.relName}`.replace(/\/+/g, "/");
  }
  return apCdnPortraitUrl(root, c);
}

export function buildIqRoster(root, { portraitPrefix } = {}) {
  const dataDir = path.join(root, "data");
  const prefix = portraitPrefix ?? "../public-shared/portraits";

  const characters = JSON.parse(
    fs.readFileSync(path.join(dataDir, "characters.json"), "utf8"),
  );
  const overrides = JSON.parse(
    fs.readFileSync(path.join(dataDir, "manual-iq-overrides.json"), "utf8"),
  );
  const proposalMd = fs.readFileSync(
    path.join(dataDir, "IQ_REVISION_PROPOSAL.md"),
    "utf8",
  );

  const proposal = new Map();
  const pipeCount = (s) => (s.match(/\|/g) || []).length;
  let section = "";
  const anchorRe = /^\| `([^`]+)` \| (\d+) \| \*\*(\d+)\*\* \| ([^|]+) \|$/;
  for (const line of proposalMd.split("\n")) {
    const h = line.match(/^## Anchor: (.+)/);
    if (h) section = h[1];
    if (pipeCount(line) !== 5) continue;
    const row = line.match(anchorRe);
    if (row) {
      proposal.set(row[1], {
        was: Number(row[2]),
        proposed: Number(row[3]),
        why: row[4].trim(),
        anchor: section || undefined,
      });
    }
  }
  const changeRe =
    /^\| `([^`]+)` \| (\d+) \| \*\*(\d+)\*\* \| ([^|]+) \| (.+) \|$/;
  for (const line of proposalMd.split("\n")) {
    if (pipeCount(line) !== 6) continue;
    const row = line.match(changeRe);
    if (!row) continue;
    const id = row[1];
    if (proposal.has(id)) continue;
    proposal.set(id, {
      was: Number(row[2]),
      proposed: Number(row[3]),
      pillars: row[4].trim(),
      why: row[5].trim(),
    });
  }

  const curatedIqIds = new Set(proposal.keys());
  for (const id of Object.keys(overrides)) curatedIqIds.add(id);
  const appliedExportPath = path.join(
    dataDir,
    "iq-revision-export-applied-2026-11-12.json",
  );
  if (fs.existsSync(appliedExportPath)) {
    const applied = JSON.parse(fs.readFileSync(appliedExportPath, "utf8"));
    if (applied.overrides && typeof applied.overrides === "object") {
      for (const id of Object.keys(applied.overrides)) curatedIqIds.add(id);
    }
  }

  const roster = characters.map((c) => {
    const gameIq = Math.min(
      100,
      Math.max(0, Math.round(Number(c.stats?.iq) || 50)),
    );
    const overrideIq = overrides[c.id];
    const current = gameIq;
    const p = proposal.get(c.id);
    const baseline = p?.was ?? overrideIq ?? gameIq;
    const proposed = p?.proposed ?? overrideIq ?? gameIq;
    const PHYS_KEYS = ["strength", "speed", "abilities", "durability"];
    const physical = Object.fromEntries(
      PHYS_KEYS.map((k) => [
        k,
        Math.min(100, Math.max(0, Math.round(Number(c.stats?.[k]) || 0))),
      ]),
    );
    const isPhysicalStatPlaceholder = (v) => v === 40 || v === 50;
    const physicalPlaceholders = Object.fromEntries(
      PHYS_KEYS.map((k) => [k, isPhysicalStatPlaceholder(physical[k])]),
    );
    const physicalVals = PHYS_KEYS.map((k) => physical[k]);
    const statsPlaceholder =
      physicalVals.every((v) => v === 50) ||
      physicalVals.every((v) => v === 40);
    const iqPlaceholder = gameIq === 50 && !curatedIqIds.has(c.id);
    const why =
      p?.why ??
      (p
        ? "—"
        : iqPlaceholder
          ? "Placeholder IQ (default 50) — not yet in revision proposal; set a real score and export."
          : "No IQ row in revision proposal; showing current in-game IQ (edit and export to curate).");
    return {
      id: c.id,
      name: c.displayName,
      series: c.series ?? "",
      portraitSrc: portraitSrcFor(c, root, prefix),
      current,
      baseline,
      gameIq,
      overrideIq: overrideIq ?? null,
      proposed,
      pillars: p?.pillars ?? (p?.anchor ? `Anchor: ${p.anchor}` : null),
      why,
      changed: proposed !== baseline,
      inProposal: Boolean(p),
      iqPlaceholder,
      statsPlaceholder,
      physical,
      physicalPlaceholders,
    };
  });

  roster.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  const seedEdits = {};
  for (const c of roster) {
    const o = overrides[c.id];
    if (o !== undefined && o !== c.proposed) seedEdits[c.id] = o;
  }

  const framework = proposalMd.split("---")[0].trim();
  return { roster, seedEdits, framework };
}

export function renderIqReviewHtml(roster, seedEdits, framework, tplPath) {
  const payload = JSON.stringify(roster);
  let html = fs.readFileSync(tplPath, "utf8");
  html = html
    .replace("/*ROSTER_JSON*/", payload)
    .replace("/*SEED_EDITS_JSON*/", JSON.stringify(seedEdits))
    .replace("/*FRAMEWORK_JSON*/", JSON.stringify(framework));
  return html;
}
