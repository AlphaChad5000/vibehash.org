/* The miner leaderboard, built from the chain itself. The node's /network names only today's top 5 by work, so this
   reads every block (GET /blocks, public, 100 at a time) and adds up, per address and per hour:
   - what it was paid: the block's reward transactions with memo "work" or "verify" (a validator's "propose" pay isn't
     mining, so it's left out)
   - the work it did: worker_flops + verifier_flops in the block's summary
   - the rounds it was in, accepted in, or missed, and how often it was slashed
   A cron trigger (wrangler.jsonc) does the reading a few chunks at a time, so a run stays small, and keeps 7 days of
   hourly totals in one KV value. /api/leaderboard only reads that value. */

const KEY = "state:v1";
const HOUR = 3600;
const KEEP_S = 7 * 86400 + HOUR;
const CHUNKS_PER_RUN = 3; // 100 blocks each; a week of 40-second blocks backfills in about an hour and a half
const BACKFILL_BLOCKS = 16000; // a little over a week of 40-second blocks; anything older is dropped by time anyway

// Per address in an hour: work pay, verify pay, FLOPs, rounds in, rounds accepted, rounds missed, slashes, last seen.
type Row = [number, number, number, number, number, number, number, number];
const W = 0, V = 1, F = 2, R = 3, A = 4, M = 5, S = 6, T = 7;

interface State {
  chain: string;
  next: number; // the next height to read
  tip: number; // the chain's height at the last run: next - 1 short of it means still catching up
  start: number; // the first height read
  from: number; // that block's timestamp
  updated: number; // when the last run finished (seconds)
  buckets: Record<string, { blocks: number; rows: Record<string, Row> }>; // hour start (seconds) -> totals
}

const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : 0);
const strs = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : []);

async function node(env: Env, path: string): Promise<any> {
  const res = await fetch(env.NODE + path, { headers: { Accept: "application/json", "User-Agent": "vibehash-web" } });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

function add(state: State, block: any) {
  const ts = num(block.timestamp);
  const hour = String(ts - (ts % HOUR));
  const b = (state.buckets[hour] ??= { blocks: 0, rows: {} });
  b.blocks++;
  const row = (a: string): Row => (b.rows[a] ??= [0, 0, 0, 0, 0, 0, 0, 0]);
  const s = block.summary && typeof block.summary === "object" ? block.summary : null;
  if (s) {
    const seen = new Set<string>();
    for (const f of ["worker_flops", "verifier_flops"]) {
      const m = s[f] && typeof s[f] === "object" ? s[f] : {};
      for (const a of Object.keys(m)) { row(a)[F] += num(m[a]); seen.add(a); }
    }
    for (const a of strs(s.accepted)) { row(a)[A]++; seen.add(a); }
    for (const a of strs(s.missed)) { row(a)[M]++; seen.add(a); }
    for (const sl of Array.isArray(s.slashes) ? s.slashes : []) {
      if (Array.isArray(sl) && typeof sl[0] === "string") { row(sl[0])[S]++; seen.add(sl[0]); }
    }
    for (const a of seen) { const r = row(a); r[R]++; r[T] = Math.max(r[T], ts); }
  }
  for (const tx of Array.isArray(block.txs) ? block.txs : []) {
    if (!tx || tx.kind !== "reward" || typeof tx.recipient !== "string") continue;
    if (tx.memo === "work") row(tx.recipient)[W] += num(tx.amount);
    else if (tx.memo === "verify") row(tx.recipient)[V] += num(tx.amount);
  }
}

/** One cron run: read the blocks since the last run, a few chunks at most, and save. */
export async function update(env: Env): Promise<void> {
  const status = await node(env, "/status");
  const tip = num(status.height);
  let state = (await env.LEADERBOARD.get<State>(KEY, "json")) ?? null;
  // A new chain (or one that restarted below where we were) starts the totals over.
  if (!state || state.chain !== status.chain_id || tip < state.next - 1) {
    const start = Math.max(1, tip - BACKFILL_BLOCKS);
    state = { chain: status.chain_id, next: start, tip, start, from: 0, updated: 0, buckets: {} };
  }
  for (let i = 0; i < CHUNKS_PER_RUN && state.next <= tip; i++) {
    const blocks = await node(env, `/blocks?from=${state.next}&to=${Math.min(state.next + 99, tip)}`);
    if (!Array.isArray(blocks) || !blocks.length) break;
    for (const block of blocks) {
      if (num(block.height) !== state.next) throw new Error(`expected block ${state.next}, got ${block.height}`);
      if (!state.from) state.from = num(block.timestamp);
      add(state, block);
      state.next++;
    }
  }
  const now = Math.floor(Date.now() / 1000);
  for (const h of Object.keys(state.buckets)) if (now - Number(h) > KEEP_S) delete state.buckets[h];
  state.from = Math.max(state.from, now - KEEP_S);
  state.updated = now;
  state.tip = tip;
  await env.LEADERBOARD.put(KEY, JSON.stringify(state));
}

const WINDOWS: Record<string, number> = { day: 86400, week: 7 * 86400 };
const ONLINE_S = 600; // as the node counts it (netstats.py)
const TOP = 100;

/** GET /api/leaderboard?window=day|week */
export async function read(env: Env, window: string): Promise<object> {
  const span = WINDOWS[window];
  if (!span) return { error: "window is day or week" };
  const state = await env.LEADERBOARD.get<State>(KEY, "json");
  const now = Math.floor(Date.now() / 1000);
  if (!state) return { window, ready: false, miners: [] };
  const since = now - span;
  const totals = new Map<string, Row>();
  let blocks = 0;
  for (const [h, b] of Object.entries(state.buckets)) {
    if (Number(h) + HOUR <= since) continue;
    blocks += b.blocks;
    for (const [a, r] of Object.entries(b.rows)) {
      const t = totals.get(a) ?? [0, 0, 0, 0, 0, 0, 0, 0];
      for (let i = 0; i < T; i++) t[i] += r[i];
      t[T] = Math.max(t[T], r[T]);
      totals.set(a, t);
    }
  }
  const all = [...totals].filter(([, r]) => r[W] + r[V] + r[F] + r[R] > 0);
  all.sort(([a, x], [b, y]) => y[W] + y[V] - (x[W] + x[V]) || y[F] - x[F] || y[R] - x[R] || (a < b ? -1 : 1));
  const sum = (i: number) => all.reduce((s, [, r]) => s + r[i], 0);
  return {
    window,
    ready: true,
    height: state.next - 1,
    updated: state.updated,
    // The totals start where the reading started; until the backfill reaches back a whole window, they cover less.
    covers_from: Math.max(since, state.from),
    complete: state.from <= since || state.start === 1,
    // Blocks the reading hasn't reached yet (it reads forward, a few hundred a run): the newest work isn't counted.
    behind: Math.max(0, (state.tip ?? 0) - (state.next - 1)),
    blocks,
    totals: { miners: all.length, earned: sum(W) + sum(V), flops: sum(F), online: all.filter(([, r]) => now - r[T] <= ONLINE_S).length },
    miners: all.slice(0, TOP).map(([address, r]) => ({
      address, earned: r[W] + r[V], earned_work: r[W], earned_verify: r[V], flops: r[F], rounds: r[R],
      accepted: r[A], missed: r[M], slashed: r[S], last_seen: r[T] || null
    }))
  };
}
