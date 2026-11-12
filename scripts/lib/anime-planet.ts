const UA = "BuildCharacterPortraitBot/1.0";
const ORIGIN = "https://www.anime-planet.com";

export type AnimePlanetLookupOptions = {
  /** Extra search strings after full name + series (e.g. id-specific overrides). */
  extraQueries?: string[];
  /** Verse label for `Full Name Series` search (Anime-Planet characters index). */
  series?: string;
  /** Known `/characters/<slug>` from manual browse. */
  characterSlug?: string;
};

function simplifyName(displayName: string): string {
  return displayName.replace(/\s*\([^)]*\)\s*/g, " ").trim();
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName;
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
    const title = normalizeName(m[2]);
    let score = 0;
    if (title === want) score = 100;
    else if (title.includes(want) || want.includes(title)) score = 80;
    else if (want.split(" ").every((w) => title.includes(w))) score = 75;
    else if (title.startsWith(wantFirst)) score = 60;
    else if (title.includes(wantFirst)) score = 40;
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

async function portraitFromCharacterSlug(
  slug: string,
): Promise<string | null> {
  const path = slug.replace(/^\//, "").replace(/^characters\//, "");
  const page = await fetchHtml(`${ORIGIN}/characters/${path}`);
  if (!page) return null;
  const url = extractPortraitUrl(page.html);
  if (!url || /kakashi-hatake/i.test(url)) return null;
  return url;
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

/** Resolve portrait CDN URL via Anime-Planet (full name first, first name last). */
export async function animePlanetPortraitUrl(
  displayName: string,
  options?: AnimePlanetLookupOptions,
): Promise<string | null> {
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
