/**
 * Schema for the VS Battles character database (data/wiki-db/vsb-stats.sqlite, gitignored).
 * Exports in data/generated/vsb-db/ are built from it.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS characters (
  game_id TEXT PRIMARY KEY, display_name TEXT, series TEXT, status TEXT,
  page_title TEXT, related_titles TEXT, match_method TEXT, confidence TEXT, reason TEXT);
CREATE TABLE IF NOT EXISTS franchise_pages (
  series TEXT, page_title TEXT, PRIMARY KEY (series, page_title));
CREATE TABLE IF NOT EXISTS pages (
  title TEXT PRIMARY KEY, url TEXT, revid INTEGER, fetched_at TEXT, origin TEXT, categories TEXT,
  canon_source TEXT, note TEXT);
CREATE TABLE IF NOT EXISTS forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT, page_title TEXT, key_index INTEGER, key_name TEXT,
  canon_source TEXT, canon_reason TEXT, UNIQUE (page_title, key_index));
CREATE TABLE IF NOT EXISTS stats (
  form_id INTEGER, category TEXT, raw_text TEXT, plain_text TEXT, qualifier TEXT,
  tier_code TEXT, rank_value REAL, canon_source TEXT, canon_reason TEXT, PRIMARY KEY (form_id, category));
CREATE TABLE IF NOT EXISTS abilities (
  page_title TEXT, section TEXT, ability TEXT, detail TEXT, canon_source TEXT);
CREATE TABLE IF NOT EXISTS attacks (
  page_title TEXT, name TEXT, canon_source TEXT);
CREATE TABLE IF NOT EXISTS parse_issues (
  page_title TEXT, issue TEXT);
`;

export function openDb(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  return db;
}
