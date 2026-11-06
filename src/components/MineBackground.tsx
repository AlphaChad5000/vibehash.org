import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { get, useLive, type Status } from "../lib/node";
import { MineScene } from "../lib/mine";
import { int } from "../lib/format";

const PHASE_COLOR: Record<string, string> = { register: "rgb(120 170 255)", compute: "rgb(255 180 60)", reveal: "rgb(200 125 255)", verify: "rgb(90 220 180)" };

/** The page's background, like a profile's animated backdrop: the mine in cross-section, fixed behind everything,
    with the tunnel lit and the rock fading to dark around it. It is driven by the live network: the round's phase from
    /status (read every 3 s) and the miners from /network. The drill bores while miners are working, the cart fills
    with the results committed this round, and a sealed block throws coins when anyone was on the round. With nobody
    mining, the drill stands idle and dim. The round's details sit in a slim bar at the top of the page. */
export function MineBackground() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { net } = useLive();
  const [status, setStatus] = useState<Status | null>(null);
  const [, tick] = useState(0);
  // skew: the node's clock minus ours (from /network's "now"), so the countdown is the node's.
  const live = useRef({ status: null as Status | null, skew: 0, miners: 0, block: 0, subsidy: 0 });

  // The round every 3 s while the page is visible (the site's Worker caches it for 3 s), and the countdown each second.
  useEffect(() => {
    let gone = false;
    const load = () => { if (!document.hidden) get<Status>("/status").then((s) => { if (!gone) setStatus(s); }).catch(() => {}); };
    load();
    const t = setInterval(load, 3000), ui = setInterval(() => tick((n) => n + 1), 1000);
    return () => { gone = true; clearInterval(t); clearInterval(ui); };
  }, []);
  useEffect(() => { if (net) live.current.skew = net.now - Date.now() / 1000; }, [net]);

  const jobId = status?.job_id ?? null;
  const miners = net ? (jobId ? net.miners.online_by_job?.[jobId] ?? net.miners.online : net.miners.online) : 0;
  live.current.status = status;
  live.current.miners = miners;
  live.current.subsidy = net?.subsidy ?? 0;

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const still = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // The drill near the right edge, beside the content column rather than behind it.
    const mine = new MineScene(cv, { still, drillAt: 0.86, dim: 0.4 });
    let laidW = 0, laidH = 0;
    const layout = () => {
      // Phones resize the viewport as their address bar slides; only a new width or a much taller screen redraws.
      const W = window.innerWidth, H = window.innerHeight;
      if (W === laidW && H <= laidH && H > laidH - 160) return;
      laidW = W; laidH = H;
      const lh = Math.round(Math.max(16, Math.min(24, H / 34))), cw = Math.round(lh * 0.55);
      const rows = Math.ceil(H / lh) + 1;
      mine.resize(Math.ceil(W / cw) + 1, cw, lh, Math.round(lh * 0.75), rows, Math.max(3, Math.round(rows * 0.3)));
    };
    layout();
    let raf = 0, last = 0, since = 0;
    const frame = (ts: number) => {
      raf = 0;
      const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0;
      last = ts;
      const L = live.current, s = L.status;
      if (s && L.block && s.height > L.block) {
        const paid = L.miners > 0;
        mine.celebrate(paid && L.subsidy ? `+${(L.subsidy / 1e8).toLocaleString("en-US")} VIBE · block #${int(s.height)}` : `block #${int(s.height)} sealed`, paid, paid ? "rgb(255,200,50)" : "rgb(165,172,182)");
      }
      if (s) L.block = s.height;
      const working = L.miners > 0 && !!s && s.phase !== "register" && s.phase !== "idle";
      const prog = Array.isArray(s?.progress) && s!.progress.length === 2 ? (s!.progress as number[]) : null;
      const state = {
        busy: working,
        speed: still ? 0 : working ? (s!.phase === "compute" ? 12 : 4) : 0,
        committed: prog && prog[1] > 0 ? Math.min(4, Math.ceil((4 * prog[0]) / prog[1])) : 0,
        dimDrill: L.miners === 0
      };
      // Idle and nothing in flight: the lanterns' flicker is all that moves, so ten frames a second will do.
      since += dt;
      if (working || !mine.quiet() || since >= 0.1 || !dt) { mine.frame(still ? 0 : since, state); since = 0; }
      if (!document.hidden && !still) raf = requestAnimationFrame(frame); else last = 0;
    };
    const kick = () => { if (!raf && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };
    const onResize = () => { layout(); kick(); };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", kick);
    document.fonts?.ready.then(kick);
    const redraw = still ? setInterval(kick, 3000) : 0; // reduced motion: a still picture, refreshed as the round moves
    kick();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize); document.removeEventListener("visibilitychange", kick);
      if (redraw) clearInterval(redraw);
    };
  }, []);

  const now = Date.now() / 1000 + live.current.skew;
  const left = status ? Math.max(0, Math.ceil(status.phase_ends - now)) : 0;
  const phase = status?.phase ?? "";
  return (
    <>
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
        <canvas ref={canvas} className="block" />
        {/* Dark behind the content column (1152 px wide), clearing toward the sides, where the mine shows through. */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgb(11 10 9 / 0.15) 0, rgb(11 10 9 / 0.8) max(0px, calc(50% - 520px)), rgb(11 10 9 / 0.8) min(100%, calc(50% + 520px)), rgb(11 10 9 / 0.15) 100%)" }} />
      </div>
      <div className="border-b border-rule/70 bg-ink/70 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[0.72rem] tracking-wide text-mute">
          <span className="inline-flex items-center gap-2 uppercase font-semibold">
            <span className={"w-1.5 h-1.5 rounded-full " + (status ? "bg-good" : "bg-dim")} />{status ? "Live" : "Connecting"}
          </span>
          {status && (
            <>
              <span>ROUND <b className="text-fg">{int(status.round)}</b></span>
              <span className="inline-flex items-center gap-2 uppercase font-semibold" style={{ color: PHASE_COLOR[phase] ?? "rgb(125 135 148)" }}>
                {phase}{phase !== "idle" && <span className="tabular-nums text-mute font-normal">{left}s</span>}
              </span>
              {jobId && <Link to={"/jobs/" + encodeURIComponent(jobId)} className="text-fg hover:underline truncate max-w-[16rem]">{jobId}</Link>}
              <span className={miners ? "text-good" : ""}>{miners} miner{miners === 1 ? "" : "s"} on it</span>
              <span className="hidden sm:inline">block #{int(status.height)}</span>
              {!miners && <Link to="/#join" className="ml-auto text-signal hover:underline">Nobody's mining: start a worker →</Link>}
            </>
          )}
        </div>
      </div>
    </>
  );
}
