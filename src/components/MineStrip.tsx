import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { get, useLive, type Status } from "../lib/node";
import { MineScene } from "../lib/mine";
import { int } from "../lib/format";

const PHASE_COLOR: Record<string, string> = { register: "rgb(120 170 255)", compute: "rgb(255 180 60)", reveal: "rgb(200 125 255)", verify: "rgb(90 220 180)" };

/** The mine across the top of every page, driven by the live network: the round's phase from /status (read every
    3 s), miners from /network. The drill bores while miners are working, the cart fills with the results committed this
    round, and a sealed block throws coins when anyone was paid. Nobody mining: the drill stands idle, honestly. */
export function MineStrip() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const { net } = useLive();
  const [status, setStatus] = useState<Status | null>(null);
  const [, tick] = useState(0);
  // skew: the node's clock minus ours, in seconds (from /network's "now"), so the phase countdown is the node's.
  const live = useRef({ status: null as Status | null, skew: 0, miners: 0, block: 0, subsidy: 0 });

  // The round, every 3 seconds while the page is visible (the site's Worker caches it for 3 s at the edge), and a
  // redraw each second for the countdown.
  useEffect(() => {
    let gone = false;
    const load = () => { if (!document.hidden) get<Status>("/status").then((s) => { if (!gone) setStatus(s); }).catch(() => {}); };
    load();
    const t = setInterval(load, 3000);
    const ui = setInterval(() => tick((n) => n + 1), 1000);
    return () => { gone = true; clearInterval(t); clearInterval(ui); };
  }, []);
  useEffect(() => { if (net) live.current.skew = net.now - Date.now() / 1000; }, [net]);

  const jobId = status?.job_id ?? null;
  const miners = net ? (jobId ? net.miners.online_by_job?.[jobId] ?? net.miners.online : net.miners.online) : 0;
  live.current.status = status;
  live.current.miners = miners;
  live.current.subsidy = net?.subsidy ?? 0;

  // The scene, drawn every frame while the strip is on screen.
  useEffect(() => {
    const cv = canvas.current, el = box.current;
    if (!cv || !el) return;
    const still = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const mine = new MineScene(cv, still, 0.62);
    const layout = () => {
      const small = el.clientWidth < 640, cw = small ? 7 : 9, lh = small ? 13 : 16;
      mine.resize(Math.ceil(el.clientWidth / cw) + 1, cw, lh, small ? 11 : 13);
    };
    layout();
    let raf = 0, last = 0, visible = true;
    const frame = (ts: number) => {
      raf = 0;
      const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0;
      last = ts;
      const L = live.current, s = L.status;
      if (s && L.block && s.height > L.block) {
        mine.celebrate(L.miners > 0 && L.subsidy ? `+${(L.subsidy / 1e8).toLocaleString("en-US")} VIBE · block #${int(s.height)}` : `block #${int(s.height)} sealed`, L.miners > 0, L.miners > 0 ? "rgb(255,200,50)" : "rgb(165,172,182)");
      }
      if (s) L.block = s.height;
      const working = L.miners > 0 && !!s && s.phase !== "register" && s.phase !== "idle";
      const prog = Array.isArray(s?.progress) && s!.progress.length === 2 ? (s!.progress as number[]) : null;
      mine.frame(still ? 0 : dt, {
        busy: working,
        speed: still ? 0 : working ? (s!.phase === "compute" ? 12 : 4) : 0,
        committed: prog && prog[1] > 0 ? Math.min(4, Math.ceil((4 * prog[0]) / prog[1])) : 0,
        dimDrill: L.miners === 0
      });
      if (visible && !document.hidden && !still) raf = requestAnimationFrame(frame); else last = 0;
    };
    const kick = () => { if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };
    const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; kick(); });
    io.observe(el);
    const ro = new ResizeObserver(() => { layout(); kick(); });
    ro.observe(el);
    document.addEventListener("visibilitychange", kick);
    document.fonts?.ready.then(kick);
    const redraw = still ? setInterval(kick, 3000) : 0; // reduced motion: a still picture, refreshed as the round moves
    kick();
    return () => { if (raf) cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); document.removeEventListener("visibilitychange", kick); if (redraw) clearInterval(redraw); };
  }, []);

  const now = Date.now() / 1000 + live.current.skew;
  const left = status ? Math.max(0, Math.ceil(status.phase_ends - now)) : 0;
  const phase = status?.phase ?? "";
  const color = PHASE_COLOR[phase] ?? "rgb(125 135 148)";
  return (
    <div className="relative border-b border-rule bg-[#0d0b0a]">
      <div ref={box} className="overflow-hidden" aria-hidden="true"><canvas ref={canvas} className="block" /></div>
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[0.72rem] tracking-wide text-mute" aria-live="off">
        <span className="inline-flex items-center gap-2 uppercase font-semibold">
          <span className={"w-1.5 h-1.5 rounded-full " + (status ? "bg-good" : "bg-dim")} />{status ? "Live" : "Connecting"}
        </span>
        {status && (
          <>
            <span>ROUND <b className="text-fg">{int(status.round)}</b></span>
            <span className="inline-flex items-center gap-2 uppercase font-semibold" style={{ color }}>
              {phase}{phase !== "idle" && <span className="tabular-nums text-mute font-normal normal-case">{left}s</span>}
            </span>
            {jobId && <Link to={"/jobs/" + encodeURIComponent(jobId)} className="text-fg hover:underline truncate max-w-[16rem]">{jobId}</Link>}
            <span className={miners ? "text-good" : ""}>{miners} miner{miners === 1 ? "" : "s"} on it</span>
            <span className="hidden sm:inline">block #{int(status.height)}</span>
            {!miners && <Link to="/#join" className="ml-auto text-signal hover:underline normal-case">Nobody's mining: start a worker →</Link>}
          </>
        )}
      </div>
    </div>
  );
}
