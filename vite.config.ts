import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The app builds to dist/, which Cloudflare serves as static assets (wrangler.jsonc); public/ (the guide, /network/,
// the installers, the whitepaper) is copied in as it is. In `npm run dev`, /api/* goes straight to the public node,
// as worker/index.ts does in production (`npm run preview:cf` runs the real Worker locally).
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", sourcemap: true },
  server: {
    proxy: {
      "/api": { target: "https://node.vibehash.org", changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, "") }
    }
  }
});
