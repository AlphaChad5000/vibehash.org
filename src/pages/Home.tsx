import { useState } from "react";
import { Link } from "react-router-dom";
import { Btn, DOCS, Eyebrow, H2, Layout, REPO, Vh, linkCls, useOS } from "../components/Layout";
import { Terminal } from "../components/Terminal";
import { JobRows, LiveStats } from "../components/Live";
import { useLive } from "../lib/node";
import { int, SYN } from "../lib/format";

const INSTALL = {
  win: ["irm https://vibehash.org/install.ps1 | iex", "Paste it into PowerShell. It installs everything (Python too, if you need it), asks four quick questions, then offers to start mining."],
  unix: ["curl -fsSL https://vibehash.org/install.sh | sh", "Paste it into Terminal. It installs everything, asks four quick questions, then offers to start mining."]
} as const;

function Install() {
  const { os, setOs } = useOS();
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(INSTALL[os][0]).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }, () => {});
  return (
    <div className="grid gap-2.5 max-w-xl">
      <div className="flex gap-5" role="group" aria-label="Your system">
        {(["win", "unix"] as const).map((o) => (
          <button key={o} type="button" aria-pressed={os === o} onClick={() => setOs(o)}
            className={"text-sm font-semibold py-1 border-b-2 " + (os === o ? "text-fg border-fg" : "text-mute border-transparent")}>
            {o === "win" ? "Windows" : "macOS and Linux"}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 rounded-lg bg-black/50 border border-rule pl-4 pr-1.5 py-1.5">
        <code className="flex-1 min-w-0 overflow-x-auto whitespace-nowrap font-mono text-[0.9rem] text-fg [scrollbar-width:none]"><span className="text-signal">&gt; </span>{INSTALL[os][0]}</code>
        <button type="button" onClick={copy} className="flex-none font-mono text-[0.8rem] font-semibold border border-rule rounded px-3 py-1.5 hover:border-mute">{copied ? "Copied" : "Copy"}</button>
      </div>
      <p className="text-[0.95rem] text-mute">{INSTALL[os][1]}</p>
    </div>
  );
}

function Hero() {
  const { net, error } = useLive();
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] gap-12 lg:gap-14 items-center pt-14 pb-16 lg:pt-20 lg:pb-24">
      <div className="grid gap-6 min-w-0">
        <Link to="/jobs" className="justify-self-start inline-flex items-center gap-2.5 font-mono text-[0.75rem] font-semibold tracking-wider uppercase text-mute hover:text-fg">
          <span className={"w-2 h-2 rounded-full " + (net && !error ? "bg-good pulse-dot" : "bg-dim")} />
          {error ? "Can't reach the testnet right now; trying again" : net ? `Testnet live · block #${int(net.height)} · ${int(net.miners.online)} mining now` : "Connecting to the testnet…"}
        </Link>
        <h1 className="font-display font-extrabold [font-stretch:110%] tracking-tight leading-[1.02] text-[clamp(2.4rem,6vw,4rem)]">Mining that trains <span className="grad-text">real AI models</span></h1>
        <p className="text-xl text-mute max-w-xl">Instead of burning electricity on hashes nobody uses, your computer trains small, checkable pieces of AI models and earns VIBE for every piece that checks out. Have a model to train? Post it as a job and the network trains it.</p>
        <div className="flex flex-wrap gap-3">
          <Btn href="#join">Join the network <span aria-hidden="true">→</span></Btn>
          <Btn to="/submit" kind="ghost">Submit a training job</Btn>
        </div>
        <Install />
      </div>
      <Terminal />
    </div>
  );
}

const EVO: [string, number, number][] = [["sst2", 35.5, 57.5], ["emotion", 35, 49], ["sciq", 54.5, 67], ["arc_challenge", 31.5, 43], ["arc_easy", 47, 58],
  ["mmlu (never trained)", 25, 32.5], ["commonsense_qa", 42, 49], ["winogrande", 43.5, 49], ["openbookqa", 33, 38]];
const MIX: [string, number, number][] = [["sst2", 85.5, 57.5], ["sciq", 74.5, 67], ["arc_easy", 63.5, 58], ["openbookqa", 44, 38], ["commonsense_qa", 54, 49], ["hellaswag", 30.5, 26], ["mmlu (never trained)", 39, 32.5]];
const CLI: [string, string, string, string][] = [
  ["Wallet", "vibehash wallet create", "Make a wallet and show its 24 recovery words once.", "vibehash-wallet-create"],
  ["Mine", "vibehash worker", "Train and check other workers' results, with the live dashboard. --job picks one job.", "vibehash-worker"],
  ["Readiness", "vibehash selftest", "A real training test, your GPUs, the node, the clock, disk space, and what this computer can take.", "vibehash-selftest"],
  ["Node", "vibehash node --genesis G --wallet W --data-dir D", "Run a node: serve the chain to workers, and validate if its wallet is a validator.", "vibehash-node"],
  ["Validator", "vibehash validator join", "Announce your wallet as a validator. It needs 100 VIBE staked.", "vibehash-validator-join"],
  ["Train", "vibehash train fruit.csv", "Train a model on a CSV file: posts it as a job for the network to train.", "vibehash-train"],
  ["Follow a job", "vibehash job watch JOB", "Accuracy climbing round by round, budget left and events, until the budget is spent.", "vibehash-job-watch"],
  ["Evo Hash", "vibehash evo export", "Save an Evo Hash job's model (the tuned Qwen) as a Hugging Face folder.", "vibehash-evo-export"],
  ["Audit", "vibehash chain verify", "Download every block, re-check it from genesis, and replay every round.", "vibehash-chain-verify"]
];
const FAQ: [string, string][] = [
  ["Is VIBE worth money?", "No. This is a test network and test VIBE has no cash value, so don't buy or sell it. It's how the network keeps score of who did the work."],
  ["What does it do to my computer?", "While you mine it uses your graphics card or processor for training. It asks before any big download, keeps model files only where and as long as you allow, and stops with Ctrl+C."],
  ["How is cheating stopped?", "Workers commit to their results before revealing them, and other workers redo randomly chosen pieces. A disagreement narrows to one calculation the network redoes, and whoever was wrong loses stake, so faking work or falsely accusing someone costs more than it gains."],
  ["Who runs the network?", "Today a single validator, operated by the project's founder. The software already supports many validators voting on every block; adding more is the next step."],
  ["Is this connected to DeepSeek or Qwen?", "No. Vibe Hash isn't affiliated with or endorsed by them. Their open models are among the models the network fine-tunes, under their licences."]
];
const sect = "max-w-6xl mx-auto px-4 md:px-8 pt-24 scroll-mt-6";

export default function Home() {
  const { net, status } = useLive();
  const stake = status?.min_stake ? (status.min_stake / SYN).toLocaleString("en-US") : "5";
  const blockTime = net?.miners.block_time ? Math.round(net.miners.block_time) : 40;
  return (
    <Layout hero={<Hero />}>
      <section aria-labelledby="live-title">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-6">
            <h2 id="live-title" className="font-mono text-[0.75rem] font-semibold tracking-[0.08em] uppercase text-mute">The testnet right now</h2>
            <span className="text-sm text-dim">Read from node.vibehash.org every 30 seconds</span>
          </div>
          <LiveStats />
          <div className="mt-6"><JobRows net={net} limit={6} /></div>
          <p className="mt-5 text-[0.95rem] text-mute"><Link className={linkCls} to="/jobs">Every job, with its curve and settings</Link>, and the <a className={linkCls} href="/network/">network reports</a>.</p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-8 pt-20" aria-labelledby="paths-title">
        <Eyebrow>01 · Get started</Eyebrow>
        <H2 id="paths-title">Two ways to use the network</H2>
        <div className="mt-8 grid lg:grid-cols-2 gap-5">
          <article id="join" className="scroll-mt-6 rounded-2xl border border-rule bg-ink2 p-6 md:p-7 grid gap-5 content-start">
            <div>
              <p className="font-mono text-[0.72rem] font-semibold tracking-wider uppercase text-signal">For computers with time to spare</p>
              <h3 className="mt-1 font-display text-2xl font-bold">Join as a miner</h3>
              <p className="mt-2 text-mute">Your GPU, or your processor if you don't have one, trains pieces of the network's jobs and checks other miners' pieces. Work that checks out is paid in test VIBE.</p>
            </div>
            <ol className="grid gap-3 list-none p-0 m-0">
              <li className="grid grid-cols-[2rem_1fr] gap-3"><span className="font-display font-bold text-xl text-dim">1</span><div><b>Install</b><p className="text-mute text-[0.95rem]">Paste the install line above, or <a className={linkCls} href="#download">download the app</a>. It needs Python 3.10 or newer; the Windows installer adds it.</p></div></li>
              <li className="grid grid-cols-[2rem_1fr] gap-3"><span className="font-display font-bold text-xl text-dim">2</span><div><b>Answer four questions</b><p className="text-mute text-[0.95rem]">Network, wallet password (write down the 24 recovery words it shows once), GPU support, and stake: your first <b className="text-fg">{stake}</b> VIBE of pay becomes your stake.</p></div></li>
              <li className="grid grid-cols-[2rem_1fr] gap-3"><span className="font-display font-bold text-xl text-dim">3</span><div><b>Mine</b><p className="text-mute text-[0.95rem]"><code className="font-mono text-[0.85em] text-fg"><Vh cmd="worker" /></code> shows the dashboard above. <kbd className="font-mono text-[0.85em]">Ctrl</kbd>+<kbd className="font-mono text-[0.85em]">C</kbd> stops it. Follow your earnings on the <Link className={linkCls} to="/wallet">wallet page</Link>.</p></div></li>
            </ol>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-[0.95rem] border-t border-rule pt-4 m-0">
              <dt className="text-mute">Any computer</dt><dd className="m-0">earns on the small jobs, GPU or not</dd>
              <dt className="text-mute">DeepSeek job</dt><dd className="m-0">NVIDIA 8 GB+ (RTX 20-series or newer), 16 GB RAM, ~40 GB SSD</dd>
              <dt className="text-mute">Pay</dt><dd className="m-0">by work done; an old laptop and a gaming rig earn the same per unit</dd>
            </dl>
            <div className="flex flex-wrap gap-3"><Btn href="/guide/">Read the miner's guide <span aria-hidden="true">→</span></Btn></div>
          </article>

          <article id="submit" className="scroll-mt-6 rounded-2xl border border-rule bg-ink2 p-6 md:p-7 grid gap-5 content-start">
            <div>
              <p className="font-mono text-[0.72rem] font-semibold tracking-wider uppercase text-violet">For people with a model to train</p>
              <h3 className="mt-1 font-display text-2xl font-bold">Submit a training job</h3>
              <p className="mt-2 text-mute">Post a job with a budget. Miners train it round by round, every piece is checked, and you download the result. On the testnet the budget is test VIBE.</p>
            </div>
            <div className="rounded-lg bg-black/50 border border-rule px-4 py-3 grid gap-1 overflow-x-auto font-mono text-[0.85rem]">
              <span className="text-dim"># try it: sample data, posted as a job</span>
              {["example", "train fruit.csv", "job watch JOB", "job download JOB"].map((c) => (
                <span key={c} className="whitespace-nowrap"><span className="text-signal">&gt;</span> <Vh cmd={c} /></span>
              ))}
            </div>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-[0.95rem] border-t border-rule pt-4 m-0">
              <dt className="text-mute">Your CSV</dt><dd className="m-0"><code className="font-mono text-[0.85em]">train</code> builds the model and the job for you</dd>
              <dt className="text-mute">Open models</dt><dd className="m-0">fine-tune one like Qwen on your text; you get the LoRA adapter back</dd>
              <dt className="text-mute">Changed your mind</dt><dd className="m-0"><code className="font-mono text-[0.85em]">cancel-job</code> returns the unspent budget</dd>
            </dl>
            <div className="flex flex-wrap gap-3"><Btn to="/submit">Build your job <span aria-hidden="true">→</span></Btn></div>
          </article>
        </div>
      </section>

      <section id="how" className={sect} aria-labelledby="how-title">
        <Eyebrow>02 · How it works</Eyebrow>
        <H2 id="how-title">One round, about every {blockTime} seconds</H2>
        <p className="mt-3 text-mute max-w-3xl">Each block seals one round. A round has four phases, the same four the worker's dashboard shows. Jobs with budget left take turns, one round each.</p>
        <ol className="mt-8 grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-rule rounded-2xl overflow-hidden border border-rule list-none p-0">
          {([
            ["REGISTER", "rgb(120 170 255)", "Sign up for the round", "Workers register for the round, and the node hands each a few units: training steps of the job whose turn it is."],
            ["COMPUTE", "rgb(255 180 60)", "Train and commit", "Each worker trains its units on its GPU or CPU, uploads the checkpoints, and commits to its results before anyone can see them."],
            ["REVEAL", "rgb(200 125 255)", "Show the work", "Workers reveal what they committed to, and the round's random beacon picks which pieces get checked."],
            ["VERIFY", "rgb(90 220 180)", "Check, then pay", "Other workers redo the chosen pieces, which must match to within 1%. A disagreement narrows to one calculation the network redoes, and whoever was wrong is slashed."]
          ] as const).map(([k, c, h, p]) => (
            <li key={k} className="bg-ink p-6 grid gap-2 content-start">
              <span className="font-mono text-[0.75rem] font-bold tracking-wider" style={{ color: c }}>{k}</span>
              <h3 className="font-display font-bold text-lg">{h}</h3>
              <p className="text-mute text-[0.95rem]">{p}</p>
            </li>
          ))}
        </ol>
        <dl className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[0.95rem] m-0">
          <div className="border-t border-rule pt-3"><dt className="text-mute">Minimum stake</dt><dd className="m-0 font-semibold">{stake} VIBE, earned from your first pay</dd></div>
          <div className="border-t border-rule pt-3"><dt className="text-mute">Unstaking</dt><dd className="m-0 font-semibold">spendable after 20 rounds, slashable until then</dd></div>
          <div className="border-t border-rule pt-3"><dt className="text-mute">Validators</dt><dd className="m-0 font-semibold">{net?.validators ?? 1} today; joining takes 100 VIBE staked</dd></div>
          <div className="border-t border-rule pt-3"><dt className="text-mute">Every block</dt><dd className="m-0 font-semibold">re-checkable from genesis with <code className="font-mono text-[0.85em]">chain verify</code></dd></div>
        </dl>
      </section>

      <section id="research" className={sect} aria-labelledby="research-title">
        <Eyebrow>03 · Research</Eyebrow>
        <H2 id="research-title">Evo Hash: training a language model by evolution, on the chain</H2>
        <p className="mt-3 text-mute max-w-3xl">Evo Hash trains with evolution strategies instead of gradients: each round, miners score twin pairs of small random changes to the model, and the chain keeps only the seeds and the scores, a few hundred bytes a generation. Anyone can rebuild the model from the chain. Base model: <span className="text-fg">Qwen2.5-0.5B-Instruct</span>. Every score below is 200 held-out questions per set.</p>
        <div className="mt-8 grid md:grid-cols-3 gap-px bg-rule rounded-2xl overflow-hidden border border-rule">
          <div className="bg-ink p-6"><p className="font-display text-5xl font-extrabold grad-text tabular-nums">+12.5 pts</p><p className="mt-2 font-semibold">MMLU, never trained on: 25% → 37.5%</p><p className="mt-1 text-sm text-mute">The peak, at the end of the first cycle of a 426-round testnet run (0.5.17). By the end of the second cycle it had given back to 32.5%: the problem 0.5.18's task mixing fixes.</p></div>
          <div className="bg-ink p-6"><p className="font-display text-5xl font-extrabold text-fg tabular-nums">2.1%</p><p className="mt-2 font-semibold">Weight drift after 68 rounds</p><p className="mt-1 text-sm text-mute">How far the weights moved from the original, held there by an anchor so long runs don't drift the model to pieces. 0.5.18 measured 2.0% at 68 rounds and 2.3% at 102.</p></div>
          <div className="bg-ink p-6"><p className="font-display text-5xl font-extrabold text-fg tabular-nums">+22 pts</p><p className="mt-2 font-semibold">SST-2: 35.5% → 57.5%</p><p className="mt-1 text-sm text-mute">The largest single-set gain at 68 rounds, 4 on each of the 17 curated tasks.</p></div>
        </div>
        <div className="mt-8 grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-8">
          <div className="min-w-0">
            <h3 className="font-semibold text-mute text-[0.95rem]">68 rounds, original → Evo Hash (0.5.17)</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[0.95rem] tabular-nums border-collapse">
                <thead><tr className="text-mute text-sm"><th className="text-left font-semibold pb-2 border-b border-rule">Held-out set</th><th className="text-right font-semibold pb-2 border-b border-rule">Before</th><th className="text-right font-semibold pb-2 border-b border-rule">After</th><th className="text-right font-semibold pb-2 border-b border-rule pl-3">Change</th><th className="pb-2 border-b border-rule pl-4 w-[34%]"><span className="sr-only">Bar</span></th></tr></thead>
                <tbody>
                  {EVO.map(([k, a, b]) => (
                    <tr key={k}>
                      <td className="py-1.5 border-b border-rule font-mono text-[0.85rem]">{k}</td>
                      <td className="text-right py-1.5 border-b border-rule text-mute">{a}%</td>
                      <td className="text-right py-1.5 border-b border-rule font-semibold">{b}%</td>
                      <td className="text-right py-1.5 border-b border-rule pl-3 text-good font-semibold">+{b - a}</td>
                      <td className="py-1.5 border-b border-rule pl-4"><div className="relative h-2 bg-white/[0.06]"><i className="absolute inset-y-0 left-0 bg-white/20" style={{ width: a + "%" }} /><i className="absolute inset-y-0 grad-line" style={{ left: a + "%", width: b - a + "%" }} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-dim">The four math sets went 1.5 to 3.5 points down, each within chance but all the same way: math needs room to reason, and answers are capped at 64 tokens.</p>
          </div>
          <div className="grid gap-5 content-start">
            <div className="rounded-xl border border-rule p-5">
              <h3 className="font-display font-bold">What the gains are, honestly</h3>
              <p className="mt-2 text-mute text-[0.95rem]">Scored the way lm-evaluation-harness scores (which letter the model finds likeliest), the same sets moved within ±3 points (MMLU 43% → 44.5%). The gain is in <em>saying</em> what it knows, not in knowing more.</p>
            </div>
            <div className="rounded-xl border border-rule p-5">
              <h3 className="font-display font-bold">0.5.18: mix the tasks every round</h3>
              <p className="mt-2 text-mute text-[0.95rem]">One task at a time, a task trained early in a cycle had lost about 95% of its gain by its next turn. Mixing all 17 into every round, at 68 rounds:</p>
              <dl className="mt-3 grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-[0.92rem] tabular-nums m-0">
                <dt className="text-dim text-sm">set</dt><dd className="m-0 text-dim text-sm text-right">mixed</dd><dd className="m-0 text-dim text-sm text-right">one at a time</dd>
                {MIX.map(([k, a, b]) => [
                  <dt key={k} className="font-mono text-[0.85rem]">{k}</dt>,
                  <dd key={k + "a"} className="m-0 text-right font-semibold text-good">{a}%</dd>,
                  <dd key={k + "b"} className="m-0 text-right text-mute">{b}%</dd>
                ])}
              </dl>
              <p className="mt-3 text-sm text-dim">Still below the original on boolq (−5), asdiv (−4) and aqua_rat (−3).</p>
            </div>
            <a className={linkCls} href={REPO + "/blob/main/docs/evo-hash.pdf"}>Read the Evo Hash paper (PDF)</a>
          </div>
        </div>
      </section>

      <section id="cli" className={sect} aria-labelledby="cli-title">
        <Eyebrow>04 · Command line</Eyebrow>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h2 id="cli-title" className="font-display text-[2rem] font-bold [font-stretch:108%] tracking-tight leading-tight">CLI quick reference</h2>
          <a className={linkCls} href={DOCS}>Every command in docs/CLI.md →</a>
        </div>
        <p className="mt-3 text-mute max-w-3xl"><code className="font-mono text-[0.9em] text-fg">vibehash</code> and <code className="font-mono text-[0.9em] text-fg">python -m vibehash</code> are the same program. With no arguments it opens a menu. <code className="font-mono text-[0.9em]">--node</code> and <code className="font-mono text-[0.9em]">--wallet</code> default to what <code className="font-mono text-[0.9em]">setup</code> saved.</p>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CLI.map(([k, cmd, what, anchor]) => (
            <a key={anchor} href={DOCS + "#" + anchor} className="group rounded-xl border border-rule bg-ink2 p-5 grid gap-2 content-start hover:border-white/30">
              <span className="font-mono text-[0.7rem] font-semibold tracking-wider uppercase text-mute">{k}</span>
              <code className="font-mono text-[0.88rem] text-fg break-words"><span className="text-signal">&gt;</span> {cmd}</code>
              <span className="text-[0.92rem] text-mute">{what}</span>
              <span className="text-sm text-dim group-hover:text-fg">docs/CLI.md →</span>
            </a>
          ))}
        </div>
      </section>

      <section id="download" className={sect} aria-labelledby="dl-title">
        <Eyebrow>05 · Download</Eyebrow>
        <H2 id="dl-title">Get the worker</H2>
        <p className="mt-3 text-mute max-w-3xl">The latest release is <a className={linkCls} href={REPO + "/releases/latest"}>v0.5.18</a>. The app sets everything up, keeps the worker running and can start at login. The install lines install the command line instead.</p>
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          {([["Windows 10 / 11", "VibeHash.exe", "The app: setup, mining and start at login"], ["macOS", "VibeHash-macos", "Run chmod +x on it first"], ["Linux", "VibeHash-linux", "Run chmod +x on it first"]] as const).map(([os, file, note]) => (
            <a key={file} href={REPO + "/releases/latest/download/" + file} className="group rounded-2xl border border-rule bg-ink2 p-6 grid gap-2 hover:border-signal/60">
              <span className="font-mono text-[0.72rem] font-semibold tracking-wider uppercase text-mute">{os}</span>
              <span className="font-display text-xl font-bold">{file}</span>
              <span className="text-sm text-mute">{note}</span>
              <span className="mt-2 text-signal font-semibold group-hover:underline">Download ↓</span>
            </a>
          ))}
        </div>
        <div className="mt-4 grid md:grid-cols-2 gap-4">
          {([["Windows, PowerShell", "install.ps1", INSTALL.win[0]], ["macOS and Linux, Terminal", "install.sh", INSTALL.unix[0]]] as const).map(([k, f, line]) => (
            <div key={f} className="rounded-2xl border border-rule p-5 grid gap-2 min-w-0">
              <span className="text-sm text-mute">{k}: <a className={linkCls} href={"/" + f}>{f}</a></span>
              <code className="font-mono text-[0.88rem] bg-black/50 border border-rule rounded-lg px-3 py-2 overflow-x-auto whitespace-nowrap">{line}</code>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-dim">Windows SmartScreen or macOS Gatekeeper may warn before the first run. Run testnet software on a machine you're comfortable testing with.</p>
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-8 pt-24" aria-labelledby="faq-title">
        <Eyebrow>06 · Questions</Eyebrow>
        <H2 id="faq-title">Questions people ask</H2>
        <div className="mt-6 max-w-4xl border-t border-rule">
          {FAQ.map(([q, a]) => (
            <details key={q} className="border-b border-rule py-4">
              <summary className="cursor-pointer font-bold flex justify-between gap-3">{q}<span className="plus text-mute transition-transform">+</span></summary>
              <p className="mt-2 text-mute">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </Layout>
  );
}
