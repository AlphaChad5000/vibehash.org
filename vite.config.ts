import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static build for GitHub Pages / Cloudflare Pages: public/ (the guide, /network/, the installers, the whitepaper,
// CNAME) is copied as it is; scripts/spa-fallback.mjs copies index.html to 404.html so /wallet, /jobs/… load the app.
export default defineConfig({ plugins: [react()], build: { outDir: "dist", sourcemap: true } });
