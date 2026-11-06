import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Layout, PageHead, Vh, linkCls } from "../components/Layout";
import { useLive, useNode, type Account } from "../lib/node";
import { flopParts, int, SYN, vibe } from "../lib/format";

const KEY = "vh.address";
const REP_MIN = 0.5, REP_MAX = 1.0, REP_START = 0.8; // economics.py
const remembered = () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } };

/** Look up any address: balance, stake, coins unbonding, reputation, and today's work if it's among the top miners.
    Read-only: the page never sees a key, so nothing here can move coins. */
export default function Wallet() {
  const [params, setParams] = useSearchParams();
  const address = (params.get("a") || "").trim();
  const [draft, setDraft] = useState(address || remembered());
  useEffect(() => {
    if (!address && remembered()) setParams({ a: remembered() }, { replace: true });
  }, [address, setParams]);
  useEffect(() => {
    if (address) { setDraft(address); try { localStorage.setItem(KEY, address); } catch { /* private mode */ } }
  }, [address]);
  const { data: acct, error, loading } = useNode<Account>(address ? "/account/" + encodeURIComponent(address) : null, 30000);
  const { net, status } = useLive();
  const submit = (e: FormEvent) => { e.preventDefault(); const a = draft.trim(); if (a) setParams({ a }); };
  const forget = () => { try { localStorage.removeItem(KEY); } catch { /* private mode */ } setDraft(""); setParams({}); };

  const top = net?.miners.top_miners ?? [];
  const rank = acct ? top.findIndex((t) => t.address.toLowerCase() === acct.address.toLowerCase()) : -1;
  const empty = acct && !acct.balance && !acct.stake && !acct.nonce && !acct.unbonding.length;
  const minStake = status?.min_stake ?? 5 * SYN;
  const repFill = acct ? Math.max(0, Math.min(1, (acct.reputation - REP_MIN) / (REP_MAX - REP_MIN))) : 0;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <PageHead eyebrow="Wallet" title="Your earnings, live">
          Paste your wallet's address to follow its balance, stake and reputation as blocks land. <code className="font-mono text-[0.85em] text-fg"><Vh cmd="wallet show" /></code> prints it. This page only reads the chain: it never asks for your password or recovery words, and never will.
        </PageHead>
        <form onSubmit={submit} className="flex flex-wrap gap-3 max-w-3xl">
          <label className="sr-only" htmlFor="addr">Address</label>
          <input id="addr" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="vibe1…" spellCheck={false} autoComplete="off"
            className="flex-1 min-w-[16rem] rounded-lg bg-black/50 border border-rule px-4 py-3 font-mono text-[0.92rem] text-fg placeholder:text-dim focus:border-mute outline-none" />
          <button type="submit" className="rounded-lg bg-signal text-[#1d1406] font-bold px-5 py-3 hover:brightness-110">Look up</button>
          {address && <button type="button" onClick={forget} className="rounded-lg border border-rule px-4 py-3 text-mute hover:text-fg">Forget</button>}
        </form>

        {error && <p className="mt-6 text-bad">Couldn't read that address: {error}.</p>}
        {loading && !acct && <p className="mt-6 text-dim">Reading the chain…</p>}
        {acct && (
          <div className="mt-10 grid gap-8">
            <p className="font-mono text-[0.85rem] text-mute break-all">{acct.address}</p>
            {empty && (
              <div className="border-l-2 border-signal pl-4 text-mute">
                Nothing on the chain for this address yet. Its first pay arrives once it has done work that checks out: start
                mining with <code className="font-mono text-fg"><Vh cmd="worker" /></code>, and the first {vibe(minStake, 0)} becomes its stake.
              </div>
            )}
            <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-rule rounded-xl overflow-hidden border border-rule m-0">
              <div className="bg-ink p-5"><dt className="text-sm text-mute">Balance</dt><dd className="m-0 font-display text-3xl font-bold tabular-nums text-signal">{vibe(acct.balance)}</dd><small className="text-dim text-sm">spendable</small></div>
              <div className="bg-ink p-5"><dt className="text-sm text-mute">Stake</dt><dd className="m-0 font-display text-3xl font-bold tabular-nums">{vibe(acct.stake)}</dd><small className="text-dim text-sm">{acct.stake >= minStake ? "enough to check others' work" : vibe(minStake - acct.stake) + " more to reach the minimum"}</small></div>
              <div className="bg-ink p-5"><dt className="text-sm text-mute">Total</dt><dd className="m-0 font-display text-3xl font-bold tabular-nums">{vibe(acct.balance + acct.stake + acct.unbonding.reduce((s, u) => s + u[0], 0))}</dd><small className="text-dim text-sm">balance, stake and unbonding</small></div>
              <div className="bg-ink p-5">
                <dt className="text-sm text-mute">Reputation</dt>
                <dd className="m-0 font-display text-3xl font-bold tabular-nums">{acct.reputation.toFixed(2)}</dd>
                <div className="mt-2 h-2 bg-white/[0.06]"><i className="block h-full bg-good" style={{ width: repFill * 100 + "%" }} /></div>
                <small className="text-dim text-sm">from {REP_MIN} to {REP_MAX}; new workers start at {REP_START}</small>
              </div>
            </dl>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="grid gap-3 content-start">
                <h2 className="font-semibold text-mute text-[0.95rem]">Details</h2>
                <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 text-[0.95rem] m-0">
                  {acct.bootstrap > 0 && <><dt className="text-mute">Bootstrap stake</dt><dd className="m-0">{vibe(acct.bootstrap)}: it votes, but can't be withdrawn</dd></>}
                  <dt className="text-mute">Transactions sent</dt><dd className="m-0 tabular-nums">{int(acct.nonce)}</dd>
                  <dt className="text-mute">Unbonding</dt>
                  <dd className="m-0">{acct.unbonding.length ? acct.unbonding.map(([amt, h]) => (
                    <span key={h + ":" + amt} className="block">{vibe(amt)}, spendable at block #{int(h)}{net ? (net.height >= h ? " (now)" : ` (in ${int(h - net.height)} blocks)`) : ""}</span>
                  )) : "nothing"}</dd>
                  <dt className="text-mute">Today</dt>
                  <dd className="m-0">{rank >= 0 ? `#${rank + 1} by work, ${flopParts(top[rank].flops).join(" ")} trained` : "not among today's top miners"}</dd>
                </dl>
              </div>
              <div className="grid gap-3 content-start">
                <h2 className="font-semibold text-mute text-[0.95rem]">From your computer</h2>
                <div className="rounded-lg bg-black/50 border border-rule px-4 py-3 grid gap-1 font-mono text-[0.85rem] overflow-x-auto">
                  {[["balance", "this page, in the terminal"], ["stake --amount 10", "lock 10 more VIBE as stake"], ["unstake --amount 5", "release 5 VIBE: spendable after 20 rounds"], ["send --to ADDRESS --amount 1", "send 1 VIBE"]].map(([c, w], i) => (
                    <span key={c} className={"grid " + (i ? "mt-2" : "")}><span className="text-dim"># {w}</span><span className="whitespace-nowrap"><span className="text-signal">&gt;</span> <Vh cmd={c} /></span></span>
                  ))}
                </div>
                <p className="text-sm text-dim">Moving coins needs your wallet's key, so it happens in the command line, never in the browser. See the <Link className={linkCls} to="/jobs">jobs</Link> your work goes into.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
