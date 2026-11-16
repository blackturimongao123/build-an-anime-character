use anyhow::{Context, Result};
use rusqlite::Connection;
use std::path::Path;

pub const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  series TEXT NOT NULL,
  wiki_title TEXT,
  scraped_at TEXT,
  html_cache TEXT,
  tab_count INTEGER NOT NULL DEFAULT 0,
  slice_count INTEGER NOT NULL DEFAULT 0,
  scrape_error TEXT,
  game_strength INTEGER,
  game_speed INTEGER,
  game_abilities INTEGER,
  game_iq INTEGER,
  game_durability INTEGER
);
CREATE TABLE IF NOT EXISTS slices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id TEXT NOT NULL,
  tab_path_json TEXT NOT NULL,
  tab_path_label TEXT NOT NULL,
  column_index INTEGER NOT NULL,
  column_label TEXT,
  strength INTEGER NOT NULL,
  speed INTEGER NOT NULL,
  abilities INTEGER NOT NULL,
  iq INTEGER NOT NULL,
  durability INTEGER NOT NULL,
  stat_total INTEGER NOT NULL,
  has_powers INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (character_id) REFERENCES characters(id)
);
CREATE INDEX IF NOT EXISTS idx_slices_char ON slices(character_id);
CREATE INDEX IF NOT EXISTS idx_slices_total ON slices(stat_total DESC);
CREATE INDEX IF NOT EXISTS idx_slices_str ON slices(strength DESC);
CREATE INDEX IF NOT EXISTS idx_slices_spd ON slices(speed DESC);
CREATE INDEX IF NOT EXISTS idx_slices_abl ON slices(abilities DESC);
CREATE INDEX IF NOT EXISTS idx_slices_iq ON slices(iq DESC);
CREATE INDEX IF NOT EXISTS idx_slices_dur ON slices(durability DESC);
CREATE INDEX IF NOT EXISTS idx_characters_series ON characters(series);
CREATE INDEX IF NOT EXISTS idx_characters_name ON characters(display_name);
"#;

pub fn open(db_path: &Path) -> Result<Connection> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).context("create db parent dir")?;
    }
    let conn = Connection::open(db_path).context("open sqlite")?;
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
        .context("pragma")?;
    conn.execute_batch(SCHEMA).context("schema")?;
    Ok(conn)
}

pub fn db_path_from_root(root: &Path) -> std::path::PathBuf {
    root.join("data").join("wiki-db").join("wiki-stats.sqlite")
}

pub fn clear_all(conn: &Connection) -> Result<()> {
    conn.execute("DELETE FROM slices", [])?;
    conn.execute("DELETE FROM characters", [])?;
    Ok(())
}
