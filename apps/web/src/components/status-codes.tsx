import { fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAMES: Record<string, string> = {
  "200": "OK",
  "201": "Created",
  "204": "No content",
  "301": "Moved",
  "400": "Bad request",
  "401": "Unauthorized",
  "403": "Forbidden",
  "404": "Not found",
  "429": "Too many requests",
  "500": "Server error",
  "502": "Bad gateway",
  "503": "Unavailable",
  "504": "Gateway timeout",
};

function toneFor(code: string) {
  const n = Number(code);
  if (n === 429) return "text-warning-text";
  if (n >= 500) return "text-danger-text";
  if (n >= 400) return "text-warning-text";
  return "text-success-text";
}

/** Status code distribution. Always shows the common codes (even at zero count) plus anything else observed. */
export function StatusCodeGrid({ codes, total }: { codes: Record<string, number> | undefined; total?: number }) {
  const base = ["200", "429", "500", "502", "504"];
  const extra = Object.keys(codes ?? {}).filter((c) => !base.includes(c)).sort();
  const all = [...base, ...extra];
  const sum = total ?? Object.values(codes ?? {}).reduce((a, b) => a + b, 0);

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {all.map((code) => {
        const n = codes?.[code] ?? 0;
        const share = sum > 0 ? (n / sum) * 100 : 0;
        return (
          <div key={code} className="rounded-xl border border-border bg-card p-3.5">
            <dt className="flex items-baseline gap-1.5">
              <span className={cn("font-mono text-sm font-semibold", toneFor(code))}>{code}</span>
              <span className="truncate text-xs text-muted-foreground">{NAMES[code] ?? "Other"}</span>
            </dt>
            <dd className="mt-1.5 font-mono text-xl font-semibold tnum">{fmtInt(n)}</dd>
            <dd className="mt-0.5 font-mono text-[11px] text-muted-foreground">{share.toFixed(share > 0 && share < 1 ? 2 : 1)}%</dd>
          </div>
        );
      })}
    </dl>
  );
}
