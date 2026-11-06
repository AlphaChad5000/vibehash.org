/* The worker's dashboard, ported from vibehash/minerui.py and termui.py: the banner, the mine (mine.ts), the round and
   phase bar and the lines under it. It replays one rig's rounds (register, compute, reveal, verify, paid), with the
   round and block numbers taken from the live node. It pauses off screen; reduced motion keeps it still. */
import type { Network } from "./node";
import { MineScene } from "./mine";

type Seg = [string, string | null] | { bar: number; fill: number; cls: string };
const BANNER = ["█ █ █ █▄▄ █▀▀   █ █ ▄▀█ █▀ █ █", "▀▄▀ █ █▄█ ██▄   █▀█ █▀█ ▄█ █▀█"];
const PH: [string, number][] = [["register", 4], ["compute", 16], ["reveal", 5], ["verify", 7]];

const int = (n: number) => Math.round(n).toLocaleString("en-US");
const vibe = (v: number, sign = false) => (sign && v >= 0 ? "+" : "") + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " VIBE";
const nn = (c: number, noun: string) => c.toLocaleString("en-US") + " " + noun + (c === 1 ? "" : "s");
function si(n: number, unit: string): string {
  for (const [s, p] of [[1e15, "P"], [1e12, "T"], [1e9, "G"], [1e6, "M"], [1e3, "k"]] as [number, string][]) if (n >= s) return (n / s).toFixed(2) + " " + p + unit;
  return n.toFixed(0) + " " + unit;
}
const escText = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);

/** The banner as pixels: each line of half-blocks is two rows, coloured gold to violet left to right. */
export function drawBanner(svg: SVGSVGElement, id = "tgrad") {
  const w = BANNER[0].length, out: string[] = [];
  svg.setAttribute("viewBox", `0 0 ${w} 4`);
  out.push(`<defs><linearGradient id="${id}" x1="0" x2="${w}" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffcd3c"/><stop offset=".35" stop-color="#ff9646"/><stop offset=".68" stop-color="#ff5f96"/><stop offset="1" stop-color="#b46eff"/></linearGradient></defs><g fill="url(#${id})">`);
  BANNER.forEach((line, li) => {
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === "█" || ch === "▀") out.push(`<rect x="${j}" y="${li * 2}" width="1.02" height="1.02"/>`);
      if (ch === "█" || ch === "▄") out.push(`<rect x="${j}" y="${li * 2 + 1}" width="1.02" height="1.02"/>`);
    }
  });
  svg.innerHTML = out.join("") + "</g>";
}

export interface TerminalHandle { sync(net: Network): void; stop(): void }

/** Start the dashboard inside `root`, which holds the elements marked data-t="…" (see components/Terminal.tsx). */
export function startTerminal(root: HTMLElement): TerminalHandle {
  const q = <T extends Element>(k: string) => root.querySelector(`[data-t="${k}"]`) as T;
  const screen = q<HTMLElement>("screen"), boot = q<HTMLElement>("boot"), dash = q<HTMLElement>("dash");
  const linesEl = q<HTMLElement>("lines"), probe = q<HTMLElement>("probe");
  const still = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const mine = new MineScene(q<HTMLCanvasElement>("mine"), { still });
  drawBanner(q<SVGSVGElement>("banner"));
  let hex = "";
  for (let i = 0; i < 36; i++) hex += "0123456789abcdef"[(Math.random() * 16) | 0];
  const ADDR = "vibe1" + hex;
  q<HTMLElement>("addr").textContent = ADDR;

  // ---- the replayed rig ----
  const S = {
    clock: 0, round: 213, height: 212, live: null as number | null, ph: 0, t0: -1,
    assigned: 0, trained: 0, committed: 0, checked: 0, units: 75, checks: 35, rounds: 13, flops: 5.65e12,
    wallet: 31.58, shownWallet: 31.58, stake: 5, earned: 36.58, shownEarned: 36.58, rep: 0.91,
    feed: [] as [Date, string, string][], gen: 40, reward: 51.2, jobs: ["fruit-demo", "evo2-c1-mix"]
  };
  // Jobs take turns, one round each: this rig alternates a small classifier and an Evo Hash job.
  const job = (): [string, string] => (S.round % 2 ? ["evo2-c1-mix", "Evo Hash · Qwen2.5-0.5B"] : ["fruit-demo", "17,925 float32 weights"]);
  const note = (text: string, cls = "c-text") => { S.feed.push([new Date(), text, cls]); if (S.feed.length > 8) S.feed.shift(); };
  const now0 = Date.now();
  S.feed.push([new Date(now0 - 21000), "round 211: computed 6 units, committed 6", "c-text"]);
  S.feed.push([new Date(now0 - 6000), "paid +3.18 VIBE in block 211", "c-gold"]);
  S.feed.push([new Date(now0 - 3000), "round 212: registered", "c-text"]);

  const phase = () => PH[S.ph][0];
  const elapsed = () => S.clock - S.t0;
  const busy = () => phase() !== "register";
  const training = () => phase() === "compute" && S.trained < S.assigned;

  function advance(dt: number) {
    S.clock += dt;
    const p = phase(), e = elapsed();
    if (p === "compute") {
      const tr = Math.max(0, Math.min(6, Math.floor((e - 0.4) / 2.35))), cm = Math.max(0, Math.min(6, Math.floor((e - 1.1) / 2.35)));
      if (tr > S.trained) { S.units += tr - S.trained; S.flops += (tr - S.trained) * 0.0753e12; S.trained = tr; }
      S.committed = cm;
    } else if (p === "verify") {
      const ck = Math.max(0, Math.min(2, Math.floor((e - 1) / 2.5)));
      if (ck > S.checked) { S.checks += ck - S.checked; S.checked = ck; }
    }
    if (e >= PH[S.ph][1]) endPhase();
    const k = Math.min(1, dt * 2.5);
    S.shownWallet += (S.wallet - S.shownWallet) * k;
    S.shownEarned += (S.earned - S.shownEarned) * k;
  }
  function endPhase() {
    const p = phase();
    if (p === "register") { note("round " + S.round + ": registered"); S.assigned = 6; }
    if (p === "compute") note("round " + S.round + ": computed 6 units, committed 6");
    if (p === "verify") {
      S.height = S.round;
      if (job()[0] === "evo2-c1-mix") {
        const d = 0.1 + Math.random() * 0.6;
        S.reward += d; S.gen++;
        note(`evo2-c1-mix generation ${S.gen}: mean reward ${S.reward.toFixed(1)}% (+${d.toFixed(1)} pts)`, "c-green");
      } else note("round " + S.round + ": checked 2 results, both agree");
      const pay = Math.round((2.7 + Math.random() * 0.9) * 100) / 100;
      S.wallet += pay; S.earned += pay; S.rounds++; S.rep = Math.min(0.99, S.rep + 0.004);
      mine.celebrate(vibe(pay, true));
      note("paid " + vibe(pay, true) + " in block " + S.height, "c-gold");
      S.round++;
      if (S.live && S.live + 1 > S.round) { S.round = S.live + 1; S.height = S.live; }
      S.assigned = S.trained = S.committed = S.checked = 0;
    }
    S.ph = (S.ph + 1) % PH.length;
    S.t0 = S.clock;
  }

  // ---- layout: font size, cell size, columns ----
  let cols = 70, lastHTML = "";
  function layout() {
    const cs = getComputedStyle(screen), avail = screen.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const fs = Math.max(9.5, Math.min(13.5, avail / (48 * 0.6)));
    screen.style.fontSize = fs + "px";
    const cw = probe.getBoundingClientRect().width / 20 || fs * 0.6;
    cols = Math.max(40, Math.floor(avail / cw));
    mine.resize(cols, cw, fs * 1.6, fs);
    lastHTML = "";
  }

  // ---- the lines under the mine (minerui.frame) ----
  const len = (segs: Seg[]) => segs.reduce((n, s) => n + (Array.isArray(s) ? s[0].length : s.bar), 0);
  const fit = (w: number, ...opts: Seg[][]) => opts.find((o) => len(o) <= w) ?? opts[opts.length - 1];
  const html = (segs: Seg[]) => segs.map((s) => {
    if (!Array.isArray(s)) return `<span class="tbar ${s.cls}" style="width:${s.bar}ch"><i style="width:${(s.fill * 100).toFixed(1)}%"></i></span>`;
    return s[1] ? `<span class="${s[1]}">${escText(s[0])}</span>` : escText(s[0]);
  }).join("");
  function drawLines() {
    const w = cols, L: Seg[][] = [], p = phase(), e = elapsed(), dur = PH[S.ph][1], left = Math.max(0, Math.ceil(dur - e)), j = job();
    const n = Math.max(10, Math.min(32, w - 46)), pc = "p-" + p;
    const rl: Seg[] = [["ROUND " + S.round + " ", "c-white"], [" " + (p.toUpperCase() + "        ").slice(0, 8) + " ", pc], { bar: n, fill: Math.min(1, e / dur), cls: pc }, [(" " + left + "s left").padStart(10), "c-text"]];
    L.push(fit(w, [...rl, ["    block " + int(S.height), "c-dim"]], rl));
    const mark = busy() && !still ? "►»>"[Math.floor(S.clock * 12) % 3] : "►";
    const act = p === "register" ? "registering for round " + S.round
      : p === "compute" ? (S.trained < 6 ? (j[0] === "evo2-c1-mix" ? "scoring twin pair " : "training unit ") + (S.trained + 1) + " of 6" : S.committed < 6 ? "committing results" : "waiting for the others to commit")
      : p === "reveal" ? "revealing 6 results" : S.checked < 2 ? "checking unit " + (S.checked + 1) + " of 2 from other workers" : "waiting for the block";
    L.push([[mark + " ", pc], [act, "c-text"]]);
    const sel: Seg[] = [["job:", "c-dim"], [" [", "c-gold"], ["0 ", "c-dim"], ["auto", "c-gold"], ["]", "c-gold"]];
    S.jobs.slice(0, 4).forEach((id, i) => sel.push(["  " + (i + 1) + " ", "c-dim"], [id, "c-text"]));
    L.push(fit(w, sel, sel.slice(0, 9), sel.slice(0, 7), sel.slice(0, 5)));
    L.push([]);
    const speed = 290e9 * (1 + 0.012 * Math.sin(S.clock / 3));
    L.push(fit(w, [["rig       ", "c-dim"], ["NVIDIA GeForce RTX 4070 SUPER (CUDA)", "c-white"]], [["rig       ", "c-dim"], ["RTX 4070 SUPER (CUDA)", "c-white"]]));
    L.push(fit(w, [["speed     ", "c-dim"], [si(speed, "FLOP/s"), "c-white"], ["  on " + j[0] + " (" + j[1] + ")", "c-dim"]], [["speed     ", "c-dim"], [si(speed, "FLOP/s"), "c-white"], ["  on " + j[0], "c-dim"]]));
    L.push(fit(w,
      [["round     ", "c-dim"], [String(S.assigned), "c-white"], [" assigned · ", "c-dim"], [String(S.trained), "c-white"], [" trained · ", "c-dim"], [String(S.committed), "c-white"], [" committed · ", "c-dim"], [String(S.checked), "c-white"], [" checked", "c-dim"]],
      [["round     ", "c-dim"], [S.trained + "/" + S.assigned, "c-white"], [" trained · ", "c-dim"], [String(S.committed), "c-white"], [" committed", "c-dim"]]));
    L.push(fit(w,
      [["session   ", "c-dim"], [nn(S.units, "unit"), "c-white"], [" · ", "c-dim"], [nn(S.checks, "check"), "c-white"], [" · ", "c-dim"], [nn(S.rounds, "round"), "c-white"], [" · ", "c-dim"], [si(S.flops, "FLOP"), "c-white"], [" trained", "c-dim"]],
      [["session   ", "c-dim"], [nn(S.units, "unit"), "c-white"], [" · ", "c-dim"], [si(S.flops, "FLOP"), "c-white"]]));
    L.push([]);
    L.push(fit(w,
      [["wallet    ", "c-dim"], [vibe(S.shownWallet), "c-gold"], ["   ", null], [vibe(S.shownEarned, true) + " this session", "c-green"]],
      [["wallet    ", "c-dim"], [vibe(S.shownWallet), "c-gold"], ["  ", null], [vibe(S.shownEarned, true), "c-green"]]));
    L.push([["stake     ", "c-dim"], [vibe(S.stake), "c-white"], ["   reputation ", "c-dim"], { bar: 10, fill: Math.round(S.rep * 10) / 10, cls: "c-green" }, [" " + S.rep.toFixed(2), "c-text"]]);
    L.push([]);
    const feed: ([Date, string, string] | null)[] = S.feed.slice(-4);
    while (feed.length < 4) feed.unshift(null);
    for (const fl of feed) L.push(fl ? [[fl[0].toTimeString().slice(0, 8) + "  ", "c-dim"], [fl[1], fl[2]]] : []);
    L.push([]);
    L.push(fit(w, [["Ctrl+C to stop", "c-dim"], ["   ·   node https://node.vibehash.org", "c-dim"]], [["Ctrl+C to stop", "c-dim"]]));
    const out = L.map(html).join("\n");
    if (out !== lastHTML) { linesEl.innerHTML = out; lastHTML = out; }
  }
  const drawMine = (dt: number) => mine.frame(dt, { busy: busy(), speed: training() ? 12 : busy() ? 4.2 : 0, committed: S.committed });

  // ---- boot: what happens before the dashboard (device check, node handshake, wallet) ----
  const BOOT: [string, string, string, string, number][] = [
    ["$ ", "c-dim", "vibehash worker", "c-white", 0.7],
    ["", "", "vibehash 0.5.18 · connecting to https://node.vibehash.org", "c-dim", 0.5],
    ["✓ ", "c-green", "GPU: NVIDIA GeForce RTX 4070 SUPER · 12 GB · CUDA", "c-text", 0.55],
    ["✓ ", "c-green", "benchmark: 290 GFLOP/s", "c-text", 0.5],
    ["✓ ", "c-green", "node: vibehash-public-1 · block #HEIGHT · client 0.5.18 accepted", "c-text", 0.6],
    ["✓ ", "c-green", "wallet: " + ADDR.slice(0, 10) + "…" + ADDR.slice(-4) + " · stake 5.00 VIBE", "c-text", 0.55],
    ["» ", "c-cyan", "starting the mining dashboard", "c-text", 0.9]
  ];
  let bootT = 0, bootDone = false;
  function drawBoot() {
    let t = 0;
    const out: string[] = [];
    for (let i = 0; i < BOOT.length; i++) {
      const b = BOOT[i], start = t;
      t += b[4];
      if (bootT < start) break;
      const text = b[2].replace("HEIGHT", int(S.height)), shown = i === 0 ? text.slice(0, Math.floor((bootT - start) * 30)) : text;
      out.push((b[0] ? `<span class="${b[1]}">${b[0]}</span>` : "") + `<span class="${b[3]}">${escText(shown)}</span>`);
    }
    boot.innerHTML = out.join("\n") + ' <span class="cursor"></span>';
    if (bootT > t + 0.3) showDash();
  }
  function showDash() { bootDone = true; boot.hidden = true; dash.hidden = false; layout(); }

  // ---- the loop: runs while the terminal is on screen and the page is visible ----
  let visible = true, last = 0, raf = 0, stopped = false;
  function frame(ts: number) {
    raf = 0;
    const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0;
    last = ts;
    if (!bootDone) { bootT += dt; drawBoot(); }
    else if (still) {
      if (Math.floor(S.clock + dt) !== Math.floor(S.clock) || !lastHTML) { advance(dt); drawMine(0); drawLines(); } else S.clock += dt;
    } else { advance(dt); drawMine(dt); drawLines(); }
    if (visible && !document.hidden && !stopped) raf = requestAnimationFrame(frame); else last = 0;
  }
  const kick = () => { if (!raf && visible && !document.hidden && !stopped) { last = 0; raf = requestAnimationFrame(frame); } };
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => { visible = es[0].isIntersecting; kick(); }) : null;
  io?.observe(root);
  document.addEventListener("visibilitychange", kick);
  const relayout = () => { if (bootDone && !stopped) { layout(); if (still) { drawMine(0); drawLines(); } } };
  const ro = "ResizeObserver" in window ? new ResizeObserver(relayout) : null;
  ro?.observe(screen);
  document.fonts?.ready.then(relayout);
  if (still) { showDash(); S.ph = 1; S.t0 = -7; S.assigned = 6; advance(0); }
  kick();

  return {
    sync(net: Network) {
      if (!net?.height) return;
      if (S.live == null) {
        const h = net.height;
        S.height = h; S.round = h + 1;
        S.feed = S.feed.map((f) => [f[0], f[1].replace(/\b211\b/g, String(h - 1)).replace(/\b212\b/g, String(h)), f[2]]);
      }
      S.live = net.height;
      if (net.chain_id) q<HTMLElement>("chain").textContent = "useful-work miner  ·  " + net.chain_id;
      const ids = (net.jobs || []).filter((jb) => jb.status !== "finished").map((jb) => String(jb.id));
      if (ids.length) S.jobs = ids;
      lastHTML = "";
      kick();
    },
    stop() {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      io?.disconnect(); ro?.disconnect();
      document.removeEventListener("visibilitychange", kick);
    }
  };
}
