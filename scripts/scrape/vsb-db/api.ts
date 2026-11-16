/**
 * Polite VS Battles (Fandom MediaWiki) API client with a SQLite response cache.
 * - about 1 request per second, retries with backoff, generic User-Agent
 * - responses are cached in data/wiki-db/vsb-cache.sqlite (gitignored)
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const API = "https://vsbattles.fandom.com/api.php";
const USER_AGENT = "anime-character-statdb/1.0 (VS Battles stat research for a fan game)";
const MIN_GAP_MS = 1000;

export class VsbApi {
  private cache: DatabaseSync;
  private last = 0;
  public requests = 0;
  public cacheHits = 0;

  constructor(cachePath: string) {
    mkdirSync(dirname(cachePath), { recursive: true });
    this.cache = new DatabaseSync(cachePath);
    this.cache.exec(`CREATE TABLE IF NOT EXISTS responses (
      key TEXT PRIMARY KEY, body TEXT NOT NULL, fetched_at TEXT NOT NULL)`);
  }

  /** GET the API with params; cached forever unless `fresh` is set. */
  async get<T = any>(params: Record<string, string>, opts: { fresh?: boolean } = {}): Promise<T> {
    const query = new URLSearchParams({ format: "json", formatversion: "2", ...params }).toString();
    if (!opts.fresh) {
      const row = this.cache.prepare("SELECT body FROM responses WHERE key = ?").get(query) as { body: string } | undefined;
      if (row) { this.cacheHits++; return JSON.parse(row.body) as T; }
    }
    let attempt = 0;
    for (;;) {
      const wait = this.last + MIN_GAP_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.last = Date.now();
      this.requests++;
      try {
        const res = await fetch(`${API}?${query}`, { headers: { "User-Agent": USER_AGENT } });
        if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
        const body = await res.text();
        const json = JSON.parse(body);
        if (json?.error?.code === "ratelimited" || json?.error?.code === "maxlag") throw new Error(json.error.code);
        this.cache.prepare("INSERT OR REPLACE INTO responses (key, body, fetched_at) VALUES (?, ?, ?)")
          .run(query, body, new Date().toISOString());
        return json as T;
      } catch (e) {
        attempt++;
        if (attempt > 4) throw e;
        await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
      }
    }
  }

  /** Wikitext, revid, categories and links of a page (follows redirects). */
  async page(title: string, opts: { fresh?: boolean } = {}) {
    const r = await this.get<any>({ action: "parse", page: title, prop: "wikitext|revid|categories|links", redirects: "1" }, opts);
    if (!r.parse) return null;
    return {
      title: r.parse.title as string,
      revid: r.parse.revid as number,
      wikitext: r.parse.wikitext as string,
      categories: (r.parse.categories ?? []).map((c: any) => c.category as string),
      links: (r.parse.links ?? []).filter((l: any) => l.ns === 0 && l.exists !== false).map((l: any) => l.title as string),
    };
  }

  async search(text: string, limit = 8): Promise<string[]> {
    const r = await this.get<any>({ action: "query", list: "search", srsearch: text, srlimit: String(limit), srnamespace: "0" });
    return (r.query?.search ?? []).map((s: any) => s.title as string);
  }

  async categoryMembers(category: string): Promise<{ ns: number; title: string }[]> {
    const out: { ns: number; title: string }[] = [];
    let cont: string | undefined;
    do {
      const r = await this.get<any>({ action: "query", list: "categorymembers", cmtitle: category, cmtype: "subcat|page", cmlimit: "500", ...(cont ? { cmcontinue: cont } : {}) });
      out.push(...(r.query?.categorymembers ?? []));
      cont = r.continue?.cmcontinue;
    } while (cont);
    return out;
  }

  close() { this.cache.close(); }
}

export const pageUrl = (title: string) => `https://vsbattles.fandom.com/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
