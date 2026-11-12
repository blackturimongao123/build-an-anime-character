const UA = "BuildCharacterPortraitBot/1.0";
const ORIGIN = "https://www.anime-planet.com";

export type AnimePlanetLookupOptions = {
  /** Extra search strings after full name + series (e.g. id-specific overrides). */
  extraQueries?: string[];
  /** Verse label for `Full Name Series` search (Anime-Planet characters index). */
  series?: string;
  /** Known `/characters/<slug>` from manual browse. */
  characterSlug?: string;
  /** Anime-Planet `/anime/<slug>/characters` pages to scan (cast list). */
  animeSlugs?: string[];
};

function simplifyName(displayName: string): string {
  return displayName.replace(/\s*\([^)]*\)\s*/g, " ").trim();
}

function normalizeName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** AP often spells ō as `ou` (Sousuke) while roster uses ō (Sōsuke). */
function foldRomaji(s: string): string {
  return normalizeName(s).replace(/ou/g, "o").replace(/uu/g, "u");
}

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName;
}

function nameMatchScore(want: string, candidate: string): number {
  const w = normalizeName(simplifyName(want));
  const c = normalizeName(candidate);
  if (!w || !c) return 0;
  if (c === w || foldRomaji(want) === foldRomaji(candidate)) return 100;
  const wParts = w.split(" ").filter(Boolean);
  const first = wParts[0] ?? w;
  const last = wParts[wParts.length - 1] ?? w;
  if (c === first) return 92;
  if (wParts.length > 1 && c === last) return 72;
  if (wParts.length > 1 && wParts.every((p) => c.split(" ").includes(p))) return 78;
  if (c.includes(w) || w.includes(c)) return 55;
  if (c.startsWith(first)) return 60;
  if (c.includes(first)) return 50;
  return 0;
}

function extractPortraitUrl(html: string): string | null {
  const primary = html.match(
    /https:\/\/cdn\.anime-planet\.com\/characters\/primary\/[^"'\s]+/,
  );
  if (primary) return primary[0];
  const thumb = html.match(
    /https:\/\/www\.anime-planet\.com\/images\/characters\/[^"'\s]+\.jpg[^"'\s]*/,
  );
  return thumb?.[0] ?? null;
}

/** Cast table thumbs use `name-1-190x297.jpg`; normalize to full primary CDN URL. */
export function castThumbToPrimaryUrl(thumb: string): string {
  return thumb.replace(/(-\d+x\d+)(?=\.(jpg|webp|png))/i, "");
}

type CastRow = { path: string; name: string; thumbUrl: string | null };

export function parseAnimeCastPage(html: string): CastRow[] {
  const rows: CastRow[] = [];
  const seen = new Set<string>();

  for (const block of html.matchAll(
    /<tr>[\s\S]*?<a href="(\/characters\/[a-z0-9-]+)"[\s\S]*?<\/tr>/gi,
  )) {
    const segment = block[0];
    const path = block[1];
    if (seen.has(path)) continue;

    const name =
      segment.match(/class="name"[^>]*>([^<]+)</i)?.[1]?.trim() ??
      segment.match(/alt="([^"]+)"/i)?.[1]?.trim() ??
      "";
    const thumb =
      segment.match(
        /https:\/\/cdn\.anime-planet\.com\/characters\/primary\/[^"'\s]+/i,
      )?.[0] ?? null;

    if (!name) continue;
    seen.add(path);
    rows.push({ path, name, thumbUrl: thumb });
  }

  if (rows.length > 0) return rows;

  for (const m of html.matchAll(
    /href="(\/characters\/[a-z0-9-]+)"[^>]*class="name"[^>]*>([^<]+)</gi,
  )) {
    const path = m[1];
    if (seen.has(path)) continue;
    seen.add(path);
    rows.push({ path, name: m[2].trim(), thumbUrl: null });
  }
  return rows;
}

export function pickCastRow(
  rows: CastRow[],
  displayName: string,
): CastRow | null {
  const matchName = simplifyName(displayName) || displayName.trim();
  let best: { row: CastRow; score: number } | null = null;
  for (const row of rows) {
    const score = nameMatchScore(matchName, row.name);
    if (score < 50) continue;
    if (!best || score > best.score) best = { row, score };
  }
  return best?.row ?? null;
}

function pickCharacterPath(
  html: string,
  displayName: string,
  query: string,
): string | null {
  const want = normalizeName(displayName);
  const wantFirst = normalizeName(firstName(displayName));
  const queryNorm = normalizeName(query);
  const firstNameOnly =
    queryNorm === wantFirst && !queryNorm.includes(" ") && want.split(" ").length > 1;

  const re =
    /href="(\/characters\/[a-z0-9-]+)"[^>]*>[\s\S]*?<h5[^>]*>([^<]+)</gi;
  let best: { path: string; score: number } | null = null;
  for (const m of html.matchAll(re)) {
    const path = m[1];
    const title = m[2].trim();
    const score = nameMatchScore(displayName, title);
    if (!best || score > best.score) best = { path, score };
  }

  const minScore = firstNameOnly ? 70 : 40;
  if (best && best.score >= minScore) return best.path;
  if (firstNameOnly) return null;
  const fallback = html.match(/href="(\/characters\/[a-z0-9-]+)"/);
  return fallback?.[1] ?? null;
}

async function fetchHtml(
  url: string,
): Promise<{ url: string; html: string } | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "follow",
  });
  if (!res.ok) return null;
  return { url: res.url, html: await res.text() };
}

function buildSearchQueries(
  displayName: string,
  options?: AnimePlanetLookupOptions,
): string[] {
  const raw = displayName.trim();
  const simplified = simplifyName(displayName);
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (q: string) => {
    const t = q.trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  add(raw);
  if (simplified !== raw) add(simplified);
  if (options?.series?.trim()) {
    add(`${simplified} ${options.series.trim()}`);
    add(`${raw} ${options.series.trim()}`);
  }
  for (const q of options?.extraQueries ?? []) add(q);
  add(firstName(simplified));
  return out;
}

async function portraitFromCharacterPath(
  path: string,
  thumbUrl: string | null,
): Promise<string | null> {
  if (thumbUrl && !/kakashi-hatake/i.test(thumbUrl)) {
    const primary = castThumbToPrimaryUrl(thumbUrl);
    if (primary.includes("cdn.anime-planet.com")) return primary;
  }
  const page = await fetchHtml(`${ORIGIN}${path}`);
  if (!page) return null;
  const url = extractPortraitUrl(page.html);
  if (!url || /kakashi-hatake/i.test(url)) return null;
  return url;
}

async function portraitFromCharacterSlug(
  slug: string,
): Promise<string | null> {
  const path = slug.replace(/^\//, "").replace(/^characters\//, "");
  return portraitFromCharacterPath(`/characters/${path}`, null);
}

async function portraitFromAnimeCast(
  displayName: string,
  animeSlugs: string[],
): Promise<string | null> {
  for (const slug of animeSlugs) {
    const castUrl = `${ORIGIN}/anime/${slug.replace(/^\//, "")}/characters`;
    const page = await fetchHtml(castUrl);
    if (!page) continue;
    const rows = parseAnimeCastPage(page.html);
    const row = pickCastRow(rows, displayName);
    if (!row) continue;
    const url = await portraitFromCharacterPath(row.path, row.thumbUrl);
    if (url) return url;
  }
  return null;
}

async function animePlanetPortraitUrlForQuery(
  matchName: string,
  query: string,
): Promise<string | null> {
  const searchUrl = `${ORIGIN}/characters/all?name=${encodeURIComponent(query)}`;
  const landing = await fetchHtml(searchUrl);
  if (!landing) return null;

  const onCharacterPage =
    /\/characters\/[a-z0-9-]+\/?$/i.test(new URL(landing.url).pathname) &&
    !landing.url.includes("/characters/all");

  let html = landing.html;
  if (!onCharacterPage) {
    const path = pickCharacterPath(html, matchName, query);
    if (!path) return null;
    const page = await fetchHtml(`${ORIGIN}${path}`);
    if (!page) return null;
    html = page.html;
  }

  const url = extractPortraitUrl(html);
  if (!url || /kakashi-hatake/i.test(url)) return null;
  return url;
}

/**
 * Resolve portrait CDN URL via Anime-Planet.
 * Order: anime cast pages → direct character slug → global search (full name first).
 */
export async function animePlanetPortraitUrl(
  displayName: string,
  options?: AnimePlanetLookupOptions,
): Promise<string | null> {
  if (options?.animeSlugs?.length) {
    const fromCast = await portraitFromAnimeCast(
      displayName,
      options.animeSlugs,
    );
    if (fromCast) return fromCast;
  }

  if (options?.characterSlug) {
    const fromSlug = await portraitFromCharacterSlug(options.characterSlug);
    if (fromSlug) return fromSlug;
  }

  const matchName = simplifyName(displayName) || displayName.trim();
  for (const query of buildSearchQueries(displayName, options)) {
    const url = await animePlanetPortraitUrlForQuery(matchName, query);
    if (url) return url;
  }
  return null;
}
