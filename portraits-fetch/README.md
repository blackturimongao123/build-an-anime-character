# portraits-fetch

Parallel Anime-Planet portrait downloader (Rust + Tokio).

## Usage

From repo root:

```bash
npm run data:portraits
```

Options (after `--`):

```bash
cargo run --release --manifest-path portraits-fetch/Cargo.toml -- --root . --force --jobs 12 --stagger-ms 120
```

- `--force` — re-download even when a file exists
- `--jobs` — concurrent lookups (default 12)
- `--stagger-ms` — delay after acquiring a worker slot (be polite to Anime-Planet)

Writes to `public-shared/portraits/` and `client/public/portraits/`, updates `data/characters.json`, logs to `data/portraits-log.txt`.

TypeScript fallback: `npm run portraits:ts --workspace=scripts`.
