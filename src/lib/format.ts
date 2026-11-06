export const SYN = 1e8; // the smallest unit: 1 VIBE is 10^8 syn

export const int = (n: number) => Math.round(n).toLocaleString("en-US");

export function vibe(syn: number, digits = 2): string {
  return (syn / SYN).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }) + " VIBE";
}

export function flopParts(n: number): [string, string] {
  const u = ["FLOP", "kFLOP", "MFLOP", "GFLOP", "TFLOP", "PFLOP", "EFLOP"];
  let i = 0;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return [n.toLocaleString("en-US", { maximumFractionDigits: n < 10 ? 2 : n < 100 ? 1 : 0 }), u[i]];
}

export function ago(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return s + " s ago";
  if (s < 3600) return Math.round(s / 60) + " min ago";
  if (s < 86400) return Math.round(s / 3600) + " h ago";
  return Math.round(s / 86400) + " d ago";
}

export function bytes(n: number): string {
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return n.toLocaleString("en-US", { maximumFractionDigits: n < 10 ? 1 : 0 }) + " " + u[i];
}

export const short = (addr: string) => (addr.length > 16 ? addr.slice(0, 10) + "…" + addr.slice(-4) : addr);
export const pct = (x: number) => (x * 100).toLocaleString("en-US", { maximumFractionDigits: 1 }) + "%";
