import { Link } from "react-router-dom";
import { useLive, type Job, type Network } from "../lib/node";
import { ago, flopParts, int, pct, SYN } from "../lib/format";

/** The testnet's numbers right now, from /network. */
export function LiveStats() {
  const { net } = useLive();
  const m = net?.miners;
  const jobs = net?.jobs ?? [], open = jobs.filter((j) => j.status !== "finished").length;
  const fp = flopParts(m?.flops_day ?? 0);
  const cells: [string, string, string][] = [
    ["Latest block", net ? "#" + int(net.height) : "–", net ? (m?.block_time ? "every " + Math.round(m.block_time) + " s · " : "") + "last " + ago(net.now - net.time) : " "],
    ["Miners online", m ? int(m.online) : "–", "last 10 minutes"],
    ["Miners today", m ? int(m.day) : "–", "last 24 hours"],
    ["Trained today", m ? (m.flops_day ? fp[0] + " " + fp[1] : "0") : "–", m?.units_day ? int(m.units_day) + " units checked and paid" : "checked and paid"],
    ["Block reward", net ? (net.subsidy / SYN).toLocaleString("en-US", { maximumFractionDigits: 3 }) : "–", "test VIBE a block"],
    ["Jobs", net ? int(jobs.length) : "–", net ? open + " open · " + (jobs.length - open) + " finished" : "on the network"]
  ];
  return (
    <dl className="grid grid-cols-2 lg:grid-cols-6 gap-px bg-rule rounded-xl overflow-hidden border border-rule m-0">
      {cells.map(([k, v, s]) => (
        <div key={k} className="bg-ink p-5">
          <dt className="text-sm text-mute">{k}</dt>
          <dd className="m-0 font-display text-3xl font-bold tabular-nums">{v}</dd>
          <small className="text-dim text-sm">{s}</small>
        </div>
      ))}
    </dl>
  );
}

export const STATUS_COLOR: Record<string, string> = { training: "text-good", finished: "text-dim" };

/** What a job has done, in a few words. */
export function jobResult(j: Job): string {
  if (j.metric === "accuracy" && j.now != null) return (j.start != null ? pct(j.start) + " → " : "") + pct(j.now) + " accuracy";
  if (j.metric === "loss" && j.now != null) return (j.start != null ? j.start.toFixed(3) + " → " : "") + j.now.toFixed(3) + " loss";
  if (j.prep?.pieces_total) return int(j.prep.pieces_done) + " of " + int(j.prep.pieces_total) + " pieces prepared";
  if (j.rounds_trained) return int(j.rounds_trained) + " rounds";
  return "";
}

export function JobRows({ net, limit }: { net: Network | null; limit?: number }) {
  if (!net) return <p className="text-dim py-3">Reading the jobs from the node…</p>;
  const by = net.miners.online_by_job || {};
  const jobs = limit ? net.jobs.slice(0, limit) : net.jobs;
  return (
    <div className="grid">
      {jobs.map((j) => (
        <Link key={j.id} to={"/jobs/" + encodeURIComponent(j.id)}
          className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:grid-cols-[6.5rem_minmax(0,1fr)_auto_auto] gap-x-4 items-baseline border-b border-rule/70 py-2.5 text-[0.95rem] hover:bg-white/[0.02]">
          <span className={"font-mono text-[0.72rem] font-semibold tracking-wider uppercase " + (STATUS_COLOR[j.status] ?? "text-signal")}>● {j.status}</span>
          <span className="font-mono text-[0.88rem] truncate" title={j.model}>{j.id}</span>
          <span className="hidden sm:inline text-mute text-sm">{jobResult(j)}</span>
          <span className="text-mute text-sm tabular-nums">{j.status === "finished" ? int(j.units || 0) + (j.units === 1 ? " unit" : " units") : (by[j.id] || 0) + " on it"}</span>
        </Link>
      ))}
    </div>
  );
}
