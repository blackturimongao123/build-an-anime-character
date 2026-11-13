use crate::import::load_game_characters;
use crate::model::CharacterStats;
use anyhow::{Context, Result};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

const PHYSICAL: [&str; 4] = ["strength", "speed", "abilities", "durability"];

#[derive(Debug, Clone, Serialize)]
pub struct PhysicalStatBlock {
    pub strength: i32,
    pub speed: i32,
    pub abilities: i32,
    pub durability: i32,
}

impl From<CharacterStats> for PhysicalStatBlock {
    fn from(s: CharacterStats) -> Self {
        Self {
            strength: s.strength,
            speed: s.speed,
            abilities: s.abilities,
            durability: s.durability,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct AuditRow {
    pub id: String,
    pub display_name: String,
    pub series: String,
    pub wiki_page: Option<String>,
    pub game: PhysicalStatBlock,
    pub wiki_path: Option<PhysicalStatBlock>,
    pub wiki_peak: PhysicalStatBlock,
    pub delta_path: Option<HashMap<String, i32>>,
    pub peak_gap: PhysicalStatBlock,
    pub curated: Option<PhysicalStatBlock>,
    pub status: Vec<String>,
    pub notes: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct AuditReport {
    pub generated_at: String,
    pub summary: AuditSummary,
    pub rows: Vec<AuditRow>,
}

#[derive(Debug, Serialize)]
pub struct AuditSummary {
    pub total: usize,
    pub aligned_wiki_path: usize,
    pub wiki_path_mismatch: usize,
    pub has_curated: usize,
    pub wrong_wiki_suspect: usize,
    pub wiki_peak_above_game: usize,
    pub errors: usize,
}

#[derive(Debug, Deserialize)]
struct CheckResultRaw {
    id: String,
    ok: bool,
    #[serde(rename = "wiki_page")]
    wiki_page: Option<String>,
    error: Option<String>,
    expected: Option<CharacterStats>,
    stored: Option<CharacterStats>,
    delta: Option<HashMap<String, i32>>,
}

fn physical_delta_filtered(delta: &HashMap<String, i32>) -> HashMap<String, i32> {
    delta
        .iter()
        .filter(|(k, _)| PHYSICAL.contains(&k.as_str()))
        .map(|(k, v)| (k.clone(), *v))
        .collect()
}

fn wrong_wiki_notes(id: &str, wiki: &str, series: &str) -> Vec<String> {
    let w = wiki.to_lowercase();
    let mut notes = Vec::new();
    if id == "edward-elric" && w.contains("cullen") {
        notes.push("Wrong page: Edward Cullen — add wiki-hints → Edward Elric".into());
    }
    if id == "zeus-record" && (w.contains("riordan") || !w.contains("ragnarok")) {
        notes.push("Wrong page: not RoR Zeus — hint Zeus (Record of Ragnarok)".into());
    }
    if id == "roy-mustang" && w.contains("fire emblem") {
        notes.push("Wrong page: Fire Emblem Roy — hint Roy Mustang".into());
    }
    if id == "hinata-shoyo" && (w.contains("hyūga") || w.contains("hyuga")) {
        notes.push("Wrong page: Naruto Hinata — use curated baseline (no Haikyuu VS page)".into());
    }
    if id == "shinichi-izumi" && w.contains("conan") {
        notes.push("Wrong page: Conan — hint Shinichi Izumi (Parasyte)".into());
    }
    if series == "Haikyuu!!" && w.contains("naruto") {
        notes.push("Series/wiki mismatch".into());
    }
    notes
}

pub fn run_audit(root: &Path, conn: &Connection) -> Result<AuditReport> {
    let chars_path = root.join("data").join("characters.json");
    let report_path = root.join("data").join("stats-check-report.json");
    let curated_path = root.join("data").join("manual-curated-stats.json");

    let game_map = load_game_characters(root)?;
    let chars_raw: serde_json::Value = serde_json::from_str(&fs::read_to_string(&chars_path)?)?;
    let mut meta: HashMap<String, (String, String)> = HashMap::new();
    if let Some(arr) = chars_raw.as_array() {
        for c in arr {
            let id = c["id"].as_str().unwrap_or("");
            let name = c["displayName"].as_str().unwrap_or(id);
            let series = c["series"].as_str().unwrap_or("");
            meta.insert(id.to_string(), (name.to_string(), series.to_string()));
        }
    }

    let report: serde_json::Value = serde_json::from_str(&fs::read_to_string(&report_path)?)?;
    let mut checks: HashMap<String, CheckResultRaw> = HashMap::new();
    if let Some(results) = report["results"].as_array() {
        for r in results {
            let cr: CheckResultRaw = serde_json::from_value(r.clone())?;
            checks.insert(cr.id.clone(), cr);
        }
    }

    let curated_all: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(&curated_path).unwrap_or_else(|_| "{}".into()))?;

    let mut rows = Vec::new();
    let mut summary = AuditSummary {
        total: 0,
        aligned_wiki_path: 0,
        wiki_path_mismatch: 0,
        has_curated: 0,
        wrong_wiki_suspect: 0,
        wiki_peak_above_game: 0,
        errors: 0,
    };

    let ids: Vec<String> = meta.keys().cloned().collect();
    let mut sorted_ids = ids;
    sorted_ids.sort();

    for id in sorted_ids {
        let (display_name, series) = meta.get(&id).cloned().unwrap_or((id.clone(), String::new()));
        let game = game_map.get(&id).cloned().unwrap_or_default();
        let game_p: PhysicalStatBlock = game.clone().into();

        let (wiki_page, wiki_path, delta_path, check_ok, check_err) = match checks.get(&id) {
            Some(c) => {
                let d = c
                    .delta
                    .as_ref()
                    .map(physical_delta_filtered)
                    .filter(|m| !m.is_empty());
                (
                    c.wiki_page.clone(),
                    c.expected.clone().map(PhysicalStatBlock::from),
                    d,
                    c.ok,
                    c.error.clone(),
                )
            }
            None => (None, None, None, false, Some("missing from stats-check report".into())),
        };

        let peaks: (i32, i32, i32, i32) = conn
            .query_row(
                "SELECT COALESCE(MAX(strength),0), COALESCE(MAX(speed),0),
                        COALESCE(MAX(abilities),0), COALESCE(MAX(durability),0)
                 FROM slices WHERE character_id = ?1
                   AND lower(COALESCE(tab_path_label,'')) NOT LIKE '%manga%'
                   AND lower(COALESCE(column_label,'')) NOT LIKE '%manga%'
                   AND lower(COALESCE(tab_path_json,'')) NOT LIKE '%manga%'",
                params![id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .unwrap_or((0, 0, 0, 0));

        let wiki_peak = PhysicalStatBlock {
            strength: peaks.0,
            speed: peaks.1,
            abilities: peaks.2,
            durability: peaks.3,
        };

        let peak_gap = PhysicalStatBlock {
            strength: wiki_peak.strength - game_p.strength,
            speed: wiki_peak.speed - game_p.speed,
            abilities: wiki_peak.abilities - game_p.abilities,
            durability: wiki_peak.durability - game_p.durability,
        };

        let mut curated_p = None;
        if let Some(cur) = curated_all.get(&id) {
            if cur.is_object() {
                let g = game.clone();
                let mut c = PhysicalStatBlock::from(g);
                let mut touched = false;
                for key in PHYSICAL {
                    if let Some(v) = cur.get(key).and_then(|x| x.as_i64()) {
                        match key {
                            "strength" => c.strength = v as i32,
                            "speed" => c.speed = v as i32,
                            "abilities" => c.abilities = v as i32,
                            "durability" => c.durability = v as i32,
                            _ => {}
                        }
                        touched = true;
                    }
                }
                if touched {
                    curated_p = Some(c);
                }
            }
        }

        let mut status = Vec::new();
        let mut notes = Vec::new();

        if let Some(ref err) = check_err {
            status.push("error".into());
            summary.errors += 1;
            notes.push(err.clone());
        } else if check_ok {
            status.push("aligned_wiki_path".into());
            summary.aligned_wiki_path += 1;
        } else if delta_path.is_some() {
            status.push("wiki_path_mismatch".into());
            summary.wiki_path_mismatch += 1;
        }

        if curated_p.is_some() {
            status.push("curated".into());
            summary.has_curated += 1;
        }

        if let Some(ref wiki) = wiki_page {
            let wn = wrong_wiki_notes(&id, wiki, &series);
            if !wn.is_empty() {
                status.push("wrong_wiki_suspect".into());
                summary.wrong_wiki_suspect += 1;
                notes.extend(wn);
            }
        }

        let peak_above = PHYSICAL.iter().any(|k| {
            let gap = match *k {
                "strength" => peak_gap.strength,
                "speed" => peak_gap.speed,
                "abilities" => peak_gap.abilities,
                "durability" => peak_gap.durability,
                _ => 0,
            };
            gap >= 5
        });
        if peak_above {
            status.push("wiki_peak_above_game".into());
            summary.wiki_peak_above_game += 1;
        }

        summary.total += 1;
        rows.push(AuditRow {
            id,
            display_name,
            series,
            wiki_page,
            game: game_p,
            wiki_path,
            wiki_peak,
            delta_path,
            peak_gap,
            curated: curated_p,
            status,
            notes,
        });
    }

    Ok(AuditReport {
        generated_at: chrono_lite_timestamp(),
        summary,
        rows,
    })
}

fn chrono_lite_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let d = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}", d.as_secs())
}

pub fn write_reports(root: &Path, report: &AuditReport) -> Result<()> {
    let json_path = root.join("data").join("physical-stat-audit.json");
    let md_path = root.join("data").join("PHYSICAL_STAT_AUDIT.md");
    fs::write(
        &json_path,
        serde_json::to_string_pretty(report)? + "\n",
    )?;
    fs::write(&md_path, render_markdown(report))?;
    println!("Wrote {}", json_path.display());
    println!("Wrote {}", md_path.display());
    Ok(())
}

fn render_markdown(r: &AuditReport) -> String {
    let s = &r.summary;
    let mut out = String::new();
    out.push_str("# Physical stat audit (IQ excluded)\n\n");
    out.push_str(&format!(
        "Generated: `{}` | Characters: **{}**\n\n",
        r.generated_at, s.total
    ));
    out.push_str("| Metric | Count |\n|--------|------:|\n");
    out.push_str(&format!(
        "| Aligned with wiki profile path | {} |\n",
        s.aligned_wiki_path
    ));
    out.push_str(&format!(
        "| Wiki path mismatch (STR/SPD/ABL/DUR) | {} |\n",
        s.wiki_path_mismatch
    ));
    out.push_str(&format!("| Has `manual-curated-stats` | {} |\n", s.has_curated));
    out.push_str(&format!("| Wrong wiki page suspects | {} |\n", s.wrong_wiki_suspect));
    out.push_str(&format!(
        "| Wiki DB peak ≥5 above game (any stat) | {} |\n",
        s.wiki_peak_above_game
    ));
    out.push_str(&format!("| Check errors | {} |\n", s.errors));

    let mut sections: Vec<(&str, Vec<&AuditRow>)> = vec![
        ("Wrong wiki page", Vec::new()),
        ("Wiki path mismatch", Vec::new()),
        ("Curated overrides", Vec::new()),
        ("Wiki peak well above game (≥10 any stat)", Vec::new()),
    ];

    for row in &r.rows {
        if row.status.iter().any(|x| x == "wrong_wiki_suspect") {
            sections[0].1.push(row);
        } else if row.status.iter().any(|x| x == "wiki_path_mismatch") {
            sections[1].1.push(row);
        }
        if row.status.iter().any(|x| x == "curated") {
            sections[2].1.push(row);
        }
        let big_peak = row.peak_gap.strength >= 10
            || row.peak_gap.speed >= 10
            || row.peak_gap.abilities >= 10
            || row.peak_gap.durability >= 10;
        if big_peak {
            sections[3].1.push(row);
        }
    }

    for (title, rows) in sections {
        out.push_str(&format!("\n## {title} ({})\n\n", rows.len()));
        if rows.is_empty() {
            out.push_str("_None_\n");
            continue;
        }
        out.push_str("| id | series | game (S/Sp/A/D) | wiki path | wiki peak | notes |\n");
        out.push_str("|----|--------|-----------------|-----------|-----------|-------|\n");
        for row in rows {
            let game = fmt_block(&row.game);
            let path = row
                .wiki_path
                .as_ref()
                .map(fmt_block)
                .unwrap_or_else(|| "-".into());
            let peak = fmt_block(&row.wiki_peak);
            let notes = if row.notes.is_empty() {
                row.wiki_page.clone().unwrap_or_default()
            } else {
                format!("{} {}", row.notes.join("; "), row.wiki_page.as_deref().unwrap_or(""))
            };
            out.push_str(&format!(
                "| `{}` | {} | {} | {} | {} | {} |\n",
                row.id,
                row.series,
                game,
                path,
                peak,
                notes.replace('|', "/")
            ));
        }
    }

    out.push_str("\n## All characters (sorted)\n\n");
    out.push_str("| id | status | game | Δ path | peak gap |\n");
    out.push_str("|----|--------|------|--------|----------|\n");
    for row in &r.rows {
        let delta = row
            .delta_path
            .as_ref()
            .map(|d| {
                d.iter()
                    .map(|(k, v)| format!("{k}{v:+}"))
                    .collect::<Vec<_>>()
                    .join(" ")
            })
            .unwrap_or_default();
        let gap = format!(
            "S{:+} Sp{:+} A{:+} D{:+}",
            row.peak_gap.strength,
            row.peak_gap.speed,
            row.peak_gap.abilities,
            row.peak_gap.durability
        );
        out.push_str(&format!(
            "| `{}` | {} | {} | {} | {} |\n",
            row.id,
            row.status.join(","),
            fmt_block(&row.game),
            if delta.is_empty() { "-".into() } else { delta },
            gap
        ));
    }

    out
}

fn fmt_block(p: &PhysicalStatBlock) -> String {
    format!(
        "{}/{}/{}/{}",
        p.strength, p.speed, p.abilities, p.durability
    )
}

pub fn run_and_write(root: &Path, conn: &Connection) -> Result<()> {
    let report = run_audit(root, conn).context("audit")?;
    write_reports(root, &report)?;
    println!(
        "Summary: aligned={} mismatch={} curated={} wrong_wiki={} peak_above={} errors={}",
        report.summary.aligned_wiki_path,
        report.summary.wiki_path_mismatch,
        report.summary.has_curated,
        report.summary.wrong_wiki_suspect,
        report.summary.wiki_peak_above_game,
        report.summary.errors
    );
    Ok(())
}
