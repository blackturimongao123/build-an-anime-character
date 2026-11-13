use crate::db;
use crate::model::{tab_path_key, CharacterStats, GameCharacter, WikiCharacterScrape};
use anyhow::{Context, Result};
use rusqlite::params;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

fn scrape_dir(root: &Path) -> PathBuf {
    root.join("data").join("wiki-db").join("scrapes")
}

pub fn import_all(root: &Path, db_path: &Path) -> Result<(usize, usize)> {
    let scrapes_path = scrape_dir(root);
    let entries = fs::read_dir(&scrapes_path)
        .with_context(|| format!("read scrapes dir {}", scrapes_path.display()))?;

    let game = load_game_characters(root)?;

    let conn = db::open(db_path)?;
    db::clear_all(&conn)?;

    let mut char_count = 0usize;
    let mut slice_count = 0usize;

    let tx = conn.unchecked_transaction()?;

    for entry in entries {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let text = fs::read_to_string(&path)?;
        let scrape: WikiCharacterScrape =
            serde_json::from_str(&text).with_context(|| format!("parse {}", path.display()))?;

        let game_stats = game.get(&scrape.id);

        let mut sorted_slices = scrape.slices.clone();
        sorted_slices.sort_by(|a, b| {
            let ta = tab_path_key(&a.tab_path);
            let tb = tab_path_key(&b.tab_path);
            ta.cmp(&tb)
                .then(a.column_index.cmp(&b.column_index))
                .then_with(|| a.stats.total().cmp(&b.stats.total()).reverse())
        });

        tx.execute(
            "INSERT INTO characters (
                id, display_name, series, wiki_title, scraped_at, html_cache,
                tab_count, slice_count, scrape_error,
                game_strength, game_speed, game_abilities, game_iq, game_durability
            ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
            params![
                scrape.id,
                scrape.display_name,
                scrape.series,
                scrape.wiki_title,
                scrape.scraped_at,
                scrape.html_cache_file,
                scrape.tab_count,
                sorted_slices.len() as i32,
                scrape.error,
                game_stats.map(|s| s.strength),
                game_stats.map(|s| s.speed),
                game_stats.map(|s| s.abilities),
                game_stats.map(|s| s.iq),
                game_stats.map(|s| s.durability),
            ],
        )?;

        for sl in sorted_slices {
            let tab_json = serde_json::to_string(&sl.tab_path)?;
            let tab_label = tab_path_key(&sl.tab_path);
            let col_label = sl.column_label.as_deref().unwrap_or("");
            tx.execute(
                "INSERT INTO slices (
                    character_id, tab_path_json, tab_path_label, column_index, column_label,
                    strength, speed, abilities, iq, durability, stat_total, has_powers
                ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
                params![
                    scrape.id,
                    tab_json,
                    tab_label,
                    sl.column_index,
                    col_label,
                    sl.stats.strength,
                    sl.stats.speed,
                    sl.stats.abilities,
                    sl.stats.iq,
                    sl.stats.durability,
                    sl.stats.total(),
                    if sl.has_powers_section { 1 } else { 0 },
                ],
            )?;
            slice_count += 1;
        }
        char_count += 1;
    }

    tx.commit()?;
    Ok((char_count, slice_count))
}

pub fn load_game_characters(root: &Path) -> Result<HashMap<String, CharacterStats>> {
    let path = root.join("data").join("characters.json");
    let text = fs::read_to_string(&path)?;
    let chars: Vec<GameCharacter> = serde_json::from_str(&text)?;
    Ok(chars.into_iter().map(|c| (c.id, c.stats)).collect())
}
