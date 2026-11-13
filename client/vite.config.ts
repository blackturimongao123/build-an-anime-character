import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const publicDir = resolve(__dirname, "public");
const localWsPort = process.env.VITE_DEV_WS_PORT || "8781";
const charactersPath = resolve(root, "data", "characters.json");
const reelRosterPath = resolve(__dirname, "src", "data", "reel-roster.generated.json");

function syncAssets() {
  const portraits = resolve(root, "public-shared", "portraits");
  const target = resolve(publicDir, "portraits");
  mkdirSync(target, { recursive: true });
  if (existsSync(portraits)) {
    cpSync(portraits, target, { recursive: true, force: true });
  }
  writeReelRoster();
}

/**
 * The client only needs names and portraits for the roll reel's filler faces;
 * the server sends the real rolled characters. Bundling this slim list instead
 * of data/characters.json keeps the JS small as the roster grows.
 */
function writeReelRoster() {
  const characters = JSON.parse(readFileSync(charactersPath, "utf-8")) as {
    id: string;
    displayName: string;
    portrait: string;
  }[];
  const slim = characters
    .filter((c) => existsSync(resolve(root, "public-shared", c.portrait.replace(/^\//, ""))))
    .map(({ id, displayName, portrait }) => ({ id, displayName, portrait }));
  const json = JSON.stringify(slim);
  const current = existsSync(reelRosterPath) ? readFileSync(reelRosterPath, "utf-8") : "";
  if (current !== json) writeFileSync(reelRosterPath, json);
}

syncAssets();

export default defineConfig({
  plugins: [
    react(),
    {
      name: "sync-game-assets",
      buildStart() {
        syncAssets();
      },
      configureServer(server) {
        server.watcher.add(charactersPath);
        server.watcher.on("change", (file) => {
          if (resolve(file) === charactersPath) writeReelRoster();
        });
      },
    },
  ],
  base: process.env.VITE_BASE_PATH || "/",
  publicDir: "public",
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/game-ws": {
        target: `http://127.0.0.1:${localWsPort}`,
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
