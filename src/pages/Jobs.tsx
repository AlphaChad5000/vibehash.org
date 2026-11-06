import { Fragment } from "react";
import { Link, useParams } from "react-router-dom";
import { Btn, Layout, PageHead, Vh, linkCls } from "../components/Layout";
import { JobRows, LiveStats, STATUS_COLOR, jobResult } from "../components/Live";
import { Chart } from "../components/Chart";
import { useLive, useNode, type JobDetail } from "../lib/node";
import { ago, bytes, int, pct, short, vibe } from "../lib/format";

export function Jobs() {
  const { net } = useLive();
  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <PageHead eyebrow="Jobs" title="What the network is training">
          Every job posted to the testnet, live from the node. Jobs with budget left take turns, one round each; open one for its curve, settings and the commands to follow it.
        </PageHead>
        <LiveStats />
        <div className="mt-8"><JobRows net={net} /></div>
        <div className="mt-8 flex flex-wrap gap-3"><Btn to="/submit">Submit a job <span aria-hidden="true">→</span></Btn><Btn href="/network/" kind="ghost">Full network reports</Btn></div>
      </div>
    </Layout>
  );
}

const SETTING_NAMES: Record<string, string> = {
  units_per_round: "Units a round", steps_per_unit: "Steps a unit", batch_size: "Batch size", lr: "Learning rate",
  precision: "Precision", memory_mb: "Memory a worker needs", tolerance: "Replay tolerance", checkpoint_every: "Checkpoint every",
  base: "Base model", rank: "LoRA rank", max_len: "Longest sequence"
};

export function JobPage() {
  const { id = "" } = useParams();
  const { net, status } = useLive();
  const { data, error } = useNode<JobDetail>("/job/" + encodeURIComponent(id), 30000);
  const summary = net?.jobs.find((j) => j.id === id);
  const on = net?.miners.online_by_job?.[id] ?? 0;
  const waiting = status?.waiting?.[id];

  // The curve: the first score, then the rounds that trained this job (it sits out the others' turns unchanged).
  const trained = (data?.rounds ?? []).filter((r, i) => i === 0 || r.accepted_units > 0);
  const accRounds = trained.filter((r) => r.val_acc != null);
  const lossRounds = trained.filter((r) => r.val_loss != null);
  const useAcc = summary ? summary.metric === "accuracy" : accRounds.length > 0;
  const series: [number, number][] = useAcc ? accRounds.map((r) => [r.height, r.val_acc as number]) : lossRounds.map((r) => [r.height, r.val_loss as number]);
  const paidUnits = (data?.rounds ?? []).reduce((s, r) => s + (r.accepted_units || 0), 0);
  const spec: Record<string, unknown> = data?.spec ?? {};
  const fee = typeof spec.fee_per_round === "number" ? spec.fee_per_round : summary?.fee_per_round;
  const roundsLeft = fee && data ? Math.floor(data.escrow / fee) : null;
  const model = spec.model as Record<string, unknown> | undefined;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <p className="pt-8 text-sm"><Link className={linkCls} to="/jobs">← All jobs</Link></p>
        <PageHead eyebrow={summary ? summary.status : "Job"} title={<span className="font-mono text-[0.8em] break-all">{id}</span>}>
          {summary?.model ?? (error ? "" : "Reading the job from the node…")}
        </PageHead>
        {error && <p className="text-bad">Couldn't read this job: {error}.</p>}
        {summary && (
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-rule rounded-xl overflow-hidden border border-rule m-0">
            <div className="bg-ink p-5"><dt className="text-sm text-mute">Status</dt><dd className={"m-0 font-display text-2xl font-bold capitalize " + (STATUS_COLOR[summary.status] ?? "text-signal")}>{summary.status}</dd><small className="text-dim text-sm">{summary.status === "finished" ? "budget spent" : on + " miner" + (on === 1 ? "" : "s") + " on it now"}</small></div>
            <div className="bg-ink p-5"><dt className="text-sm text-mute">Result</dt><dd className="m-0 font-display text-2xl font-bold">{jobResult(summary) || "–"}</dd><small className="text-dim text-sm">held-out {summary.metric}</small></div>
            <div className="bg-ink p-5"><dt className="text-sm text-mute">Training done</dt><dd className="m-0 font-display text-2xl font-bold tabular-nums">{int(summary.rounds_trained)} rounds</dd><small className="text-dim text-sm">{int(summary.units)} units · {int(summary.examples)} examples</small></div>
            <div className="bg-ink p-5"><dt className="text-sm text-mute">Budget left</dt><dd className="m-0 font-display text-2xl font-bold tabular-nums">{vibe(summary.escrow, 0)}</dd><small className="text-dim text-sm">{roundsLeft ? "about " + int(roundsLeft) + " rounds at " + vibe(fee!, 0) + " each" : summary.escrow ? " " : "spent"}</small></div>
          </dl>
        )}
        {waiting && <p className="mt-5 border-l-2 border-signal pl-4 text-mute">Waiting: {waiting}</p>}
        {summary?.prep && summary.prep.pieces_total > 0 && (
          <div className="mt-10 grid gap-3">
            <h2 className="font-semibold text-mute text-[0.95rem]">Preparing the frozen layers: {int(summary.prep.pieces_done)} of {int(summary.prep.pieces_total)} pieces</h2>
            <div className="grid gap-[3px] h-24 items-end" style={{ gridTemplateColumns: `repeat(${summary.prep.done.length + 4}, minmax(0,1fr))` }}>
              {summary.prep.done.map((f, i) => (
                <i key={i} className="relative h-full bg-white/[0.06]"><b className="absolute inset-x-0 bottom-0" style={{ height: Math.max(2, f * 100) + "%", background: `hsl(${44 - i * 3.75} 78% 58%)` }} /></i>
              ))}
              {[0, 1, 2, 3].map((i) => <i key={"t" + i} className="h-full border border-good/70 bg-good/10" />)}
            </div>
            <p className="text-sm text-dim">Layer 1 on the left. The last four, outlined, are the ones miners train once the rest are ready.</p>
          </div>
        )}
        {data && (
          <div className="mt-10 grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-10">
            <div className="grid gap-3 content-start min-w-0">
              <h2 className="font-semibold text-mute text-[0.95rem]">Held-out {useAcc ? "accuracy" : "loss"}, round by round</h2>
              <Chart points={series} format={useAcc ? pct : (y) => y.toFixed(3)} />
              <p className="text-sm text-dim">{int(Math.max(0, trained.length - 1))} rounds that trained it · {int(paidUnits)} units accepted{summary?.last_trained && net ? " · last trained " + ago(net.now - summary.last_trained.time) : ""}</p>
            </div>
            <div className="grid gap-6 content-start">
              <div className="grid gap-2">
                <h2 className="font-semibold text-mute text-[0.95rem]">Settings</h2>
                <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-[0.95rem] m-0">
                  <dt className="text-mute">Posted by</dt><dd className="m-0 font-mono text-[0.85rem]" title={data.owner}>{short(data.owner)}</dd>
                  {fee != null && <><dt className="text-mute">Pay a round</dt><dd className="m-0">{vibe(fee)}</dd></>}
                  {model && "n_in" in model && <><dt className="text-mute">Model</dt><dd className="m-0">{String(model.n_in)} inputs → {(model.n_hidden as number[] | undefined)?.join(" × ")} → {String(model.n_out)} outputs</dd></>}
                  {Object.entries(SETTING_NAMES).filter(([k]) => spec[k] != null && typeof spec[k] !== "object").map(([k, label]) => (
                    <Fragment key={k}><dt className="text-mute">{label}</dt><dd className="m-0 break-words">{k === "memory_mb" ? int(spec[k] as number) + " MB" : String(spec[k])}</dd></Fragment>
                  ))}
                  {data.model.bytes > 0 && <><dt className="text-mute">Trained model</dt><dd className="m-0">{bytes(data.model.bytes)}{data.model.height ? ", as of block #" + int(data.model.height) : ""}</dd></>}
                </dl>
              </div>
              <div className="grid gap-2">
                <h2 className="font-semibold text-mute text-[0.95rem]">Follow it, or take the model</h2>
                <div className="rounded-lg bg-black/50 border border-rule px-4 py-3 grid gap-1 font-mono text-[0.82rem] overflow-x-auto">
                  {[`job watch ${id}`, `job history ${id}`, `job download ${id}`, `worker --job ${id}`].map((c) => (
                    <span key={c} className="whitespace-nowrap"><span className="text-signal">&gt;</span> <Vh cmd={c} /></span>
                  ))}
                </div>
                <p className="text-sm text-dim">The last line mines this job's rounds only. <a className={linkCls} href={`https://node.vibehash.org/job/${encodeURIComponent(id)}`}>Raw JSON from the node</a>.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
