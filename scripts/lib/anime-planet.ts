const UA = "BuildCharacterPortraitBot/1.0";
const ORIGIN = "https://www.anime-planet.com";

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

function pickCharacterPath(html: string, displayName: string): string | null {
  const want = normalizeName(displayName);
  const wantFirst = normalizeName(firstName(displayName));
  const re =
    /href="(\/characters\/[a-z0-9-]+)"[^>]*>[\s\S]*?<h5[^>]*>([^<]+)</gi;
  let best: { path: string; score: number } | null = null;
  for (const m of html.matchAll(re)) {
    const path = m[1];
    const title = normalizeName(m[2]);
    let score = 0;
    if (title === want) score = 100;
    else if (title.includes(want) || want.includes(title)) score = 80;
    else if (title.startsWith(wantFirst)) score = 60;
    else if (title.includes(wantFirst)) score = 40;
    if (!best || score > best.score) best = { path, score };
  }
  if (best && best.score >= 40) return best.path;
  const fallback = html.match(/href="(\/characters\/[a-z0-9-]+)"/);
  return fallback?.[1] ?? null;
}

async function fetchHtml(url: string): Promise<{ url: string; html: string } | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "follow",
  });
  if (!res.ok) return null;
  return { url: res.url, html: await res.text() };
}

/** Resolve portrait CDN URL via name search on Anime-Planet. */
export async function animePlanetPortraitUrl(
  displayName: string,
): Promise<string | null> {
  for (const query of [displayName.trim(), firstName(displayName)]) {
    const url = await animePlanetPortraitUrlForQuery(displayName, query);
    if (url) return url;
  }
  return null;
}

async function animePlanetPortraitUrlForQuery(
  displayName: string,
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
    const path = pickCharacterPath(html, displayName);
    if (!path) return null;
    const page = await fetchHtml(`${ORIGIN}${path}`);
    if (!page) return null;
    html = page.html;
  }

  const url = extractPortraitUrl(html);
  if (!url || /kakashi-hatake/i.test(url)) return null;
  return url;
}
