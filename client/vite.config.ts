import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const publicDir = resolve(__dirname, "public");
const localWsPort = process.env.VITE_DEV_WS_PORT || "8781";

function syncAssets() {
  const portraits = resolve(root, "public-shared", "portraits");
  const target = resolve(publicDir, "portraits");
  mkdirSync(target, { recursive: true });
  if (existsSync(portraits)) {
    cpSync(portraits, target, { recursive: true, force: true });
  }
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
