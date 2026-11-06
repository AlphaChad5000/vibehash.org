/* The mine from the worker's dashboard (vibehash/minerui.py _band, termui.py rock): layered rock, a timbered tunnel
   lit by lanterns, rails, an ore cart and the drill, drawn on a canvas cell by cell. Shared by the hero's terminal
   (terminal.ts, a replay) and the live strip at the top of every page (components/MineStrip.tsx). Over the terminal
   it adds smooth scrolling, spark and coin particles, lantern glow and rolling wheels. */

type RGB = [number, number, number];
interface Spark { x: number; y: number; vx: number; vy: number; t: number; life: number; c: RGB }
interface Coin { x: number; y: number; vx: number; vy: number; t: number; life: number; ph: number }

const STRATA: RGB[] = [[96, 66, 50], [128, 90, 62], [158, 118, 82], [116, 104, 94], [82, 76, 74]];
const LIGHT = [1.1, 0.95, 0.78], SHADE = [1, 0.8, 0.6];
export const rgb = (a: RGB, k = 1) => `rgb(${Math.min(255, (a[0] * k) | 0)},${Math.min(255, (a[1] * k) | 0)},${Math.min(255, (a[2] * k) | 0)})`;
const ROCK = STRATA.map((s) => LIGHT.map((l) => SHADE.map((d) => rgb(s, l * d))));
const TIMBER = "rgb(168,112,58)", LAMP: RGB = [255, 214, 120], RAIL = "rgb(150,152,165)", TIE = "rgb(110,86,62)", CART = "rgb(176,116,60)";
const GOLD = "rgb(255,200,50)", TEXTC = "rgb(205,212,220)", DIMC = "rgb(125,135,148)", TUNNEL = "#0d0b0a";
const SPARKS: RGB[] = [[255, 225, 130], [255, 160, 60], [255, 250, 225], [255, 110, 40]];
export const BAND = 7;
const TOP = 2, MID = 3, LOW = 4;

function noise(x: number, y: number): number {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0;
  n = Math.imul((n ^ (n >>> 13)) >>> 0, 1274126177) >>> 0;
  return (n ^ (n >>> 16)) >>> 0;
}
const lampDist = (x: number) => { const m = (((x - 6) % 24) + 24) % 24; return Math.min(m, 24 - m); };
const litBy = (d: number) => (d <= 3 ? 0 : d <= 7 ? 1 : 2);
const layerAt = (x: number, r: number) => (r + (noise(Math.floor(x / 9), 99) % 3) + (noise(Math.floor(x / 4), r) % 7 === 0 ? 1 : 0)) % 5;

/** What the scene shows this frame. */
export interface MineState {
  busy: boolean;      // the drill is biting: stripes turn, the tip spins, sparks fly
  speed: number;      // columns a second the tunnel moves past (0: still)
  committed: number;  // nuggets in the cart, 0-4
  dimDrill?: boolean; // nobody at the controls: the drill's colours fade
}

export class MineScene {
  private ctx: CanvasRenderingContext2D;
  private parts: Spark[] = [];
  private coins: Coin[] = [];
  private popup: { t: number; text: string; color: string } | null = null;
  clock = 0;
  scroll = 0;
  cols = 70;
  dx = 31;
  cw = 8;
  lh = 18;
  fs = 13;
  private dpr = 1;
  private w = 0;
  private h = 0;

  constructor(private canvas: HTMLCanvasElement, private still = false, private drillAt = 0.45) {
    this.ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  }

  /** Size the scene: `cols` cells of `cw` x `lh` CSS pixels, BAND rows tall. */
  resize(cols: number, cw: number, lh: number, fs: number) {
    this.cols = cols; this.cw = cw; this.lh = lh; this.fs = fs;
    this.dx = Math.max(16, Math.floor(cols * this.drillAt));
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = cols * cw; this.h = BAND * lh;
    this.canvas.style.width = this.w + "px"; this.canvas.style.height = this.h + "px";
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
  }

  /** Gold coins out of the rock face, and a label over the drill (a payout, a sealed block). */
  celebrate(text: string, coins = true, color = GOLD) {
    this.popup = { t: this.clock, text, color };
    if (this.still || !coins) return;
    const { dx, cw, lh } = this;
    for (let i = 0; i < 14; i++) this.coins.push({ x: (dx + 0.5) * cw, y: MID * lh, vx: -40 - Math.random() * 170, vy: -170 - Math.random() * 150, t: 0, life: 2.4, ph: Math.random() * 6 });
  }

  /** Move time on by `dt` seconds, then draw. */
  frame(dt: number, s: MineState) {
    this.clock += dt;
    if (!this.still) this.scroll += dt * s.speed;
    this.step(dt, s);
    this.draw(s);
  }

  private step(dt: number, s: MineState) {
    const { dx, cw, lh } = this;
    if (!this.still && s.busy) {
      let n = (s.speed > 6 ? 55 : 18) * dt;
      while (n > 0) {
        if (n < 1 && Math.random() > n) break;
        n -= 1;
        this.parts.push({ x: (dx + 1) * cw - 2, y: (MID + 0.5) * lh + (Math.random() - 0.5) * lh * 1.4, vx: -30 - Math.random() * 150, vy: -150 + Math.random() * 190, t: 0, life: 0.25 + Math.random() * 0.55, c: SPARKS[(Math.random() * 4) | 0] });
      }
    }
    const railY = (LOW + 0.5) * lh - 3;
    this.parts = this.parts.filter((p) => { p.t += dt; p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; return p.t < p.life; });
    this.coins = this.coins.filter((c) => {
      c.t += dt; c.vy += 640 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.y > railY - 4 && c.vy > 0) { c.y = railY - 4; c.vy *= -0.42; c.vx *= 0.7; }
      return c.t < c.life;
    });
  }

  private diamond(x: number, y: number, r: number, color: string, glow: number) {
    const ctx = this.ctx;
    ctx.save(); ctx.fillStyle = color;
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.72, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.72, y); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  private draw(s: MineState) {
    const { ctx, cw, lh, cols, dx, still } = this;
    const W = this.w, H = this.h;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const off = Math.floor(this.scroll), frac = this.scroll - off, face = (dx + 1) * cw, f = still ? 0 : Math.floor(this.clock * 12), isBusy = s.busy;

    // Already mined, left of the drill: rock above and below a timbered tunnel, lit by lanterns.
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, face, H); ctx.clip();
    ctx.fillStyle = TUNNEL; ctx.fillRect(0, (TOP - 1) * lh, face, lh * 4);
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
      const fl = still ? 1 : 0.9 + 0.1 * Math.sin(this.clock * 9 + lx * 0.37);
      const g = ctx.createRadialGradient(lx, (TOP + 0.4) * lh, 0, lx, (TOP + 0.4) * lh, cw * 5);
      g.addColorStop(0, `rgba(255,214,120,${0.28 * fl})`); g.addColorStop(1, "rgba(255,214,120,0)");
      ctx.fillStyle = g; ctx.fillRect(lx - cw * 5, (TOP - 1) * lh, cw * 10, lh * 3.5);
      ctx.save(); ctx.fillStyle = rgb(LAMP); ctx.shadowColor = rgb(LAMP); ctx.shadowBlur = 10 * fl;
      ctx.fillRect(lx - 0.5, TOP * lh, 1, lh * 0.18); ctx.fillRect(lx - cw * 0.28, TOP * lh + lh * 0.18, cw * 0.56, lh * 0.36);
      ctx.restore();
    }
    ctx.restore();

    // Not mined yet, right of the drill: solid rock with ore in it.
    ctx.save(); ctx.beginPath(); ctx.rect(face, 0, W - face, H); ctx.clip();
    ctx.fillStyle = TUNNEL; ctx.fillRect(face, 0, W - face, H);
    for (let c = Math.max(0, dx - 1); c <= cols + 1; c++) {
      const x = off + c, px = (c - frac) * cw;
      if (px + cw < face) continue;
      for (let r = 0; r < BAND; r++) {
        const v = noise(x, r) % 100;
        if (v < (r >= TOP && r <= LOW ? 4 : 1)) { this.diamond(px + cw / 2, r * lh + lh / 2, lh * 0.26, GOLD, 6); continue; }
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

    // The ore cart: one nugget per unit committed, on wheels that roll with the tunnel.
    const cx = dx - 13;
    ctx.fillStyle = CART;
    ctx.fillRect((cx + 0.5) * cw, MID * lh + lh * 0.08, cw * 0.5, lh * 0.92);
    ctx.fillRect((cx + 5) * cw, MID * lh + lh * 0.08, cw * 0.5, lh * 0.92);
    ctx.fillRect((cx + 0.5) * cw, (MID + 1) * lh - 3, cw * 5, 3);
    for (let k = 0; k < 4; k++) {
      const ox = (cx + 1 + k) * cw + cw / 2, oy = MID * lh + lh * 0.55;
      if (k < Math.min(s.committed, 4)) this.diamond(ox, oy, lh * 0.27, GOLD, 8);
      else { ctx.fillStyle = DIMC; ctx.fillRect(ox - 1, oy - 1, 2, 2); }
    }
    ctx.fillStyle = RAIL; ctx.fillRect((cx + 5.5) * cw, MID * lh + lh * 0.5 - 0.75, cw * 3.5, 1.5);
    const wr = Math.min(cw * 0.95, lh * 0.36), wy = ry - 3 - wr, ang = (this.scroll * cw) / wr;
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
    if (s.dimDrill) { bg.addColorStop(0, "rgb(90,130,155)"); bg.addColorStop(1, "rgb(50,85,110)"); }
    else { bg.addColorStop(0, "rgb(150,225,255)"); bg.addColorStop(0.45, "rgb(80,200,255)"); bg.addColorStop(1, "rgb(40,140,200)"); }
    ctx.save();
    if (isBusy && !still) { ctx.shadowColor = "rgba(80,200,255,0.6)"; ctx.shadowBlur = 16; }
    ctx.fillStyle = bg; ctx.fillRect(bx, by, bw, bh); ctx.restore();
    for (let i = 0; i < 4; i++) if ((i + (isBusy ? f : 0)) % 3 === 0) { ctx.fillStyle = "rgba(20,70,110,0.75)"; ctx.fillRect(bx + i * cw, MID * lh, cw, lh); }
    ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(bx, by, bw, 1.5);
    const tx = dx * cw, ty = (MID + 0.5) * lh, th = lh * 1.25;
    const tipPath = () => { ctx.beginPath(); ctx.moveTo(tx, ty - th / 2); ctx.lineTo(tx + cw, ty); ctx.lineTo(tx, ty + th / 2); ctx.closePath(); };
    ctx.save();
    if (isBusy && !still) { ctx.shadowColor = "rgb(225,245,255)"; ctx.shadowBlur = 14; }
    ctx.fillStyle = isBusy ? "rgb(225,245,255)" : s.dimDrill ? "rgb(90,130,155)" : "rgb(80,200,255)"; tipPath(); ctx.fill(); ctx.restore();
    ctx.save(); tipPath(); ctx.clip(); ctx.strokeStyle = "rgba(30,90,130,0.7)"; ctx.lineWidth = 1.2;
    const sp = isBusy && !still ? (this.clock * 30) % 6 : 0;
    for (let q = -12; q < 12; q += 6) { ctx.beginPath(); ctx.moveTo(tx + q + sp, ty - th / 2); ctx.lineTo(tx + q + sp + 6, ty + th / 2); ctx.stroke(); }
    ctx.restore();

    // Sparks, coins, and the label over the drill.
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const p of this.parts) {
      ctx.strokeStyle = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${1 - p.t / p.life})`; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025); ctx.stroke();
    }
    ctx.restore();
    for (const c of this.coins) {
      const rr = lh * 0.2;
      ctx.save(); ctx.globalAlpha = Math.min(1, (c.life - c.t) / 0.6); ctx.translate(c.x, c.y);
      ctx.scale(Math.max(0.15, Math.abs(Math.cos(c.t * 9 + c.ph))), 1);
      ctx.fillStyle = GOLD; ctx.shadowColor = GOLD; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = "rgba(255,250,220,0.8)"; ctx.beginPath(); ctx.arc(-rr * 0.3, -rr * 0.3, rr * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    const pop = this.popup;
    if (pop && this.clock - pop.t < 2.5) {
      const label = " " + pop.text + " ", age = this.clock - pop.t;
      const lx = Math.max(0, (dx - Math.floor(label.length / 2)) * cw), rise = still ? 1 : Math.min(1, age * 4);
      ctx.save(); ctx.globalAlpha = Math.min(1, (2.5 - age) / 0.5);
      ctx.fillStyle = "#0a0908"; ctx.fillRect(lx, 0, label.length * cw, lh);
      ctx.font = `700 ${this.fs}px 'JetBrains Mono', Consolas, monospace`; ctx.textBaseline = "middle";
      ctx.fillStyle = pop.color; ctx.shadowColor = pop.color; ctx.shadowBlur = 10;
      ctx.fillText(label, lx, lh * 0.5 + (1 - rise) * 6); ctx.restore();
    }
  }
}
