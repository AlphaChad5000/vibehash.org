/* The node's public API, under the site's own /api/*. Every visitor's page polls /network and /status, so answering
   those from Cloudflare's cache for a few seconds turns thousands of page loads into a handful of requests to the one
   node. Only the node's GETs pass through, by an allowlist; nothing here holds a key or changes anything. Everything
   that isn't /api/* never reaches this code: wrangler.jsonc serves it as static assets. */

// Seconds each answer may be reused: about a tenth of a 40-second block for what changes every block, longer for
// what changes rarely. null: never cached.
const ROUTES: [RegExp, number | null][] = [
  [/^\/status$/, 3],
  [/^\/network$/, 10],
  [/^\/supply$/, 30],
  [/^\/validators$/, 30],
  [/^\/account\/[A-Za-z0-9]{1,128}$/, 5],
  [/^\/job\/[a-z0-9][a-z0-9._-]{0,63}$/, 15]
];

import { read as leaderboard, update as updateLeaderboard } from "./leaderboard";

const CORS = { "Access-Control-Allow-Origin": "*" };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, "");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Methods": "GET", "Access-Control-Max-Age": "86400" } });
    if (request.method !== "GET" && request.method !== "HEAD") return json(405, { error: "the site's API only reads" });
    if (path === "/leaderboard") return board(env, ctx, url.searchParams.get("window") || "day");
    const route = ROUTES.find(([re]) => re.test(path));
    if (!route) return json(404, { error: "no such API path", paths: ["/api/status", "/api/network", "/api/supply", "/api/validators", "/api/account/<address>", "/api/job/<id>", "/api/leaderboard?window=day|week"] });
    const ttl = route[1];

    // One cache entry per node path, whatever the page added to the query string.
    const key = new Request(new URL(path, "https://cache.vibehash.invalid").toString());
    const cache = caches.default;
    if (ttl) {
      const hit = await cache.match(key);
      if (hit) return hit;
    }
    let upstream: Response;
    try {
      upstream = await fetch(env.NODE + path, { headers: { Accept: "application/json", "User-Agent": "vibehash-web" }, cf: { cacheTtl: 0 } });
    } catch {
      return json(502, { error: "can't reach the node" });
    }
    const res = new Response(upstream.body, upstream);
    res.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Cache-Control", ttl && upstream.ok ? `public, max-age=${ttl}` : "no-store");
    res.headers.delete("Set-Cookie");
    if (ttl && upstream.ok) ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  },

  // Every 2 minutes (wrangler.jsonc): read the new blocks into the leaderboard's totals.
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(updateLeaderboard(env));
  }
} satisfies ExportedHandler<Env>;

/** The leaderboard, from the totals the cron keeps (worker/leaderboard.ts), cached a minute: they change every 2. */
async function board(env: Env, ctx: ExecutionContext, window: string): Promise<Response> {
  const key = new Request("https://cache.vibehash.invalid/leaderboard?window=" + encodeURIComponent(window));
  const hit = await caches.default.match(key);
  if (hit) return hit;
  const body = await leaderboard(env, window);
  const ok = !("error" in body);
  const res = new Response(JSON.stringify(body), {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "application/json", ...CORS, "Cache-Control": ok ? "public, max-age=60" : "no-store" }
  });
  if (ok) ctx.waitUntil(caches.default.put(key, res.clone()));
  return res;
}
