export function fmt(n: number | null | undefined, d = 1): string {
  if (n === null || n === undefined || isNaN(n as number)) return "—";
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function money(n: number): string {
  return "$" + Math.round(n).toLocaleString();
}

export function pct(x: number | null | undefined): string {
  if (x === null || x === undefined) return "—";
  return (x * 100).toFixed(0) + "%";
}

export function monthOf(dateStr: string): string {
  return (dateStr || "").slice(0, 7);
}

export function periodKindLabel(kind: string): string {
  if (kind === "quarter") return "Qtr";
  if (kind === "month") return "Mo";
  if (kind === "ytd") return "YTD";
  return "";
}
