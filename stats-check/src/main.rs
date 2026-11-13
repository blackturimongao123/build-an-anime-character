mod worker;

use anyhow::{Context, Result};
use clap::Parser;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Semaphore;

#[derive(Parser, Debug)]
#[command(about = "Parallel stat check against VS Battles wiki (via TS mapper workers)")]
struct Args {
    #[arg(long, default_value = "..")]
    root: PathBuf,

    #[arg(long, default_value = "6")]
    workers: usize,

    /// Write recomputed stats into data/characters.json when wiki parse succeeds
    #[arg(long)]
    apply: bool,

    /// Only list ids with any stat delta
    #[arg(long, default_value_t = true)]
    diff_only: bool,

    #[arg(long)]
    id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct CharacterStats {
    strength: i32,
    speed: i32,
    abilities: i32,
    iq: i32,
    durability: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CheckResult {
    id: String,
    ok: bool,
    #[serde(default)]
    wiki_page: Option<String>,
    #[serde(default)]
    error: Option<String>,
    #[serde(default)]
    expected: Option<CharacterStats>,
    #[serde(default)]
    stored: Option<CharacterStats>,
    #[serde(default)]
    delta: Option<HashMap<String, i32>>,
}

#[derive(Debug, Deserialize)]
struct Character {
    id: String,
    #[serde(default)]
    stats: CharacterStats,
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();
    let root = args.root.canonicalize().context("resolve --root")?;
    let characters_path = root.join("data").join("characters.json");
    let report_path = root.join("data").join("stats-check-report.json");

    let chars: Vec<Character> =
        serde_json::from_str(&tokio::fs::read_to_string(&characters_path).await?)?;

    let ids: Vec<String> = if let Some(id) = &args.id {
        vec![id.clone()]
    } else {
        chars.iter().map(|c| c.id.clone()).collect()
    };

    let pool = worker::WorkerPool::spawn(&root, args.workers).await?;
    let sem = Arc::new(Semaphore::new(args.workers));
    let mut join = tokio::task::JoinSet::new();

    for id in ids {
        let pool = pool.clone();
        let sem = sem.clone();
        join.spawn(async move {
            let _p = sem.acquire_owned().await.unwrap();
            let res = pool.check(&id).await;
            (id, res)
        });
    }

    let mut results: Vec<CheckResult> = Vec::new();
    while let Some(Ok((_id, res))) = join.join_next().await {
        match res {
            Ok(r) => results.push(r),
            Err(e) => results.push(CheckResult {
                id: _id,
                ok: false,
                wiki_page: None,
                error: Some(e.to_string()),
                expected: None,
                stored: None,
                delta: None,
            }),
        }
    }

    results.sort_by(|a, b| a.id.cmp(&b.id));

    let mismatches = results.iter().filter(|r| !r.ok && r.expected.is_some()).count();
    let errors = results.iter().filter(|r| r.error.is_some() && r.expected.is_none()).count();
    let aligned = results.iter().filter(|r| r.ok && r.error.is_none()).count();

    for r in &results {
        if args.diff_only && r.ok && r.delta.is_none() {
            continue;
        }
        if let Some(d) = &r.delta {
            eprintln!("DIFF {} {:?} wiki={:?}", r.id, d, r.wiki_page);
        } else if let Some(e) = &r.error {
            eprintln!("ERR  {} {}", r.id, e);
        } else if !args.diff_only {
            eprintln!("OK   {}", r.id);
        }
    }

    tokio::fs::write(
        &report_path,
        serde_json::to_string_pretty(&serde_json::json!({
            "summary": {
                "total": results.len(),
                "aligned": aligned,
                "mismatch": mismatches,
                "errors": errors,
            },
            "results": results,
        }))? + "\n",
    )
    .await?;

    if args.apply {
        let by_id: HashMap<String, CharacterStats> = results
            .iter()
            .filter_map(|r| r.expected.as_ref().map(|s| (r.id.clone(), s.clone())))
            .collect();
        if !by_id.is_empty() {
            let raw = tokio::fs::read_to_string(&characters_path).await?;
            let mut doc: serde_json::Value = serde_json::from_str(&raw)?;
            if let Some(arr) = doc.as_array_mut() {
                for c in arr {
                    let Some(id) = c.get("id").and_then(|v| v.as_str()) else {
                        continue;
                    };
                    let Some(wiki) = by_id.get(id) else {
                        continue;
                    };
                    let Some(stats) = c.get_mut("stats") else {
                        continue;
                    };
                    for key in ["strength", "speed", "abilities", "durability"] {
                        stats[key] = serde_json::json!(match key {
                            "strength" => wiki.strength,
                            "speed" => wiki.speed,
                            "abilities" => wiki.abilities,
                            "durability" => wiki.durability,
                            _ => unreachable!(),
                        });
                    }
                }
            }
            tokio::fs::write(
                &characters_path,
                serde_json::to_string_pretty(&doc)? + "\n",
            )
            .await?;
            println!("Applied stats for {} characters", by_id.len());
        }
    }

    println!(
        "stats-check: aligned={aligned} mismatch={mismatches} errors={errors} report={}",
        report_path.display()
    );
    pool.shutdown().await?;
    Ok(())
}
