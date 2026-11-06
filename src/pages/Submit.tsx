import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Layout, PageHead, linkCls, useOS, DOCS } from "../components/Layout";
import { useLive } from "../lib/node";
import { int, SYN } from "../lib/format";

// A job is posted from the command line, which signs it with your wallet's key: the node takes transactions only from
// there (it answers browsers' GETs, not their POSTs). This page checks your data in the browser, without uploading
// it, and writes the exact `vibehash train` command, with the same rules the CLI applies (tasks.py, cli.py).

const JOB_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const idFrom = (name: string, fallback: string) =>
  (name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[-._]+|[-._]+$/g, "").slice(0, 40) || fallback) +
  "-" + Math.floor(Math.random() * 65536).toString(16).padStart(4, "0");
const MAX_READ = 20 * 1024 * 1024; // read at most this much of a file to check it
// vibehash/catalog.py: the names `train --base` takes, smallest first (the small ones a team of home GPUs can train)
const BASES: [string, string][] = [["qwen3-0.6b", "Qwen3 0.6B"], ["llama-3.2-1b", "Llama 3.2 1B Instruct"], ["smollm3-3b", "SmolLM3 3B"],
  ["phi-4-mini", "Phi-4 mini"], ["qwen3-4b", "Qwen3 4B"], ["gemma-4-e2b", "Gemma 4 E2B"], ["mistral-7b", "Mistral 7B Instruct"],
  ["llama-3.1-8b", "Llama 3.1 8B Instruct"], ["qwen3-8b", "Qwen3 8B"]];

interface CsvInfo { name: string; columns: string[]; rows: number; numeric: boolean[]; classes: Record<string, number>; partial: boolean }
interface ChatInfo { name: string; lines: number; chats: number; texts: number; bad: number; firstBad: number | null; partial: boolean }

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

async function readCsv(f: File): Promise<CsvInfo> {
  const text = await f.slice(0, MAX_READ).text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (f.size > MAX_READ) lines.pop(); // a cut line
  const columns = splitCsv(lines[0] ?? "");
  const numeric = columns.map(() => true), rows = lines.slice(1).map(splitCsv);
  for (const r of rows) r.forEach((v, i) => { if (i < numeric.length && (v === "" || !isFinite(Number(v)))) numeric[i] = false; });
  return { name: f.name, columns, rows: rows.length, numeric, classes: {}, partial: f.size > MAX_READ, ...{ _rows: rows } } as CsvInfo & { _rows: string[][] };
}

async function readChats(f: File): Promise<ChatInfo> {
  const text = await f.slice(0, MAX_READ).text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (f.size > MAX_READ) lines.pop();
  let chats = 0, texts = 0, bad = 0, firstBad: number | null = null;
  lines.forEach((l, i) => {
    try {
      const o = JSON.parse(l);
      if (Array.isArray(o?.messages) && o.messages.every((m: { role?: unknown; content?: unknown }) => typeof m?.role === "string" && typeof m?.content === "string")) chats++;
      else if (typeof o?.text === "string") texts++;
      else throw new Error();
    } catch { bad++; if (firstBad == null) firstBad = i + 1; }
  });
  return { name: f.name, lines: lines.length, chats, texts, bad, firstBad, partial: f.size > MAX_READ };
}

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="text-sm text-dim">{hint}</span>}
    </label>
  );
}
const inputCls = "rounded-lg bg-black/50 border border-rule px-3 py-2.5 text-fg font-mono text-[0.9rem] placeholder:text-dim focus:border-mute outline-none w-full";

function Drop({ accept, onFile, children }: { accept: string; onFile: (f: File) => void; children: ReactNode }) {
  const [over, setOver] = useState(false);
  return (
    <label onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      className={"grid place-items-center text-center gap-1 rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer transition-colors " + (over ? "border-signal bg-signal/5" : "border-rule hover:border-mute")}>
      <input type="file" accept={accept} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      {children}
    </label>
  );
}

export default function Submit() {
  const { os } = useOS();
  const { status } = useLive();
  const [kind, setKind] = useState<"csv" | "finetune">("csv");
  const [csv, setCsv] = useState<(CsvInfo & { _rows?: string[][] }) | null>(null);
  const [chats, setChats] = useState<ChatInfo | null>(null);
  const [readErr, setReadErr] = useState("");
  const [label, setLabel] = useState("");
  const [hidden, setHidden] = useState("128,128");
  const [base, setBase] = useState("qwen3-0.6b");
  const [rank, setRank] = useState("16");
  const [maxLen, setMaxLen] = useState("512");
  const [units, setUnits] = useState("8");
  const [budget, setBudget] = useState("100");
  const [fee, setFee] = useState("10");
  const [id, setId] = useState("");
  const [copied, setCopied] = useState(false);

  const file = kind === "csv" ? csv?.name : chats?.name;
  const labelCol = label || csv?.columns[csv.columns.length - 1] || "";
  const classes = useMemo(() => {
    if (!csv?._rows || !labelCol) return 0;
    const i = csv.columns.indexOf(labelCol), seen = new Set<string>();
    for (const r of csv._rows) seen.add(r[i]);
    return seen.size;
  }, [csv, labelCol]);

  const problems: string[] = [];
  if (!file) problems.push(kind === "csv" ? "Choose a CSV file." : "Choose a JSON-lines file of chats or text.");
  if (kind === "csv" && csv) {
    if (csv.columns.length < 2) problems.push("The CSV needs a header row and at least two columns.");
    if (csv.rows < 10) problems.push("The CSV has fewer than 10 rows.");
    const nonNum = csv.columns.filter((c, i) => c !== labelCol && !csv.numeric[i]);
    if (nonNum.length) problems.push(`Input columns must be numbers: ${nonNum.slice(0, 3).join(", ")}${nonNum.length > 3 ? "…" : ""} ${nonNum.length === 1 ? "isn't" : "aren't"}.`);
    if (classes > 0 && classes < 2) problems.push("The column to predict has only one value.");
    if (!/^\d+(,\d+)*$/.test(hidden)) problems.push("Hidden layers are widths separated by commas, like 128,128.");
  }
  if (kind === "finetune" && chats) {
    if (!chats.chats && !chats.texts) problems.push("No line is a chat ({\"messages\": [...]}) or a text ({\"text\": ...}).");
    if (chats.bad) problems.push(`${int(chats.bad)} line${chats.bad === 1 ? " isn't" : "s aren't"} a chat or a text (the first is line ${chats.firstBad}).`);
    if (!base.trim()) problems.push("Name the model to fine-tune.");
    if (!(Number(maxLen) >= 16 && Number(maxLen) <= 2048)) problems.push("The longest sequence must be at most 2048 tokens.");
  }
  if (id && !JOB_ID.test(id)) problems.push("A job name is 1 to 64 of a-z, 0-9, dot, dash and underscore, starting with a letter or digit.");
  const b = Number(budget), fe = Number(fee);
  if (!(b > 0)) problems.push("The budget must be more than 0.");
  if (!(fe > 0)) problems.push("The pay a round must be more than 0.");
  else if (b > 0 && fe > b) problems.push("The pay a round is more than the whole budget.");

  const py = os === "win" ? "python" : "python3";
  const q = (s: string) => (/^[\w./:@-]+$/.test(s) ? s : `"${s.replace(/"/g, '\\"')}"`);
  const args = [py, "-m vibehash train", q(file || (kind === "csv" ? "data.csv" : "chats.jsonl"))];
  if (kind === "csv") {
    if (label && csv && label !== csv.columns[csv.columns.length - 1]) args.push("--label", q(label));
    if (hidden !== "128,128") args.push("--hidden", hidden);
  } else {
    args.push("--base", q(base.trim()));
    if (rank !== "16") args.push("--rank", rank);
    if (maxLen !== "512") args.push("--max-len", maxLen);
    if (units !== "8") args.push("--units", units);
  }
  if (budget !== "100") args.push("--budget", budget);
  if (fee !== "10") args.push("--fee", fee);
  if (id) args.push("--id", id);
  const command = args.join(" ");
  const rounds = b > 0 && fe > 0 ? Math.floor(b / fe) : 0;

  const pick = async (f: File) => {
    setReadErr(""); setId("");
    try {
      if (kind === "csv") { const c = await readCsv(f); setCsv(c); setLabel(""); }
      else setChats(await readChats(f));
    } catch { setReadErr("Couldn't read that file."); }
  };
  const copy = () => navigator.clipboard?.writeText(command).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }, () => {});

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <PageHead eyebrow="Submit a job" title="Train a model on the network">
          Describe the job and check your data here; nothing is uploaded. You'll get one command to run: it signs the job with your wallet, pays the budget in and follows it live. On the testnet the budget is test VIBE, paid out only for work that passes its checks.
        </PageHead>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-10 items-start">
          <div className="grid gap-6">
            <div className="grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Kind of job">
              {([["csv", "Your data (CSV)", "A model that predicts one column from the others. Trains on any computer."], ["finetune", "Fine-tune an open model", "Teach a model like Qwen your chats or text. You get a LoRA adapter back."]] as const).map(([k, t, d]) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => { setKind(k); setReadErr(""); setFee("10"); }}
                  className={"text-left rounded-xl border p-4 grid gap-1 " + (kind === k ? "border-signal bg-signal/5" : "border-rule hover:border-mute")}>
                  <b>{t}</b><span className="text-sm text-mute">{d}</span>
                </button>
              ))}
            </div>

            <Drop accept={kind === "csv" ? ".csv,text/csv" : ".jsonl,.json,.txt"} onFile={pick}>
              <b>{file ? file : kind === "csv" ? "Drop a CSV here, or choose one" : "Drop a JSON-lines file here, or choose one"}</b>
              <span className="text-sm text-mute">{kind === "csv" ? "A header row, numeric input columns, and the column to predict." : 'One chat per line, {"messages": [{"role": …, "content": …}]}, or {"text": …}.'} Checked in your browser.</span>
            </Drop>
            {readErr && <p className="text-bad">{readErr}</p>}

            {kind === "csv" && csv && (
              <div className="grid gap-4">
                <p className="text-sm text-mute">{int(csv.rows)} rows{csv.partial ? " in the first 20 MB" : ""} · {csv.columns.length} columns{classes ? ` · ${int(classes)} values to predict` : ""}</p>
                <Field label="Column to predict" hint="The last column unless you pick another.">
                  <select value={labelCol} onChange={(e) => setLabel(e.target.value)} className={inputCls}>
                    {csv.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Hidden layers" hint="Widths, separated by commas. Bigger learns more and costs more a round.">
                  <input value={hidden} onChange={(e) => setHidden(e.target.value.replace(/\s/g, ""))} className={inputCls} />
                </Field>
              </div>
            )}
            {kind === "finetune" && (
              <div className="grid gap-4">
                {chats && <p className="text-sm text-mute">{int(chats.chats)} chats · {int(chats.texts)} texts{chats.partial ? " in the first 20 MB" : ""}</p>}
                <Field label="Model to fine-tune" hint={<>A name from <code className="font-mono">vibehash models</code>, org/name, or a huggingface.co address. Without a data file, <code className="font-mono">train --base</code> shows what the model would take.</>}>
                  <input value={base} onChange={(e) => setBase(e.target.value)} list="bases" className={inputCls} />
                  <datalist id="bases">{BASES.map(([n, t]) => <option key={n} value={n}>{t}</option>)}</datalist>
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="LoRA rank"><input value={rank} onChange={(e) => setRank(e.target.value.replace(/\D/g, ""))} className={inputCls} inputMode="numeric" /></Field>
                  <Field label="Longest sequence"><input value={maxLen} onChange={(e) => setMaxLen(e.target.value.replace(/\D/g, ""))} className={inputCls} inputMode="numeric" /></Field>
                  <Field label="Units a round"><input value={units} onChange={(e) => setUnits(e.target.value.replace(/\D/g, ""))} className={inputCls} inputMode="numeric" /></Field>
                </div>
                <p className="text-sm text-dim -mt-2">Longer chats are cut to the longest sequence (at most 2048 tokens: longer ones make disputes too big to settle from home).</p>
              </div>
            )}

            <div className="grid sm:grid-cols-3 gap-3 border-t border-rule pt-6">
              <Field label="Budget (VIBE)" hint="Spent only on work that checks out"><input value={budget} onChange={(e) => setBudget(e.target.value)} className={inputCls} inputMode="decimal" /></Field>
              <Field label="Pay a round (VIBE)" hint="Split among the round's workers"><input value={fee} onChange={(e) => setFee(e.target.value)} className={inputCls} inputMode="decimal" /></Field>
              <Field label="Job name" hint="Optional">
                <input value={id} onChange={(e) => setId(e.target.value.toLowerCase())} placeholder={file ? idFrom(file, kind === "csv" ? "model" : "chats").replace(/-[0-9a-f]{4}$/, "-xxxx") : "from the file name"} className={inputCls} />
              </Field>
            </div>
          </div>

          <aside className="lg:sticky lg:top-6 grid gap-5">
            <div className="glass">
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.07] font-mono text-[0.78rem] font-semibold text-mute">
                <span className="lights inline-flex gap-[7px]" aria-hidden="true"><i /><i /><i /></span><span>{os === "win" ? "PowerShell" : "Terminal"}</span>
              </div>
              <div className="p-4 grid gap-3">
                <code className="font-mono text-[0.88rem] text-fg break-all"><span className="text-signal">&gt; </span>{command}</code>
                <button type="button" onClick={copy} disabled={problems.length > 0}
                  className="justify-self-start rounded-lg bg-signal text-[#1d1406] font-bold px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110">
                  {copied ? "Copied" : "Copy command"}
                </button>
              </div>
            </div>
            {problems.length > 0 ? (
              <ul className="grid gap-1 text-[0.95rem] text-signal list-none p-0 m-0">{problems.map((p) => <li key={p}>• {p}</li>)}</ul>
            ) : (
              <p className="text-good text-[0.95rem]">Ready. Run it from the folder your file is in.</p>
            )}
            <dl className="grid grid-cols-[max-content_1fr] gap-x-5 gap-y-1.5 text-[0.95rem] m-0">
              <dt className="text-mute">Rounds it pays for</dt><dd className="m-0 tabular-nums">{rounds ? "up to " + int(rounds) : "–"}</dd>
              <dt className="text-mute">Time, at full speed</dt><dd className="m-0">{rounds ? "about " + Math.max(1, Math.round((rounds * 40) / 60)) + " min, if it gets every turn" : "–"}</dd>
              <dt className="text-mute">Fee to post</dt><dd className="m-0">{status ? (status.min_fee / SYN).toLocaleString("en-US", { maximumFractionDigits: 8 }) + " VIBE" : "the node's minimum"}</dd>
              <dt className="text-mute">Needs</dt><dd className="m-0">a wallet holding the budget (<Link className={linkCls} to="/wallet">check yours</Link>)</dd>
            </dl>
            <div className="text-sm text-mute grid gap-2 border-t border-rule pt-4">
              <p><b className="text-fg">What happens:</b> the command {kind === "csv" ? "builds the model and the job" : "checks the model's weights and your data, asks before posting"}, uploads the data, posts the job with the budget, and opens a live dashboard as miners train it. Jobs with budget left take turns, one round each.</p>
              <p>Change your mind? <code className="font-mono">vibehash cancel-job</code> returns what's left. Then <code className="font-mono">vibehash job download</code> fetches the model. <a className={linkCls} href={DOCS + "#vibehash-train"}>Every option of train</a>.</p>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
