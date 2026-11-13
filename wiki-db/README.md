# wiki-db (Rust)

SQLite search over full VS Battles scrapes (`data/wiki-db/scrapes/*.json`): every tab × every `Key:` column, sorted on import.

## Build & import

```bash
cargo build --release --manifest-path wiki-db/Cargo.toml
cargo run --release --manifest-path wiki-db/Cargo.toml -- --root . import
```

Or `npm run data:wiki-db-import`

## Commands

| Command | Purpose |
|---------|---------|
| `import` | Rebuild `data/wiki-db/wiki-stats.sqlite` from JSON scrapes + game stats |
| `stats` | Row counts |
| `search <query>` | Match id, name, series, wiki title |
| `slices <id>` | All slices sorted (tab → column → total) |
| `top --stat strength [--per-character]` | Highest slices or peak per character |
| `compare <id>` | Game stats vs wiki max per category |
| `game-vs-wiki --stat strength --min-gap 3` | Where wiki peak exceeds in-game |
| `sql "SELECT ..."` | Read-only SQL |

## Examples

```bash
wiki-db search yami
wiki-db slices ashborn-sl
wiki-db top --stat strength --per-character --limit 15
wiki-db compare yami-black-clover
wiki-db game-vs-wiki --stat speed --min-gap 5
wiki-db sql "SELECT series, COUNT(*) FROM characters GROUP BY series ORDER BY 2 DESC"
```

Pipeline: `npm run data:wiki-scrape` (JS) → `npm run data:wiki-db-import` (Rust) → browse/query.
