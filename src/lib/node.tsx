import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// The public testnet node. Every GET it answers carries Access-Control-Allow-Origin: *, so pages read it directly.
// ?node=<url> points the site at another node (a local testnet, say).
export const NODE = new URLSearchParams(location.search).get("node") || "https://node.vibehash.org";

export interface Job {
  id: string; model: string; status: string; escrow: number; fee_per_round: number; rounds_trained: number;
  units: number; examples: number; last_trained: { height: number; time: number } | null; metric: string;
  start: number | null; now: number | null; history: [number, number][];
  prep?: { layers: number; done: number[]; pieces_done: number; pieces_total: number; miners: number };
}
export interface Network {
  chain_id: string; height: number; time: number; now: number; subsidy: number; validators: number;
  miners: {
    online: number; day: number; units_day: number; flops_day: number; online_by_job: Record<string, number>;
    top_miners: { address: string; flops: number; units?: number }[]; block_time: number;
  };
  jobs: Job[];
}
export interface Status {
  chain_id: string; height: number; phase: string; phase_ends: number; round: number; job_id: string | null;
  min_stake: number; min_fee: number; version: string; min_client: string; subsidy: number;
  waiting?: Record<string, string>;
}
export interface Account {
  address: string; balance: number; stake: number; bootstrap: number; unbonding: [number, number][]; nonce: number; reputation: number;
}
export interface JobDetail {
  spec: Record<string, unknown> & { id: string; fee_per_round?: number; units_per_round?: number };
  owner: string; escrow: number;
  rounds: { height: number; accepted_units: number; val_loss: number | null; val_acc: number | null }[];
  model: { height: number; bytes: number; sha256: string | null };
}

export async function get<T>(path: string): Promise<T> {
  const r = await fetch(NODE + path, { cache: "no-store" });
  if (!r.ok) throw new Error(r.status === 404 ? "not found" : "the node answered " + r.status);
  return r.json() as Promise<T>;
}

interface Live { net: Network | null; status: Status | null; error: boolean; updated: number }
const LiveContext = createContext<Live>({ net: null, status: null, error: false, updated: 0 });

/** /network and /status, every 30 seconds while the page is visible, shared by every page. */
export function LiveProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState<Live>({ net: null, status: null, error: false, updated: 0 });
  useEffect(() => {
    let gone = false;
    const load = () => {
      const status = get<Status>("/status").catch(() => null); // the page works without it
      get<Network>("/network")
        .then(async (net) => { const s = await status; if (!gone) setLive({ net, status: s, error: false, updated: Date.now() }); })
        .catch(() => { if (!gone) setLive((l) => ({ ...l, error: true })); });
    };
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 30000);
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { gone = true; clearInterval(timer); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  return <LiveContext.Provider value={live}>{children}</LiveContext.Provider>;
}
export const useLive = () => useContext(LiveContext);

/** One GET, read again every `every` ms (0: once), with its loading and error state. */
export function useNode<T>(path: string | null, every = 0) {
  const [state, set] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: !!path });
  useEffect(() => {
    if (!path) { set({ data: null, error: null, loading: false }); return; }
    let gone = false;
    set((s) => ({ ...s, loading: true, error: null }));
    const load = () => get<T>(path)
      .then((data) => { if (!gone) set({ data, error: null, loading: false }); })
      .catch((e: Error) => { if (!gone) set((s) => ({ data: s.data, error: e.message, loading: false })); });
    load();
    const timer = every ? setInterval(() => { if (!document.hidden) load(); }, every) : 0;
    return () => { gone = true; if (timer) clearInterval(timer); };
  }, [path, every]);
  return state;
}
