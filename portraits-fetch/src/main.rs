mod anime_planet;

use anyhow::{Context, Result};
use clap::Parser;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;

#[derive(Parser, Debug)]
#[command(about = "Fetch roster portraits from Anime-Planet (CDN) in parallel")]
struct Args {
    /// Project root (contains data/characters.json)
    #[arg(long, default_value = "..")]
    root: PathBuf,

    #[arg(long)]
    force: bool,

    /// Max concurrent character lookups
    #[arg(long, default_value = "12")]
    jobs: usize,

    /// Delay between starting each job (ms) — be polite to Anime-Planet
    #[arg(long, default_value = "120")]
    stagger_ms: u64,
}


fn portrait_exists(dir: &Path, id: &str) -> Option<String> {
    for ext in [".webp", ".jpg", ".jpeg", ".png"] {
        let p = dir.join(format!("{id}{ext}"));
        if p.is_file() {
            return Some(ext.to_string());
        }
    }
    None
}

#[derive(Debug)]
enum Outcome {
    Skipped(String),
    /// Downloaded but not yet written: files are only written after the
    /// duplicate-image check below.
    Downloaded { ext: String, url: String, bytes: Vec<u8> },
    Saved { ext: String, url: String },
    Missed,
    Failed(String),
}

async fn process_one(
    client: &reqwest::Client,
    display_name: &str,
) -> Result<Option<(String, String, Vec<u8>)>> {
    let Some(image_url) = anime_planet::portrait_url(client, display_name).await? else {
        return Ok(None);
    };
    let res = client
        .get(&image_url)
        .header("User-Agent", "BuildCharacterPortraitBot/1.0")
        .send()
        .await?;
    if !res.status().is_success() {
        anyhow::bail!("HTTP {}", res.status());
    }
    let ext = anime_planet::ext_from_url(&image_url).to_string();
    let bytes = res.bytes().await?.to_vec();
    Ok(Some((image_url, ext, bytes)))
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();
    let root = args
        .root
        .canonicalize()
        .context("resolve --root")?;
    let characters_path = root.join("data").join("characters.json");
    let out_dir = root.join("public-shared").join("portraits");
    let client_portraits = root.join("client").join("public").join("portraits");
  let log_path = root.join("data").join("portraits-log.txt");

    tokio::fs::create_dir_all(&out_dir).await?;
    tokio::fs::create_dir_all(&client_portraits).await?;

    let raw = tokio::fs::read_to_string(&characters_path).await?;
    let mut doc: serde_json::Value = serde_json::from_str(&raw)?;
    let chars = doc.as_array_mut().context("characters.json must be an array")?;

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(8))
        .timeout(Duration::from_secs(45))
        .build()?;
    let client = Arc::new(client);
    let sem = Arc::new(Semaphore::new(args.jobs));

    let mut join = JoinSet::new();
    let total = chars.len();

    for entry in chars.iter() {
        let sem = sem.clone();
        let client = client.clone();
        let id = entry
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let display = entry
            .get("displayName")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        if id.is_empty() {
            continue;
        }
        let force = args.force;
        let out_dir = out_dir.clone();

        let stagger = Duration::from_millis(args.stagger_ms);

        join.spawn(async move {
            let _permit = sem.acquire_owned().await.unwrap();
            tokio::time::sleep(stagger).await;

            if !force {
                if let Some(ext) = portrait_exists(&out_dir, &id) {
                    return (id, Outcome::Skipped(ext));
                }
            }

            match process_one(&client, &display).await {
                Ok(Some((image_url, ext, bytes))) => {
                    (id, Outcome::Downloaded { ext, url: image_url, bytes })
                }
                Ok(None) => (id, Outcome::Missed),
                Err(e) => (id, Outcome::Failed(e.to_string())),
            }
        });
    }

    let mut outcomes: HashMap<String, Outcome> = HashMap::new();
    while let Some(res) = join.join_next().await {
        let (id, outcome) = res.context("task join")?;
        outcomes.insert(id, outcome);
    }

    // Guard: if the same image bytes came back for more than one character,
    // the page matched a generic/site image (e.g. a featured character), not
    // the character's own portrait. Reject all of them instead of saving it.
    let mut by_hash: HashMap<u64, Vec<String>> = HashMap::new();
    for (id, outcome) in &outcomes {
        if let Outcome::Downloaded { bytes, .. } = outcome {
            by_hash.entry(hash_bytes(bytes)).or_default().push(id.clone());
        }
    }
    for ids in by_hash.values().filter(|ids| ids.len() > 1) {
        for id in ids {
            outcomes.insert(
                id.clone(),
                Outcome::Failed(format!(
                    "same image as {} other character(s); likely a site placeholder, not saved",
                    ids.len() - 1
                )),
            );
        }
    }
    for (id, outcome) in outcomes.iter_mut() {
        if let Outcome::Downloaded { ext, url, bytes } = outcome {
            let filename = format!("{id}{ext}");
            let mut result = tokio::fs::write(out_dir.join(&filename), &*bytes).await;
            if result.is_ok() {
                result = tokio::fs::write(client_portraits.join(&filename), &*bytes).await;
            }
            *outcome = match result {
                Ok(()) => Outcome::Saved { ext: ext.clone(), url: url.clone() },
                Err(e) => Outcome::Failed(e.to_string()),
            };
        }
    }

    let mut changed = false;
    let mut log_lines = vec![format!(
        "portraits-fetch {} jobs={} force={}",
        chrono_like_timestamp(),
        args.jobs,
        args.force
    )];

    for entry in chars.iter_mut() {
        let id = entry
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let Some(outcome) = outcomes.remove(&id) else {
            continue;
        };
        match outcome {
            Outcome::Skipped(ext) => {
                let web = format!(
                    "/portraits/{}{}",
                    id,
                    if ext.starts_with('.') { ext.clone() } else { format!(".{ext}") }
                );
                let current = entry.get("portrait").and_then(|v| v.as_str()).unwrap_or("");
                if current != web {
                    entry["portrait"] = serde_json::Value::String(web);
                    changed = true;
                }
                log_lines.push(format!("Skip existing {id} ({ext})"));
            }
            Outcome::Saved { ext, url } => {
                let web = format!(
                    "/portraits/{}{}",
                    id,
                    if ext.starts_with('.') { ext } else { format!(".{ext}") }
                );
                log_lines.push(format!("OK {id} -> {web} (from {url})"));
                entry["portrait"] = serde_json::Value::String(web);
                changed = true;
            }
            Outcome::Downloaded { .. } => unreachable!("written or rejected above"),
            Outcome::Missed => {
                log_lines.push(format!("MISS {id}"));
                let name = entry
                    .get("displayName")
                    .and_then(|v| v.as_str())
                    .unwrap_or(&id);
                eprintln!("No image for {id} ({name})");
            }
            Outcome::Failed(msg) => {
                log_lines.push(format!("FAIL {id}: {msg}"));
                eprintln!("Failed {id}: {msg}");
            }
        }
    }

    if changed {
        let json = serde_json::to_string_pretty(&doc)? + "\n";
        tokio::fs::write(&characters_path, json).await?;
        log_lines.push("Updated data/characters.json".into());
    }

    let saved = log_lines.iter().filter(|l| l.starts_with("OK ")).count();
    let missed = log_lines.iter().filter(|l| l.starts_with("MISS")).count();
    log_lines.push(format!(
        "Done {total} roster: saved={saved} missed={missed}"
    ));
    tokio::fs::write(&log_path, log_lines.join("\n") + "\n").await?;

    println!(
        "Finished: {saved} saved, {missed} missing, {total} total (log: {})",
        log_path.display()
    );
    Ok(())
}

fn hash_bytes(bytes: &[u8]) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    bytes.hash(&mut h);
    h.finish()
}

fn chrono_like_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{secs}")
}
