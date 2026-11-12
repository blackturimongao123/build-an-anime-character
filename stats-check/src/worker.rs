use anyhow::{Context, Result};
use serde::Deserialize;
use std::path::Path;
use std::process::Stdio;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::Mutex;

use crate::CheckResult;

struct Worker {
    _child: Child,
    stdin: Mutex<ChildStdin>,
    rx: Mutex<tokio::sync::mpsc::Receiver<String>>,
}

#[derive(Clone)]
pub struct WorkerPool {
    workers: Arc<Vec<Worker>>,
    next: Arc<AtomicUsize>,
}

impl WorkerPool {
    pub async fn spawn(root: &Path, count: usize) -> Result<Self> {
        let node = which_node();
        let tsx = root.join("node_modules").join("tsx").join("dist").join("cli.mjs");
        let worker = root.join("scripts").join("stats-check-worker.ts");
        anyhow::ensure!(tsx.is_file(), "missing tsx: {}", tsx.display());
        anyhow::ensure!(worker.is_file(), "missing worker: {}", worker.display());

        let mut workers = Vec::with_capacity(count);
        for _ in 0..count {
            let mut child = Command::new(&node)
                .arg(&tsx)
                .arg(&worker)
                .current_dir(root.join("scripts"))
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::inherit())
                .spawn()
                .context("spawn stats-check-worker")?;

            let stdin = child.stdin.take().context("worker stdin")?;
            let stdout = child.stdout.take().context("worker stdout")?;

            let (tx, rx) = tokio::sync::mpsc::channel::<String>(8);
            tokio::spawn(async move {
                let mut lines = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    if tx.send(line).await.is_err() {
                        break;
                    }
                }
            });

            workers.push(Worker {
                _child: child,
                stdin: Mutex::new(stdin),
                rx: Mutex::new(rx),
            });
        }

        Ok(Self {
            workers: Arc::new(workers),
            next: Arc::new(AtomicUsize::new(0)),
        })
    }

    pub async fn check(&self, id: &str) -> Result<CheckResult> {
        let idx = self.next.fetch_add(1, Ordering::Relaxed) % self.workers.len();
        let w = &self.workers[idx];
        let payload = format!(r#"{{"id":{}}}"#, serde_json::to_string(id)?);

        {
            let mut stdin = w.stdin.lock().await;
            stdin.write_all(payload.as_bytes()).await?;
            stdin.write_all(b"\n").await?;
            stdin.flush().await?;
        }

        let mut rx = w.rx.lock().await;
        let line = rx
            .recv()
            .await
            .context("worker stdout closed")?;

        #[derive(Deserialize)]
        struct Raw {
            id: String,
            ok: bool,
            #[serde(rename = "wikiPage")]
            wiki_page: Option<String>,
            error: Option<String>,
            expected: Option<crate::CharacterStats>,
            stored: Option<crate::CharacterStats>,
            delta: Option<std::collections::HashMap<String, i32>>,
        }

        let raw: Raw = serde_json::from_str(&line).context("parse worker json")?;
        Ok(CheckResult {
            id: raw.id,
            ok: raw.ok,
            wiki_page: raw.wiki_page,
            error: raw.error,
            expected: raw.expected,
            stored: raw.stored,
            delta: raw.delta,
        })
    }

    pub async fn shutdown(self) -> Result<()> {
        Ok(())
    }
}

/// Node binary: `NODE_BIN` if set, otherwise `node` from PATH.
fn which_node() -> String {
    std::env::var("NODE_BIN").unwrap_or_else(|_| "node".to_string())
}
