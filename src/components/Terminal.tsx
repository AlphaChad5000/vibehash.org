import { useEffect, useRef } from "react";
import { useLive } from "../lib/node";
import { int } from "../lib/format";
import { startTerminal, type TerminalHandle } from "../lib/terminal";

/** The glass terminal: lib/terminal.ts draws into it, and the live network feeds it its round and block numbers. */
export function Terminal() {
  const root = useRef<HTMLElement>(null);
  const handle = useRef<TerminalHandle | null>(null);
  const { net } = useLive();
  useEffect(() => {
    if (!root.current) return;
    handle.current = startTerminal(root.current);
    return () => { handle.current?.stop(); handle.current = null; };
  }, []);
  useEffect(() => { if (net) handle.current?.sync(net); }, [net]);
  return (
    <figure ref={root} className="glass m-0 min-w-0" aria-label="The worker's live dashboard: it finds the graphics card and connects to the node, then a drill bores through rock while it trains, an ore cart fills as results are committed, and gold flies when a block pays.">
      <div className="flex items-center gap-3.5 px-4 py-2.5 border-b border-white/[0.07] font-mono text-[0.82rem] font-semibold text-mute">
        <span className="lights inline-flex gap-[7px]" aria-hidden="true"><i /><i /><i /></span>
        <span><span className="text-dim">&gt;</span> vibehash worker</span>
        <span className="ml-auto inline-flex items-center gap-2 text-[0.68rem] tracking-wider uppercase text-dim">
          <span className={"w-1.5 h-1.5 rounded-full " + (net ? "bg-good" : "bg-dim")} />
          {net ? "replay · live block #" + int(net.height) : "replay"}
        </span>
      </div>
      <div className="tscreen px-4 sm:px-5 pt-4 pb-4" data-t="screen" aria-hidden="true">
        <span className="tprobe" data-t="probe">00000000000000000000</span>
        <pre className="tboot" data-t="boot" />
        <div data-t="dash" hidden>
          <div className="thead">
            <svg className="tbanner" data-t="banner" preserveAspectRatio="none" shapeRendering="crispEdges" />
            <div className="ttails"><span className="c-dim" data-t="chain">useful-work miner  ·  vibehash-public-1</span><span className="c-dim" data-t="addr" /></div>
          </div>
          <canvas className="tmine" data-t="mine" />
          <pre className="tlines" data-t="lines" />
        </div>
      </div>
      <figcaption className="px-4 py-2.5 border-t border-white/[0.07] text-[0.82rem] text-dim">
        A replay of one rig's rounds, drawn the way <code className="font-mono text-mute">vibehash worker</code> draws them. Round and block numbers follow the live testnet.
      </figcaption>
    </figure>
  );
}
