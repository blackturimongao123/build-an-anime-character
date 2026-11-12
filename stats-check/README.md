# stats-check

Parallel VS Battles stat verification using **Rust workers** + **TypeScript mapper** (same rules as `scripts/lib/wiki-stats.ts`).

```bash
npm run data:stats-check
npm run data:stats-check-apply   # write recomputed stats into characters.json
```

Options:

```bash
cargo run --release --manifest-path stats-check/Cargo.toml -- --root . --workers 8 --id goku-ssj2
```

Report: `data/stats-check-report.json`
