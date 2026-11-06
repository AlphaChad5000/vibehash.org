import { Link, useSearchParams } from "react-router-dom";
import { Btn, Layout, PageHead, Vh, linkCls } from "../components/Layout";
import { useLive, useNode } from "../lib/node";
import { ago, flopParts, int, short, vibe } from "../lib/format";

/** What worker/leaderboard.ts answers at /api/leaderboard. */
interface Board {
  window: string; ready: boolean; height?: number; updated?: number; covers_from?: number; complete?: boolean; behind?: number; blocks?: number;
  totals?: { miners: number; earned: number; flops: number; online: number };
  miners: {
    address: string; earned: number; earned_work: number; earned_verify: number; flops: number; rounds: number;
    accepted: number; missed: number; slashed: number; last_seen: number | null;
  }[];
}

const WINDOWS = [["day", "24 hours"], ["week", "7 days"]] as const;
const ONLINE_S = 600;
const mine = () => { try { return (localStorage.getItem("vh.address") || "").toLowerCase(); } catch { return ""; } };
const flops = (n: number) => flopParts(n).join(" ");
const date = (s: number) => new Date(s * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Every miner of the last day or week, ranked by the test VIBE the chain paid them, from the Worker's tally of the
    blocks (the node's own /network names only today's top 5). */
export default function Miners() {
  const [params, setParams] = useSearchParams();
  const span = params.get("w") === "day" ? "day" : "week";
  // Always the site's own API: the tally lives in the Worker, not on a node (so ?node= doesn't apply here).
  const { data, error } = useNode<Board>("/leaderboard?window=" + span, 60000, "/api");
  const { net } = useLive();
  const me = mine();
  const now = Date.now() / 1000;
  const t = data?.totals;
  const hw = net?.hardware;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <PageHead eyebrow="Miners" title="Who's mining the testnet">
          Every miner, ranked by the test VIBE the chain paid them for training that checked out, and for checking others' work. Read straight from the blocks, so nothing here is self-reported.
        </PageHead>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div role="tablist" aria-label="Period" className="inline-flex rounded-lg border border-rule p-1 bg-black/40">
            {WINDOWS.map(([w, label]) => (
              <button key={w} role="tab" aria-selected={span === w} onClick={() => setParams(w === "week" ? {} : { w }, { replace: true })}
                className={"rounded-md px-3.5 py-1.5 text-[0.92rem] " + (span === w ? "bg-white/10 text-fg" : "text-mute hover:text-fg")}>
                {label}
              </button>
            ))}
          </div>
          {data?.ready && data.updated && (
            <span className="text-sm text-dim">Counted from blocks up to #{int(data.height!)} · updated {ago(now - data.updated)}</span>
          )}
        </div>

        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-rule rounded-xl overflow-hidden border border-rule m-0">
          <div className="bg-ink p-5"><dt className="text-sm text-mute">Miners</dt><dd className="m-0 font-display text-3xl font-bold tabular-nums">{t ? int(t.miners) : "–"}</dd><small className="text-dim text-sm">in the last {span === "day" ? "24 hours" : "7 days"}</small></div>
          <div className="bg-ink p-5"><dt className="text-sm text-mute">Paid to miners</dt><dd className="m-0 font-display text-3xl font-bold tabular-nums text-signal">{t ? vibe(t.earned, 0) : "–"}</dd><small className="text-dim text-sm">for work and checks</small></div>
          <div className="bg-ink p-5"><dt className="text-sm text-mute">Training done</dt><dd className="m-0 font-display text-3xl font-bold tabular-nums">{t ? flops(t.flops) : "–"}</dd><small className="text-dim text-sm">work the blocks counted</small></div>
          <div className="bg-ink p-5"><dt className="text-sm text-mute">Online now</dt><dd className="m-0 font-display text-3xl font-bold tabular-nums">{net ? int(net.miners.online) : "–"}</dd><small className="text-dim text-sm">work in the last 10 minutes</small></div>
        </dl>

        {error && <p className="mt-6 text-bad">Couldn't read the leaderboard: {error}.</p>}
        {data && !data.ready && <p className="mt-6 text-mute">The leaderboard is reading the chain for the first time. Check back in a few minutes.</p>}
        {data?.ready && (data.behind ?? 0) > 10 && (
          <p className="mt-6 border-l-2 border-signal pl-4 text-mute">Still reading the chain: counted up to block #{int(data.height!)}, {int(data.behind!)} blocks short of the newest. It catches up a few hundred blocks every 2 minutes.</p>
        )}
        {data?.ready && data.complete === false && data.covers_from && (
          <p className="mt-6 border-l-2 border-signal pl-4 text-mute">Still reading back through the chain: these totals start {date(data.covers_from)}, so they're short of the full {span === "day" ? "24 hours" : "7 days"} for now.</p>
        )}

        {data?.ready && (data.miners.length ? (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-left text-[0.95rem] border-collapse">
              <thead className="text-sm text-mute">
                <tr className="border-b border-rule">
                  <th scope="col" className="py-3 pr-3 font-normal w-10">#</th>
                  <th scope="col" className="py-3 pr-3 font-normal">Miner</th>
                  <th scope="col" className="py-3 pr-3 font-normal text-right">Earned</th>
                  <th scope="col" className="py-3 pr-3 font-normal text-right hidden sm:table-cell">Work</th>
                  <th scope="col" className="py-3 pr-3 font-normal text-right hidden md:table-cell">Rounds</th>
                  <th scope="col" className="py-3 pr-3 font-normal text-right hidden md:table-cell">Slashed</th>
                  <th scope="col" className="py-3 font-normal text-right">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {data.miners.map((m, i) => {
                  const online = m.last_seen != null && now - m.last_seen <= ONLINE_S;
                  const you = me && m.address.toLowerCase() === me;
                  return (
                    <tr key={m.address} className={"border-b border-rule/70 " + (you ? "bg-signal/[0.07]" : "")}>
                      <td className={"py-3 pr-3 font-mono tabular-nums " + (i < 3 ? "text-signal" : "text-dim")}>{i + 1}</td>
                      <td className="py-3 pr-3">
                        <Link to={"/wallet?a=" + encodeURIComponent(m.address)} className="font-mono text-[0.88rem] text-fg hover:text-signal" title={m.address}>
                          <span className="sm:hidden">{short(m.address)}</span><span className="hidden sm:inline">{m.address}</span>
                        </Link>
                        {you && <span className="ml-2 font-mono text-[0.7rem] uppercase tracking-wider text-signal border border-signal/50 rounded px-1.5 py-px">you</span>}
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums whitespace-nowrap" title={`${vibe(m.earned_work)} for work, ${vibe(m.earned_verify)} for checks`}>{vibe(m.earned)}</td>
                      <td className="py-3 pr-3 text-right tabular-nums whitespace-nowrap text-mute hidden sm:table-cell">{flops(m.flops)}</td>
                      <td className="py-3 pr-3 text-right tabular-nums whitespace-nowrap text-mute hidden md:table-cell" title={`${m.accepted} accepted, ${m.missed} missed`}>{int(m.rounds)} <span className="text-dim">· {int(m.accepted)} accepted</span></td>
                      <td className={"py-3 pr-3 text-right tabular-nums hidden md:table-cell " + (m.slashed ? "text-bad" : "text-dim")}>{m.slashed ? int(m.slashed) : "–"}</td>
                      <td className="py-3 text-right whitespace-nowrap text-mute">
                        {online ? <span className="text-good"><span className="pulse-dot inline-block w-1.5 h-1.5 rounded-full bg-good mr-1.5 align-middle" />online</span> : m.last_seen ? ago(now - m.last_seen) : "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-rule bg-ink2/80 p-6 md:p-8 grid gap-4 justify-items-start">
            <p className="font-display text-2xl font-bold">Nobody has mined in the last {span === "day" ? "24 hours" : "7 days"}.</p>
            <p className="text-mute max-w-2xl">The top spot is open. A worker earns test VIBE for every unit of training that checks out, and it starts with one command: <code className="font-mono text-[0.9em] text-fg"><Vh cmd="worker" /></code>.</p>
            <div className="flex flex-wrap gap-3">
              <Btn href="/#join">Start mining <span aria-hidden="true">→</span></Btn>
              {span === "day" && <Btn kind="ghost" to="/miners">See the last 7 days</Btn>}
            </div>
          </div>
        ))}

        {hw && hw.classes.length > 0 && (
          <div className="mt-14 grid gap-3">
            <h2 className="font-semibold text-mute text-[0.95rem]">What miners run on today</h2>
            <div className="grid gap-px bg-rule rounded-xl overflow-hidden border border-rule sm:grid-cols-2 lg:grid-cols-3">
              {hw.classes.slice(0, 9).map((c) => (
                <div key={[c.vendor, c.arch, c.memory_gb, c.label].join("|")} className="bg-ink p-4 flex items-baseline justify-between gap-3">
                  <span><b className="font-semibold">{c.label}</b> <span className="text-dim text-sm">{c.memory_gb} GB</span></span>
                  <span className="text-sm text-mute tabular-nums whitespace-nowrap">{int(c.online)} online · {int(c.day)} today</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-dim">{int(hw.reported)} of today's {int(hw.day)} workers said what they run on. Counts only: the node never ties a machine to an address.</p>
          </div>
        )}

        <div className="mt-14 grid gap-2 max-w-3xl text-[0.95rem] text-mute">
          <h2 className="font-semibold text-fg">How it's counted</h2>
          <p><b className="text-fg font-semibold">Earned</b> adds up the block rewards paid to an address for training units that passed their checks and for checking other miners' units. A validator's pay for proposing blocks isn't mining, so it's left out. These are testnet coins, with no value.</p>
          <p><b className="text-fg font-semibold">Work</b> is the training the blocks credited, in floating-point operations. <b className="text-fg font-semibold">Rounds</b> counts the rounds a miner took part in; <b className="text-fg font-semibold">slashed</b> counts the times its stake was cut for work that didn't hold up.</p>
          <p>Ties go to more work. Find yourself with <code className="font-mono text-[0.9em] text-fg"><Vh cmd="wallet show" /></code>, or look up any address on the <Link className={linkCls} to="/wallet">wallet page</Link>; once you have, your row is marked here.</p>
        </div>
      </div>
    </Layout>
  );
}
