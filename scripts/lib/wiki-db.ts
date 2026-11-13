import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { CharacterStats } from "@build-character/shared";

export type WikiDbTabSlice = {
  tabPath: string[];
  columnIndex: number;
  columnLabel: string | null;
  stats: CharacterStats;
  hasPowersSection: boolean;
};

export type WikiDbCharacterScrape = {
  id: string;
  displayName: string;
  series: string;
  wikiTitle: string | null;
  scrapedAt: string;
  error?: string;
  htmlCacheFile: string | null;
  tabCount: number;
  slices: WikiDbTabSlice[];
};

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  series TEXT NOT NULL,
  wiki_title TEXT,
  scraped_at TEXT,
  error TEXT,
  html_cache TEXT,
  tab_count INTEGER
);
CREATE TABLE IF NOT EXISTS tab_slices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id TEXT NOT NULL,
  tab_path TEXT NOT NULL,
  column_index INTEGER NOT NULL,
  column_label TEXT,
  strength INTEGER NOT NULL,
  speed INTEGER NOT NULL,
  abilities INTEGER NOT NULL,
  iq INTEGER NOT NULL,
  durability INTEGER NOT NULL,
  FOREIGN KEY (character_id) REFERENCES characters(id)
);
CREATE INDEX IF NOT EXISTS idx_slices_char ON tab_slices(character_id);
CREATE INDEX IF NOT EXISTS idx_slices_char_col ON tab_slices(character_id, column_index);
`;

export function wikiDbDir(root: string): string {
  return resolve(root, "data", "wiki-db");
}

export function wikiDbPath(root: string): string {
  return resolve(wikiDbDir(root), "wiki-stats.sqlite");
}

export function scrapeJsonPath(root: string, id: string): string {
  return resolve(wikiDbDir(root), "scrapes", `${id}.json`);
}

export function initWikiDb(root: string): void {
  const dir = wikiDbDir(root);
  mkdirSync(resolve(dir, "scrapes"), { recursive: true });
  mkdirSync(resolve(dir, "shards"), { recursive: true });
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = require("node:sqlite") as {
      DatabaseSync: new (path: string) => {
        exec: (sql: string) => void;
        close: () => void;
      };
    };
    const db = new DatabaseSync(wikiDbPath(root));
    db.exec(SCHEMA_SQL);
    db.close();
  } catch {
    writeFileSync(
      resolve(dir, "SCHEMA.sql"),
      `${SCHEMA_SQL.trim()}\n`,
      "utf-8",
    );
  }
}

export function writeScrapeJson(
  root: string,
  record: WikiDbCharacterScrape,
): void {
  const path = scrapeJsonPath(root, record.id);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
}

export function upsertScrapeSqlite(
  root: string,
  record: WikiDbCharacterScrape,
): boolean {
  try {
    const { DatabaseSync } = require("node:sqlite") as {
      DatabaseSync: new (path: string) => {
        exec: (sql: string) => void;
        prepare: (sql: string) => {
          run: (...args: unknown[]) => void;
        };
        close: () => void;
      };
    };
    initWikiDb(root);
    const db = new DatabaseSync(wikiDbPath(root));
    db.exec(SCHEMA_SQL);
    const del = db.prepare(`DELETE FROM tab_slices WHERE character_id = ?`);
    del.run(record.id);
    const delChar = db.prepare(`DELETE FROM characters WHERE id = ?`);
    delChar.run(record.id);
    const insChar = db.prepare(`
      INSERT INTO characters (id, display_name, series, wiki_title, scraped_at, error, html_cache, tab_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insChar.run(
      record.id,
      record.displayName,
      record.series,
      record.wikiTitle,
      record.scrapedAt,
      record.error ?? null,
      record.htmlCacheFile,
      record.tabCount,
    );
    const insSlice = db.prepare(`
      INSERT INTO tab_slices (
        character_id, tab_path, column_index, column_label,
        strength, speed, abilities, iq, durability
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of record.slices) {
      insSlice.run(
        record.id,
        JSON.stringify(s.tabPath),
        s.columnIndex,
        s.columnLabel,
        s.stats.strength,
        s.stats.speed,
        s.stats.abilities,
        s.stats.iq,
        s.stats.durability,
      );
    }
    db.close();
    return true;
  } catch {
    return false;
  }
}

export function readScrapeJson(
  root: string,
  id: string,
): WikiDbCharacterScrape | null {
  const path = scrapeJsonPath(root, id);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as WikiDbCharacterScrape;
}
