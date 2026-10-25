import { Eye, Lightbulb, ListChecks } from "lucide-react";
import { BOTTLENECK_LABEL, type Diagnosis } from "@/lib/analysis";
import type { BreakingPointAnalysis } from "@/lib/types";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

export function DiagnosisCard({ diagnosis, breakingPoint }: { diagnosis: Diagnosis; breakingPoint?: BreakingPointAnalysis | null }) {
  const tone = diagnosis.quality === "ok" ? "brand" : diagnosis.quality === "none" ? "info" : "warning";
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>Evidence-based diagnosis</CardTitle>
          <CardDescription>{diagnosis.qualityNote}</CardDescription>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {breakingPoint && breakingPoint.bottleneck !== "NONE" && <Badge tone="outline">{BOTTLENECK_LABEL[breakingPoint.bottleneck]}</Badge>}
          <Badge tone={tone}>
            {diagnosis.quality === "ok" ? "Breaking point estimated" : diagnosis.quality === "none" ? "None observed" : "Insufficient evidence"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-3">
        <Section icon={<Eye className="size-4" />} title="Observed">
          <ul className="space-y-2">
            {diagnosis.observed.length ? (
              diagnosis.observed.map((o) => (
                <li key={o} className="flex gap-2 text-[13px] leading-relaxed">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-brand" aria-hidden />
                  <span>{o}</span>
                </li>
              ))
            ) : (
              <li className="text-[13px] text-muted-foreground">No measurements were recorded for this run.</li>
            )}
          </ul>
        </Section>
        <Section icon={<Lightbulb className="size-4" />} title="Likely explanation">
          <p className="text-[13px] leading-relaxed">{diagnosis.hypothesis}</p>
          <p className="mt-3 text-xs text-muted-foreground">A hypothesis from the signals above, not a confirmed root cause.</p>
        </Section>
        <Section icon={<ListChecks className="size-4" />} title="Next checks">
          <ul className="space-y-2">
            {diagnosis.nextChecks.map((c) => (
              <li key={c} className="flex gap-2 text-[13px] leading-relaxed">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </Section>
      </CardContent>
    </Card>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="grid size-6 place-items-center rounded-md bg-surface-muted text-muted-foreground">{icon}</span>
        {title}
      </h4>
      {children}
    </section>
  );
}
