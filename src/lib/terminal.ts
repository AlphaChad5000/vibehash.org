/* The worker's dashboard, ported from vibehash/minerui.py and termui.py: the same banner, rock, tunnel, rails, ore cart
   and drill, the same round and phase bar and lines. It replays one rig's rounds (register, compute, reveal, verify,
   paid), with the round and block numbers taken from the live node. Over the terminal it adds smooth scrolling, spark
   and coin particles, lantern glow and rolling cart wheels. It pauses off screen; reduced motion keeps it still. */
import type { Network } from "./node";

type Seg = [string, string | null] | { bar: number; fill: number; cls: string };
type RGB = [number, number, number];
interface Spark { x: number; y: number; vx: number; vy: number; t: number; life: number; c: RGB }
interface Coin { x: number; y: number; vx: number; vy: number; t: number; life: number; ph: number }

const STRATA: RGB[] = [[96, 66, 50], [128, 90, 62], [158, 118, 82], [116, 104, 94], [82, 76, 74]];
const LIGHT = [1.1, 0.95, 0.78], SHADE = [1, 0.8, 0.6];
const rgb = (a: RGB, k = 1) => `rgb(${Math.min(255, (a[0] * k) | 0)},${Math.min(255, (a[1] * k) | 0)},${Math.min(255, (a[2] * k) | 0)})`;
const ROCK = STRATA.map((s) => LIGHT.map((l) => SHADE.map((d) => rgb(s, l * d))));
const TIMBER = "rgb(168,112,58)", LAMP: RGB = [255, 214, 120], RAIL = "rgb(150,152,165)", TIE = "rgb(110,86,62)", CART = "rgb(176,116,60)";
const GOLD = "rgb(255,200,50)", TEXTC = "rgb(205,212,220)", DIMC = "rgb(125,135,148)";
const SPARKS: RGB[] = [[255, 225, 130], [255, 160, 60], [255, 250, 225], [255, 110, 40]];
const BANNER = ["█ █ █ █▄▄ █▀▀   █ █ ▄▀█ █▀ █ █", "▀▄▀ █ █▄█ ██▄   █▀█ █▀█ ▄█ █▀█"];
const BAND = 7, TOP = 2, MID = 3, LOW = 4;
const PH: [string, number][] = [["register", 4], ["compute", 16], ["reveal", 5], ["verify", 7]];

function noise(x: number, y: number): number {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0;
  n = Math.imul((n ^ (n >>> 13)) >>> 0, 1274126177) >>> 0;
  return (n ^ (n >>> 16)) >>> 0;
}
const lampDist = (x: number) => { const m = (((x - 6) % 24) + 24) % 24; return Math.min(m, 24 - m); };
const litBy = (d: number) => (d <= 3 ? 0 : d <= 7 ? 1 : 2);
const layerAt = (x: number, r: number) => (r + (noise(Math.floor(x / 9), 99) % 3) + (noise(Math.floor(x / 4), r) % 7 === 0 ? 1 : 0)) % 5;
const int = (n: number) => Math.round(n).toLocaleString("en-US");
const vibe = (v: number, sign = false) => (sign && v >= 0 ? "+" : "") + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " VIBE";
const nn = (c: number, noun: string) => c.toLocaleString("en-US") + " " + noun + (c === 1 ? "" : "s");
function si(n: number, unit: string): string {
  for (const [s, p] of [[1e15, "P"], [1e12, "T"], [1e9, "G"], [1e6, "M"], [1e3, "k"]] as [number, string][]) if (n >= s) return (n / s).toFixed(2) + " " + p + unit;
  return n.toFixed(0) + " " + unit;
}
const escText = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);

export interface TerminalHandle { sync(net: Network): void; stop(): void }

/** Start the dashboard inside `root`, which holds the elements marked data-t="…" (see components/Terminal.tsx). */
export function startTerminal(root: HTMLElement): TerminalHandle {
  const q = <T extends Element>(k: string) => root.querySelector(`[data-t="${k}"]`) as T;
  const screen = q<HTMLElement>("screen"), boot = q<HTMLElement>("boot"), dash = q<HTMLElement>("dash");
  const canvas = q<HTMLCanvasElement>("mine"), ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const linesEl = q<HTMLElement>("lines"), probe = q<HTMLElement>("probe");
  const still = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // The banner, as pixels: each line of half-blocks is two rows, coloured gold to violet left to right.
  {
    const svg = q<SVGSVGElement>("banner"), w = BANNER[0].length, out: string[] = [];
    svg.setAttribute("viewBox", `0 0 ${w} 4`);
    out.push(`<defs><linearGradient id="tgrad" x1="0" x2="${w}" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffcd3c"/><stop offset=".35" stop-color="#ff9646"/><stop offset=".68" stop-color="#ff5f96"/><stop offset="1" stop-color="#b46eff"/></linearGradient></defs><g fill="url(#tgrad)">`);
    BANNER.forEach((line, li) => {
      for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        if (ch === "█" || ch === "▀") out.push(`<rect x="${j}" y="${li * 2}" width="1.02" height="1.02"/>`);
        if (ch === "█" || ch === "▄") out.push(`<rect x="${j}" y="${li * 2 + 1}" width="1.02" height="1.02"/>`);
      }
    });
    svg.innerHTML = out.join("") + "</g>";
  }
  let hex = "";
  for (let i = 0; i < 36; i++) hex += "0123456789abcdef"[(Math.random() * 16) | 0];
  const ADDR = "vibe1" + hex;
  q<HTMLElement>("addr").textContent = ADDR;

  // ---- the replayed rig ----
  const S = {
    clock: 0, round: 213, height: 212, live: null as number | null, ph: 0, t0: -1,
    assigned: 0, trained: 0, committed: 0, checked: 0, units: 75, checks: 35, rounds: 13, flops: 5.65e12,
    wallet: 31.58, shownWallet: 31.58, stake: 5, earned: 36.58, shownEarned: 36.58, rep: 0.91, scroll: 0,
    popup: null as [number, number] | null, feed: [] as [Date, string, string][], gen: 40, reward: 51.2, jobs: ["fruit-demo", "evo2-c1-mix"]
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
    S.scroll += dt * (still ? 0 : training() ? 12 : busy() ? 4.2 : 0);
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
      S.popup = [S.clock, pay]; coinBurst();
      note("paid " + vibe(pay, true) + " in block " + S.height, "c-gold");
      S.round++;
      if (S.live && S.live + 1 > S.round) { S.round = S.live + 1; S.height = S.live; }
      S.assigned = S.trained = S.committed = S.checked = 0;
    }
    S.ph = (S.ph + 1) % PH.length;
    S.t0 = S.clock;
  }

  // ---- layout: font size, cell size, columns ----
  let fs = 13, cw = 7.8, lh = 20.8, cols = 70, dx = 31, cssW = 0, cssH = 0, dpr = 1, lastHTML = "";
  function layout() {
    const cs = getComputedStyle(screen), avail = screen.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    fs = Math.max(9.5, Math.min(13.5, avail / (48 * 0.6)));
    screen.style.fontSize = fs + "px";
    cw = probe.getBoundingClientRect().width / 20 || fs * 0.6;
    lh = fs * 1.6;
    cols = Math.max(40, Math.floor(avail / cw));
    dx = Math.max(16, Math.floor(cols * 0.45));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cssW = cols * cw; cssH = BAND * lh;
    canvas.style.width = cssW + "px"; canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    lastHTML = "";
  }

  // ---- particles ----
  let parts: Spark[] = [], coins: Coin[] = [];
  function coinBurst() {
    if (still) return;
    for (let i = 0; i < 14; i++) coins.push({ x: (dx + 0.5) * cw, y: MID * lh, vx: -40 - Math.random() * 170, vy: -170 - Math.random() * 150, t: 0, life: 2.4, ph: Math.random() * 6 });
  }
  function emit(dt: number) {
    if (still || !busy()) return;
    let n = (training() ? 55 : 18) * dt;
    while (n > 0) {
      if (n < 1 && Math.random() > n) break;
      n -= 1;
      parts.push({ x: (dx + 1) * cw - 2, y: (MID + 0.5) * lh + (Math.random() - 0.5) * lh * 1.4, vx: -30 - Math.random() * 150, vy: -150 + Math.random() * 190, t: 0, life: 0.25 + Math.random() * 0.55, c: SPARKS[(Math.random() * 4) | 0] });
    }
  }
  function stepParts(dt: number) {
    const railY = (LOW + 0.5) * lh - 3;
    parts = parts.filter((p) => { p.t += dt; p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; return p.t < p.life; });
    coins = coins.filter((c) => {
      c.t += dt; c.vy += 640 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.y > railY - 4 && c.vy > 0) { c.y = railY - 4; c.vy *= -0.42; c.vx *= 0.7; }
      return c.t < c.life;
    });
  }
  function diamond(x: number, y: number, r: number, color: string, glow: number) {
    ctx.save(); ctx.fillStyle = color;
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.72, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.72, y); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ---- the mine: minerui._band cell for cell, with the upgrades on top ----
  function drawBand() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const off = Math.floor(S.scroll), frac = S.scroll - off, face = (dx + 1) * cw, f = still ? 0 : Math.floor(S.clock * 12), isBusy = busy();
    // Already mined, left of the drill: rock above and below a timbered tunnel, lit by lanterns.
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, face, cssH); ctx.clip();
    const lamps: number[] = [];
    for (let c = 0; c <= cols + 1; c++) {
      const x = off + c, px = (c - frac) * cw;
      if (px > face) break;
      const ld = lampDist(x), lit = litBy(ld);
      for (let r = 0; r < BAND; r++) {
        if (r >= TOP && r <= LOW) continue;
        if (r === TOP - 1 && (x % 12 === 11 || x % 12 === 0 || x % 12 === 1)) continue;
        const v = noise(x, r) % 100;
        ctx.fillStyle = ROCK[layerAt(x, r)][lit][v < 60 ? 0 : v < 88 ? 1 : 2];
        ctx.fillRect(px, r * lh, cw + 0.6, lh + 0.6);
      }
      if (x % 12 === 0) { // pit props, and the beam over them
        ctx.fillStyle = TIMBER;
        ctx.fillRect(px + cw * 0.18, (TOP - 0.35) * lh, cw * 0.2, 2.85 * lh - 4);
        ctx.fillRect(px + cw * 0.62, (TOP - 0.35) * lh, cw * 0.2, 2.85 * lh - 4);
        ctx.fillRect(px - cw, (TOP - 0.42) * lh, cw * 3, lh * 0.16);
        ctx.fillRect(px - cw, (TOP - 0.2) * lh, cw * 3, lh * 0.12);
      }
      if (ld === 0) lamps.push(px + cw / 2);
    }
    const ry = (LOW + 0.5) * lh;
    for (let c = 0; c <= cols + 1; c++) {
      const x = off + c, px = (c - frac) * cw;
      if (px > face) break;
      if (x % 4 === 0) { ctx.fillStyle = TIE; ctx.fillRect(px + cw / 2 - 1.5, ry - 6, 3, 12); }
    }
    ctx.fillStyle = RAIL; ctx.fillRect(0, ry - 3, face, 1.5); ctx.fillRect(0, ry + 1.5, face, 1.5);
    for (const lx of lamps) {
      const fl = still ? 1 : 0.9 + 0.1 * Math.sin(S.clock * 9 + lx * 0.37);
      const g = ctx.createRadialGradient(lx, (TOP + 0.4) * lh, 0, lx, (TOP + 0.4) * lh, cw * 5);
      g.addColorStop(0, `rgba(255,214,120,${0.28 * fl})`); g.addColorStop(1, "rgba(255,214,120,0)");
      ctx.fillStyle = g; ctx.fillRect(lx - cw * 5, (TOP - 1) * lh, cw * 10, lh * 3.5);
      ctx.save(); ctx.fillStyle = rgb(LAMP); ctx.shadowColor = rgb(LAMP); ctx.shadowBlur = 10 * fl;
      ctx.fillRect(lx - 0.5, TOP * lh, 1, lh * 0.18); ctx.fillRect(lx - cw * 0.28, TOP * lh + lh * 0.18, cw * 0.56, lh * 0.36);
      ctx.restore();
    }
    ctx.restore();

    // Not mined yet, right of the drill: solid rock with ore in it.
    ctx.save(); ctx.beginPath(); ctx.rect(face, 0, cssW - face, cssH); ctx.clip();
    for (let c = Math.max(0, dx - 1); c <= cols + 1; c++) {
      const x = off + c, px = (c - frac) * cw;
      if (px + cw < face) continue;
      for (let r = 0; r < BAND; r++) {
        const v = noise(x, r) % 100;
        if (v < (r >= TOP && r <= LOW ? 4 : 1)) { diamond(px + cw / 2, r * lh + lh / 2, lh * 0.26, GOLD, 6); continue; }
        ctx.fillStyle = ROCK[layerAt(x, r)][1][v < 60 ? 0 : v < 88 ? 1 : 2];
        ctx.fillRect(px, r * lh, cw + 0.6, lh + 0.6);
      }
    }
    if (isBusy && !still) {
      const fg = ctx.createLinearGradient(face, 0, face + cw * 4, 0);
      fg.addColorStop(0, "rgba(255,190,90,0.28)"); fg.addColorStop(1, "rgba(255,190,90,0)");
      ctx.fillStyle = fg; ctx.fillRect(face, (TOP - 0.5) * lh, cw * 4, lh * 4);
    }
    ctx.restore();

    // The ore cart: one nugget per unit committed this round, on wheels that roll with the tunnel.
    const cx = dx - 13;
    ctx.fillStyle = CART;
    ctx.fillRect((cx + 0.5) * cw, MID * lh + lh * 0.08, cw * 0.5, lh * 0.92);
    ctx.fillRect((cx + 5) * cw, MID * lh + lh * 0.08, cw * 0.5, lh * 0.92);
    ctx.fillRect((cx + 0.5) * cw, (MID + 1) * lh - 3, cw * 5, 3);
    for (let k = 0; k < 4; k++) {
      const ox = (cx + 1 + k) * cw + cw / 2, oy = MID * lh + lh * 0.55;
      if (k < Math.min(S.committed, 4)) diamond(ox, oy, lh * 0.27, GOLD, 8);
      else { ctx.fillStyle = DIMC; ctx.fillRect(ox - 1, oy - 1, 2, 2); }
    }
    ctx.fillStyle = RAIL; ctx.fillRect((cx + 5.5) * cw, MID * lh + lh * 0.5 - 0.75, cw * 3.5, 1.5);
    const wr = Math.min(cw * 0.95, lh * 0.36), wy = ry - 3 - wr, ang = (S.scroll * cw) / wr;
    for (const wc of [cx + 1.5, cx + 4.5]) {
      ctx.save(); ctx.translate(wc * cw, wy);
      ctx.fillStyle = "#0a0908"; ctx.strokeStyle = TEXTC; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, wr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.rotate(ang); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-wr, 0); ctx.lineTo(wr, 0); ctx.moveTo(0, -wr); ctx.lineTo(0, wr); ctx.stroke();
      ctx.restore();
    }

    // The drill: a body whose stripes turn while it works, and a spinning tip.
    const bx = (dx - 4) * cw, by = (TOP + 0.5) * lh, bw = 4 * cw, bh = 2 * lh;
    const bg = ctx.createLinearGradient(0, by, 0, by + bh);
    bg.addColorStop(0, "rgb(150,225,255)"); bg.addColorStop(0.45, "rgb(80,200,255)"); bg.addColorStop(1, "rgb(40,140,200)");
    ctx.save();
    if (isBusy && !still) { ctx.shadowColor = "rgba(80,200,255,0.6)"; ctx.shadowBlur = 16; }
    ctx.fillStyle = bg; ctx.fillRect(bx, by, bw, bh); ctx.restore();
    for (let s = 0; s < 4; s++) if ((s + (isBusy ? f : 0)) % 3 === 0) { ctx.fillStyle = "rgba(20,70,110,0.75)"; ctx.fillRect(bx + s * cw, MID * lh, cw, lh); }
    ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(bx, by, bw, 1.5);
    const tx = dx * cw, ty = (MID + 0.5) * lh, th = lh * 1.25;
    const tipPath = () => { ctx.beginPath(); ctx.moveTo(tx, ty - th / 2); ctx.lineTo(tx + cw, ty); ctx.lineTo(tx, ty + th / 2); ctx.closePath(); };
    ctx.save();
    if (isBusy && !still) { ctx.shadowColor = "rgb(225,245,255)"; ctx.shadowBlur = 14; }
    ctx.fillStyle = isBusy ? "rgb(225,245,255)" : "rgb(80,200,255)"; tipPath(); ctx.fill(); ctx.restore();
    ctx.save(); tipPath(); ctx.clip(); ctx.strokeStyle = "rgba(30,90,130,0.7)"; ctx.lineWidth = 1.2;
    const sp = isBusy && !still ? (S.clock * 30) % 6 : 0;
    for (let q2 = -12; q2 < 12; q2 += 6) { ctx.beginPath(); ctx.moveTo(tx + q2 + sp, ty - th / 2); ctx.lineTo(tx + q2 + sp + 6, ty + th / 2); ctx.stroke(); }
    ctx.restore();

    // Sparks off the rock face, gold coins after a payout, and the payout itself.
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const p of parts) {
      ctx.strokeStyle = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${1 - p.t / p.life})`; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025); ctx.stroke();
    }
    ctx.restore();
    for (const c of coins) {
      const rr = lh * 0.2;
      ctx.save(); ctx.globalAlpha = Math.min(1, (c.life - c.t) / 0.6); ctx.translate(c.x, c.y);
      ctx.scale(Math.max(0.15, Math.abs(Math.cos(c.t * 9 + c.ph))), 1);
      ctx.fillStyle = GOLD; ctx.shadowColor = GOLD; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = "rgba(255,250,220,0.8)"; ctx.beginPath(); ctx.arc(-rr * 0.3, -rr * 0.3, rr * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (S.popup && S.clock - S.popup[0] < 2.5) {
      const label = " " + vibe(S.popup[1], true) + " ", age = S.clock - S.popup[0];
      const lx = Math.max(0, (dx - Math.floor(label.length / 2)) * cw), rise = still ? 1 : Math.min(1, age * 4);
      ctx.save(); ctx.globalAlpha = Math.min(1, (2.5 - age) / 0.5);
      ctx.fillStyle = "#0a0908"; ctx.fillRect(lx, 0, label.length * cw, lh);
      ctx.font = `700 ${fs}px 'JetBrains Mono', Consolas, monospace`; ctx.textBaseline = "middle";
      ctx.fillStyle = GOLD; ctx.shadowColor = GOLD; ctx.shadowBlur = 10;
      ctx.fillText(label, lx, lh * 0.5 + (1 - rise) * 6); ctx.restore();
    }
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
      if (Math.floor(S.clock + dt) !== Math.floor(S.clock) || !lastHTML) { advance(dt); drawBand(); drawLines(); } else S.clock += dt;
    } else { advance(dt); emit(dt); stepParts(dt); drawBand(); drawLines(); }
    if (visible && !document.hidden && !stopped) raf = requestAnimationFrame(frame); else last = 0;
  }
  const kick = () => { if (!raf && visible && !document.hidden && !stopped) { last = 0; raf = requestAnimationFrame(frame); } };
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => { visible = es[0].isIntersecting; kick(); }) : null;
  io?.observe(root);
  document.addEventListener("visibilitychange", kick);
  const relayout = () => { if (bootDone && !stopped) { layout(); if (still) { drawBand(); drawLines(); } } };
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
