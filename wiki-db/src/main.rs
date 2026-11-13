mod audit;
mod db;
mod import;
mod model;

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use rusqlite::{params, Connection};
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(
    name = "wiki-db",
    about = "Search VS Battles wiki scrape DB (all tabs × Key columns)"
)]
struct Cli {
    #[arg(long, default_value = ".")]
    root: PathBuf,

    #[arg(
        long,
        default_value = "data/wiki-db/wiki-stats.sqlite",
        help = "SQLite path relative to --root unless absolute"
    )]
    db: PathBuf,

    #[command(subcommand)]
    cmd: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Rebuild SQLite from data/wiki-db/scrapes/*.json (+ game stats from characters.json)
    Import,

    /// Quick DB summary
    Stats,

    /// Find characters by id, name, series, or wiki title
    Search {
        query: String,
        #[arg(long, default_value_t = 30)]
        limit: usize,
    },

    /// All slices for one character (sorted tab → column → total desc)
    Slices {
        id: String,
    },

    /// Top slices or peak per character for one stat
    Top {
        #[arg(long, default_value = "strength", value_parser = stat_col)]
        stat: String,
        #[arg(long, default_value_t = 25)]
        limit: usize,
        /// One row per character (max of that stat across slices)
        #[arg(long)]
        per_character: bool,
    },

    /// Compare in-game stat vs wiki slice peaks
    Compare {
        id: String,
    },

    /// Characters where in-game stat is below wiki max slice (by margin)
    GameVsWiki {
        #[arg(long, default_value = "strength", value_parser = stat_col)]
        stat: String,
        #[arg(long, default_value_t = 1)]
        min_gap: i32,
        #[arg(long, default_value_t = 40)]
        limit: usize,
    },

    /// Run a read-only SQL query (SELECT only)
    Sql {
        query: String,
    },

    /// Full physical-stat audit → data/physical-stat-audit.json + PHYSICAL_STAT_AUDIT.md
    Audit,
}

fn stat_col(s: &str) -> Result<String, String> {
    let allowed = [
        "strength", "speed", "abilities", "iq", "durability", "stat_total",
    ];
    if allowed.contains(&s) {
        Ok(s.to_string())
    } else {
        Err(format!("stat must be one of: {allowed:?}"))
    }
}

fn resolve_db(root: &PathBuf, db_arg: &PathBuf) -> PathBuf {
    if db_arg.is_absolute() {
        db_arg.clone()
    } else {
        root.join(db_arg)
    }
}

fn connect(root: &PathBuf, db_arg: &PathBuf) -> Result<Connection> {
    let path = resolve_db(root, db_arg);
    db::open(&path).with_context(|| format!("open {}", path.display()))
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    let root = cli
        .root
        .canonicalize()
        .unwrap_or_else(|_| cli.root.clone());

    match cli.cmd {
        Commands::Import => {
            let db_path = resolve_db(&root, &cli.db);
            let (chars, slices) = import::import_all(&root, &db_path)?;
            println!(
                "Imported {} characters, {} slices → {}",
                chars,
                slices,
                db_path.display()
            );
        }
        Commands::Stats => {
            let conn = connect(&root, &cli.db)?;
            let (chars, slices, series): (i64, i64, i64) = conn.query_row(
                "SELECT (SELECT COUNT(*) FROM characters),
                        (SELECT COUNT(*) FROM slices),
                        (SELECT COUNT(DISTINCT series) FROM characters)",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )?;
            println!("characters: {}", chars);
            println!("slices:     {}", slices);
            println!("series:     {}", series);
        }
        Commands::Search { query, limit } => {
            let conn = connect(&root, &cli.db)?;
            let q = format!("%{}%", query.replace('%', ""));
            let mut stmt = conn.prepare(
                "SELECT id, display_name, series, wiki_title, slice_count, game_strength, game_speed
                 FROM characters
                 WHERE id LIKE ?1 OR display_name LIKE ?1 OR series LIKE ?1 OR wiki_title LIKE ?1
                 ORDER BY display_name
                 LIMIT ?2",
            )?;
            let rows = stmt.query_map(params![q, limit as i64], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, Option<String>>(3)?,
                    r.get::<_, i32>(4)?,
                    r.get::<_, Option<i32>>(5)?,
                    r.get::<_, Option<i32>>(6)?,
                ))
            })?;
            println!(
                "{:<28} {:<22} {:<6} {:<6} slices",
                "id", "name", "str", "spd"
            );
            println!("{}", "-".repeat(78));
            for row in rows {
                let (id, name, _series, _wiki, sc, gs, spd) = row?;
                println!(
                    "{:<28} {:<22} {:<6} {:<6} {}",
                    id,
                    trunc(&name, 22),
                    gs.map(|x| x.to_string()).unwrap_or_else(|| "-".into()),
                    spd.map(|x| x.to_string()).unwrap_or_else(|| "-".into()),
                    sc
                );
            }
        }
        Commands::Slices { id } => {
            let conn = connect(&root, &cli.db)?;
            let meta: (String, String, Option<String>) = conn.query_row(
                "SELECT display_name, series, wiki_title FROM characters WHERE id = ?1",
                params![id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            ).with_context(|| format!("unknown id {id}"))?;

            println!(
                "{} — {} ({})",
                id,
                meta.0,
                meta.2.as_deref().unwrap_or("no wiki")
            );
            println!(
                "{:<4} {:<28} {:<32} str spd abl iq dur Σ",
                "#", "tab", "column"
            );
            println!("{}", "-".repeat(92));

            let mut stmt = conn.prepare(
                "SELECT column_index, column_label, tab_path_label,
                        strength, speed, abilities, iq, durability, stat_total
                 FROM slices WHERE character_id = ?1
                 ORDER BY tab_path_label, column_index, stat_total DESC",
            )?;
            let rows = stmt.query_map(params![id], |r| {
                Ok((
                    r.get::<_, i32>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, i32>(3)?,
                    r.get::<_, i32>(4)?,
                    r.get::<_, i32>(5)?,
                    r.get::<_, i32>(6)?,
                    r.get::<_, i32>(7)?,
                    r.get::<_, i32>(8)?,
                ))
            })?;
            let mut i = 1usize;
            for row in rows {
                let (col_ix, col_lbl, tab, str, spd, abl, iq, dur, tot) = row?;
                let col = if col_lbl.is_empty() {
                    format!("col {col_ix}")
                } else {
                    trunc(&col_lbl, 32)
                };
                println!(
                    "{:<4} {:<28} {:<32} {:>3} {:>3} {:>3} {:>2} {:>3} {:>3}",
                    i, trunc(&tab, 28), col, str, spd, abl, iq, dur, tot
                );
                i += 1;
            }
        }
        Commands::Top {
            stat,
            limit,
            per_character,
        } => {
            let conn = connect(&root, &cli.db)?;
            if per_character {
                let sql = format!(
                    "WITH ranked AS (
                        SELECT character_id, {stat} AS peak, tab_path_label,
                               ROW_NUMBER() OVER (
                                 PARTITION BY character_id ORDER BY {stat} DESC, stat_total DESC
                               ) AS rn
                        FROM slices
                     )
                     SELECT c.id, c.display_name, r.peak, r.tab_path_label
                     FROM ranked r
                     JOIN characters c ON c.id = r.character_id
                     WHERE r.rn = 1
                     ORDER BY r.peak DESC
                     LIMIT ?1"
                );
                let mut stmt = conn.prepare(&sql)?;
                let rows = stmt.query_map(params![limit as i64], |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, i32>(2)?,
                        r.get::<_, Option<String>>(3)?,
                    ))
                })?;
                println!("Peak {stat} per character (top {limit})");
                for row in rows {
                    let (id, name, peak, tab) = row?;
                    println!(
                        "{peak:>3}  {id:<26} {:<20} {}",
                        trunc(&name, 20),
                        tab.unwrap_or_default()
                    );
                }
            } else {
                let sql = format!(
                    "SELECT c.id, c.display_name, s.{stat}, s.tab_path_label, s.column_label
                     FROM slices s
                     JOIN characters c ON c.id = s.character_id
                     ORDER BY s.{stat} DESC
                     LIMIT ?1"
                );
                let mut stmt = conn.prepare(&sql)?;
                let rows = stmt.query_map(params![limit as i64], |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, i32>(2)?,
                        r.get::<_, String>(3)?,
                        r.get::<_, Option<String>>(4)?,
                    ))
                })?;
                println!("Top {limit} slices by {stat}");
                for row in rows {
                    let (id, name, v, tab, col) = row?;
                    println!(
                        "{v:>3}  {id:<26} {} | {} | {}",
                        trunc(&name, 16),
                        trunc(&tab, 22),
                        col.as_deref().unwrap_or("-")
                    );
                }
            }
        }
        Commands::Compare { id } => {
            let conn = connect(&root, &cli.db)?;
            let c: (String, Option<i32>, Option<i32>, Option<i32>, Option<i32>, Option<i32>) =
                conn.query_row(
                    "SELECT display_name, game_strength, game_speed, game_abilities, game_iq, game_durability
                     FROM characters WHERE id = ?1",
                    params![id],
                    |r| {
                        Ok((
                            r.get(0)?,
                            r.get(1)?,
                            r.get(2)?,
                            r.get(3)?,
                            r.get(4)?,
                            r.get(5)?,
                        ))
                    },
                )?;
            let peaks: (i32, i32, i32, i32, i32) = conn.query_row(
                "SELECT MAX(strength), MAX(speed), MAX(abilities), MAX(iq), MAX(durability)
                 FROM slices WHERE character_id = ?1",
                params![id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
            )?;

            println!("Compare: {id} ({})", c.0);
            println!("(IQ ignored — use manual-iq-overrides / data:iq-apply)");
            println!("{:>10} {:>6} {:>6} {:>6}", "", "game", "wiki max", "Δ");
            for (label, g, w) in [
                ("strength", c.1, Some(peaks.0)),
                ("speed", c.2, Some(peaks.1)),
                ("abilities", c.3, Some(peaks.2)),
                ("durability", c.5, Some(peaks.4)),
            ] {
                let gv = g.map(|x| x.to_string()).unwrap_or_else(|| "-".into());
                let wv = w.map(|x| x.to_string()).unwrap_or_else(|| "-".into());
                let delta = match (g, w) {
                    (Some(g), Some(w)) => format!("{:+}", w - g),
                    _ => "-".into(),
                };
                println!("{:>10} {:>6} {:>6} {:>6}", label, gv, wv, delta);
            }
        }
        Commands::GameVsWiki {
            stat,
            min_gap,
            limit,
        } => {
            let conn = connect(&root, &cli.db)?;
            let sql = format!(
                "SELECT c.id, c.display_name, c.game_{stat}, peak, peak - c.game_{stat} as gap
                 FROM characters c
                 JOIN (
                   SELECT character_id, MAX({stat}) AS peak FROM slices GROUP BY character_id
                 ) p ON p.character_id = c.id
                 WHERE c.game_{stat} IS NOT NULL AND peak - c.game_{stat} >= ?1
                 ORDER BY gap DESC
                 LIMIT ?2"
            );
            let mut stmt = conn.prepare(&sql)?;
            let rows = stmt.query_map(params![min_gap, limit as i64], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, i32>(2)?,
                    r.get::<_, i32>(3)?,
                    r.get::<_, i32>(4)?,
                ))
            })?;
            println!("Game vs wiki max {stat} (gap ≥ {min_gap})");
            for row in rows {
                let (id, name, game, peak, gap) = row?;
                println!(
                    "+{gap:>2}  {id:<26} game={game} wiki_peak={peak}  {}",
                    trunc(&name, 20)
                );
            }
        }
        Commands::Audit => {
            let conn = connect(&root, &cli.db)?;
            audit::run_and_write(&root, &conn)?;
        }
        Commands::Sql { query } => {
            let trimmed = query.trim();
            if !trimmed.to_ascii_lowercase().starts_with("select") {
                anyhow::bail!("only SELECT queries are allowed");
            }
            let conn = connect(&root, &cli.db)?;
            let mut stmt = conn.prepare(trimmed)?;
            let col_count = stmt.column_count();
            let mut names = Vec::new();
            for i in 0..col_count {
                names.push(stmt.column_name(i)?.to_string());
            }
            println!("{}", names.join("\t"));
            let mut rows = stmt.query([])?;
            while let Some(row) = rows.next()? {
                let mut cells = Vec::new();
                for i in 0..col_count {
                    let v: rusqlite::types::Value = row.get(i)?;
                    cells.push(value_to_string(&v));
                }
                println!("{}", cells.join("\t"));
            }
        }
    }
    Ok(())
}

fn trunc(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        format!("{}…", s.chars().take(max.saturating_sub(1)).collect::<String>())
    }
}

fn value_to_string(v: &rusqlite::types::Value) -> String {
    match v {
        rusqlite::types::Value::Null => "NULL".into(),
        rusqlite::types::Value::Integer(i) => i.to_string(),
        rusqlite::types::Value::Real(f) => f.to_string(),
        rusqlite::types::Value::Text(s) => s.clone(),
        rusqlite::types::Value::Blob(_) => "<blob>".into(),
    }
}
