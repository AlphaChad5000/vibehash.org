import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useLive } from "../lib/node";
import { int } from "../lib/format";
import { MineBackground } from "./MineBackground";

export const REPO = "https://github.com/AlphaChad5000/vibehash";
export const DOCS = REPO + "/blob/main/docs/CLI.md";

// ---- the visitor's system: picks the install line and spells `python` or `python3` in every command ----
type OS = "win" | "unix";
const OSContext = createContext<{ os: OS; setOs: (o: OS) => void }>({ os: "win", setOs: () => {} });
export function OSProvider({ children }: { children: ReactNode }) {
  const [os, setOs] = useState<OS>(/Win/i.test(navigator.userAgent) ? "win" : "unix");
  return <OSContext.Provider value={{ os, setOs }}>{children}</OSContext.Provider>;
}
export const useOS = () => useContext(OSContext);
/** `python -m vibehash <cmd>`, as this system spells Python. */
export function Vh({ cmd }: { cmd: string }) {
  const { os } = useOS();
  return <>{((os === "win" ? "python" : "python3") + " -m vibehash " + cmd).trim()}</>;
}

export function Mark({ className = "w-[15px] h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 3 4" className={className + " text-signal"} aria-hidden="true">
      <path fill="currentColor" d="M0 0h1v3H0zM2 0h1v3H2zM1 3h1v1H1z" />
    </svg>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={"font-mono text-[0.75rem] font-semibold tracking-[0.08em] uppercase text-mute " + className}>{children}</p>;
}
export function H2({ id, children }: { id?: string; children: ReactNode }) {
  return <h2 id={id} className="mt-2 font-display text-[2rem] font-bold [font-stretch:108%] tracking-tight leading-tight">{children}</h2>;
}
export function Btn({ to, href, children, kind = "primary" }: { to?: string; href?: string; children: ReactNode; kind?: "primary" | "ghost" }) {
  const cls = kind === "primary"
    ? "inline-flex items-center gap-2 rounded-lg bg-signal text-[#1d1406] font-bold px-5 py-3 hover:brightness-110"
    : "inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] text-fg font-semibold px-5 py-3 hover:border-white/35";
  return to ? <Link to={to} className={cls}>{children}</Link> : <a href={href} className={cls}>{children}</a>;
}
export const linkCls = "text-fg underline decoration-dim underline-offset-4 hover:decoration-fg";

function TestnetBar() {
  return (
    <div className="bg-signal/10 border-b border-signal/25 text-sm">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono font-bold tracking-wider text-[0.72rem] uppercase text-signal border border-signal/40 rounded px-1.5 py-px">Testnet</span>
        <span className="text-fg/90">Vibe Hash is a public test network. Test VIBE has no cash value, so don't buy or sell it. The software is open source and unaudited.</span>
      </div>
    </div>
  );
}

function Nav() {
  const { status } = useLive();
  const item = ({ isActive }: { isActive: boolean }) => (isActive ? "text-fg" : "text-mute hover:text-fg");
  return (
    <nav className="flex items-center justify-between gap-4 py-4 border-b border-rule" aria-label="Site">
      <Link to="/" className="flex items-center gap-2.5 text-fg" aria-label="Vibe Hash home">
        <Mark />
        <b className="font-display text-lg font-extrabold [font-stretch:115%]">Vibe Hash</b>
        <span className="hidden sm:inline font-mono text-[0.68rem] tracking-wider uppercase text-mute border border-rule rounded px-1.5 py-px">Testnet · v{status?.version ?? "0.5.18"}</span>
      </Link>
      <div className="flex items-center gap-4 sm:gap-5 text-[0.95rem]">
        <NavLink className={item} to="/jobs">Jobs</NavLink>
        <NavLink className={item} to="/submit">Submit</NavLink>
        <NavLink className={item} to="/wallet">Wallet</NavLink>
        <a className="hidden md:inline text-mute hover:text-fg" href="/guide/">Guide</a>
        <a className="hidden sm:inline-flex items-center rounded-md bg-signal text-[#1d1406] font-bold px-3.5 py-1.5 hover:brightness-110" href="/#download">Download</a>
      </div>
    </nav>
  );
}

function Footer() {
  const { net, error } = useLive();
  return (
    <footer className="mt-24 border-t border-rule">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 grid gap-6">
        <div className="flex flex-wrap justify-between gap-6 items-start">
          <div className="grid gap-3">
            <span className="inline-flex items-center gap-2 font-display font-bold">
              <Mark className="w-3 h-4" />Vibe Hash
              <span className="font-mono text-[0.68rem] tracking-wider uppercase text-signal border border-signal/40 rounded px-1.5 py-px">Testnet</span>
            </span>
            <div className="flex flex-wrap gap-2 font-mono text-[0.75rem]" aria-label="Status">
              <Badge href="https://node.vibehash.org/status" k="node" v={error ? "unreachable" : net ? "online" : "checking"} cls={error ? "text-bad" : net ? "text-good" : "text-dim"} />
              <Badge href="https://node.vibehash.org/status" k="block" v={net ? "#" + int(net.height) : "–"} />
              <Badge href={REPO + "/releases/latest"} k="release" v="v0.5.18" />
              <Badge href={REPO + "/blob/main/LICENSE"} k="license" v="MIT" />
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[0.95rem]" aria-label="More">
            <a className="text-mute hover:text-fg" href={REPO}>Protocol on GitHub</a>
            <a className="text-mute hover:text-fg" href={DOCS}>CLI reference</a>
            <a className="text-mute hover:text-fg" href="/guide/">Guide</a>
            <a className="text-mute hover:text-fg" href="/whitepaper.pdf">Whitepaper</a>
            <a className="text-mute hover:text-fg" href="/network/">Network reports</a>
            <a className="text-mute hover:text-fg" href="https://node.vibehash.org/status">Node status</a>
          </nav>
        </div>
        <p className="text-sm text-dim">Unaudited test network software. Test VIBE has no cash value, so don't buy or sell it.</p>
        <p className="text-xs text-dim">All product names, logos and brands are property of their respective owners and are used purely for identification. Vibe Hash isn't affiliated with or endorsed by them.</p>
      </div>
    </footer>
  );
}

function Badge({ href, k, v, cls = "text-fg" }: { href: string; k: string; v: string; cls?: string }) {
  return (
    <a href={href} className="inline-flex rounded overflow-hidden border border-rule">
      <span className="bg-ink2 text-mute px-2 py-0.5">{k}</span><span className={"px-2 py-0.5 " + cls}>{v}</span>
    </a>
  );
}

/** Every page: the testnet bar, the nav (inside the hero's glow on the front page), the page, the footer. */
export function Layout({ children, hero }: { children: ReactNode; hero?: ReactNode }) {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return (
    <>
      <TestnetBar />
      <MineBackground />
      <header className="relative glow-bg">
        <div className="relative max-w-6xl mx-auto px-4 md:px-8">
          <Nav />
          {hero}
        </div>
      </header>
      <main>{children}</main>
      <Footer />
    </>
  );
}

/** A page's title block, for the pages after the front one. */
export function PageHead({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="pt-12 pb-10">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-2 font-display font-extrabold [font-stretch:108%] tracking-tight leading-tight text-[clamp(2rem,4.5vw,3rem)]">{title}</h1>
      {children && <div className="mt-3 text-lg text-mute max-w-3xl">{children}</div>}
    </div>
  );
}
