import { useMemo, useRef, useState } from "react";

/** A line chart of [x, y] points, with a crosshair that reads out the nearest point. Long series are thinned to
    about 400 points (keeping each bucket's last), which is plenty for the width it's drawn at. */
export function Chart({ points, format, xLabel = "block", height = 200 }: {
  points: [number, number][]; format: (y: number) => string; xLabel?: string; height?: number;
}) {
  const pts = useMemo(() => {
    if (points.length <= 400) return points;
    const step = points.length / 400, out: [number, number][] = [];
    for (let i = 1; i <= 400; i++) out.push(points[Math.min(points.length - 1, Math.round(i * step) - 1)]);
    return [points[0], ...out];
  }, [points]);
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  if (pts.length < 2) return <p className="text-dim text-sm">Not enough rounds to draw yet.</p>;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y1 - y0 < 1e-9) { y0 -= 0.5; y1 += 0.5; }
  const pad = (y1 - y0) * 0.08; y0 -= pad; y1 += pad;
  const W = 1000, H = 300;
  const X = (x: number) => ((x - x0) / Math.max(1, x1 - x0)) * W, Y = (y: number) => H - ((y - y0) / (y1 - y0)) * H;
  const d = pts.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join("");
  const h = hover != null ? pts[hover] : null;
  const move = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, x = x0 + fx * (x1 - x0);
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(p[0] - x) < Math.abs(pts[best][0] - x)) best = i; });
    setHover(best);
  };
  return (
    <figure className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5">
      <div className="flex flex-col justify-between text-right font-mono text-[0.72rem] text-dim" style={{ height }}>
        <span>{format(y1)}</span><span>{format((y0 + y1) / 2)}</span><span>{format(y0)}</span>
      </div>
      <div ref={box} className="relative touch-pan-y" style={{ height }} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full block overflow-visible">
          <defs>
            <linearGradient id="cg" x1="0" x2="1"><stop offset="0" stopColor="#ffcd3c" /><stop offset=".35" stopColor="#ff9646" /><stop offset=".68" stopColor="#ff5f96" /><stop offset="1" stopColor="#b46eff" /></linearGradient>
            <linearGradient id="cf" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ff9646" stopOpacity=".18" /><stop offset="1" stopColor="#ff9646" stopOpacity="0" /></linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="#2b2824" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
          <path d={d + `L${W} ${H}L0 ${H}Z`} fill="url(#cf)" />
          <path d={d} fill="none" stroke="url(#cg)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        {h && (
          <>
            <div className="absolute top-0 bottom-0 w-px bg-mute/60 pointer-events-none" style={{ left: (X(h[0]) / W) * 100 + "%" }} />
            <div className="absolute w-3 h-3 rounded-full border-2 border-fg bg-ink -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: (X(h[0]) / W) * 100 + "%", top: (Y(h[1]) / H) * 100 + "%" }} />
            <div className="absolute top-1 z-10 whitespace-nowrap bg-ink border border-rule px-2 py-0.5 text-sm text-mute pointer-events-none"
              style={X(h[0]) / W > 0.6 ? { right: (100 - (X(h[0]) / W) * 100) + 1 + "%" } : { left: (X(h[0]) / W) * 100 + 1 + "%" }}>
              <b className="text-fg tabular-nums">{format(h[1])}</b> · {xLabel} #{h[0].toLocaleString("en-US")}
            </div>
          </>
        )}
      </div>
      <div className="col-start-2 flex justify-between pt-1.5 font-mono text-[0.72rem] text-dim">
        <span>#{x0.toLocaleString("en-US")}</span><span>#{x1.toLocaleString("en-US")}</span>
      </div>
    </figure>
  );
}
