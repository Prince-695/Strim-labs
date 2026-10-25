"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, GitBranch, Gauge, Rocket, Terminal } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { PRESETS } from "@/lib/presets";
import { githubActionsSnippet, curlSnippet, SECRETS_NOTE } from "@/lib/snippets";
import { CodeBlock } from "../code-block";
import { Alert } from "../ui/alert";
import { Tabs } from "../ui/tabs";

type Section = "quickstart" | "presets" | "capacity" | "api" | "ci-cd";

const ITEMS = [
  { value: "quickstart" as const, label: "Quickstart", icon: <Rocket className="size-4" /> },
  { value: "presets" as const, label: "Load presets", icon: <Gauge className="size-4" /> },
  { value: "capacity" as const, label: "Capacity and telemetry", icon: <BookOpen className="size-4" /> },
  { value: "api" as const, label: "REST API", icon: <Terminal className="size-4" /> },
  { value: "ci-cd" as const, label: "CI/CD integration", icon: <GitBranch className="size-4" /> },
];

const API_URL = "https://api.strim.dev";

export function DocsView() {
  const [tab, setTab] = useState<Section>("quickstart");

  // Deep links such as /docs#ci-cd.
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace("#", "") as Section;
      if (ITEMS.some((i) => i.value === h)) setTab(h);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  function select(v: Section) {
    setTab(v);
    history.replaceState(null, "", `#${v}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:py-16">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <h1 className="mb-4 px-3 text-sm font-semibold">Documentation</h1>
        <Tabs variant="rail" label="Documentation sections" items={ITEMS} value={tab} onValueChange={select} className="max-lg:flex-row max-lg:overflow-x-auto max-lg:pb-2" />
      </aside>

      <article className="min-w-0 max-w-[760px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="space-y-6">
            {tab === "quickstart" && <Quickstart />}
            {tab === "presets" && <Presets />}
            {tab === "capacity" && <Capacity />}
            {tab === "api" && <Api />}
            {tab === "ci-cd" && <CiCd />}
          </motion.div>
        </AnimatePresence>
      </article>
    </div>
  );
}

function H({ children }: { children: ReactNode }) {
  return <h2 className="text-[28px] font-semibold tracking-[-0.03em]">{children}</h2>;
}
function H3({ children }: { children: ReactNode }) {
  return <h3 className="pt-4 text-lg font-semibold tracking-tight">{children}</h3>;
}
function P({ children }: { children: ReactNode }) {
  return <p className="text-[15px] leading-[1.75] text-muted-foreground">{children}</p>;
}
function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground">{children}</code>;
}

function Quickstart() {
  return (
    <>
      <H>Quickstart: your first test in 60 seconds</H>
      <P>You need Bun 1.2+ and Docker for the local PostgreSQL container. These steps run the whole stack on your machine.</P>
      <CodeBlock
        language="bash"
        code={`git clone https://github.com/Prince-695/Strim.git
cd Strim
bun install
cp .env.example .env

docker compose -f infra/docker-compose.yml up -d
bun run db:push
bun run db:seed

bun run dev`}
      />
      <P>
        The console opens at <Code>http://localhost:3000</Code> and the API at <Code>http://localhost:8080</Code>. Sign in with the seeded demo account: <Code>priya@acme.test</Code> / <Code>password123</Code>.
      </P>
      <H3>Run against the built-in demo target</H3>
      <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-[1.75] text-muted-foreground">
        <li>Open the Load runner and choose <strong className="text-foreground">Use local demo API</strong>. It targets <Code>http://localhost:3001/health</Code>.</li>
        <li>Select <strong className="text-foreground">Smoke Probe</strong>.</li>
        <li>Tick the authorisation box and choose <strong className="text-foreground">Launch test run</strong>.</li>
        <li>Watch throughput, P95 latency and active users stream in. When it finishes you land on the results page.</li>
      </ol>
      <Alert tone="info" title="Only test what you're allowed to test">
        STRIM sends real traffic. Point it at endpoints you own or have explicit permission to load.
      </Alert>
    </>
  );
}

function Presets() {
  return (
    <>
      <H>Load presets</H>
      <P>Presets are starting points, not safety guarantees. The server enforces its own concurrency and duration limits, and you can edit every value before launching.</P>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Preset</th>
              <th className="px-4 py-2.5 font-medium">Users</th>
              <th className="px-4 py-2.5 font-medium">Duration</th>
              <th className="px-4 py-2.5 font-medium">Shape</th>
            </tr>
          </thead>
          <tbody>
            {PRESETS.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 font-mono">{p.concurrency}</td>
                <td className="px-4 py-3 font-mono">{p.durationSec}s</td>
                <td className="px-4 py-3 text-muted-foreground">{p.curveLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {PRESETS.map((p) => (
        <div key={p.id}>
          <H3>{p.name}</H3>
          <P>{p.blurb}</P>
        </div>
      ))}
      <P>
        Breaking Point Hunt aims to expose the failure mode: HTTP 429 means a rate limiter pushed back, while 504 points to a gateway timing out. Neither confirms the underlying cause on its own.
      </P>
    </>
  );
}

function Capacity() {
  return (
    <>
      <H>Capacity and telemetry</H>
      <H3>Percentiles</H3>
      <P>
        <strong className="text-foreground">P50</strong> is the median request. <strong className="text-foreground">P95</strong> means 95% of requests were at least that fast, which makes it a good read on tail latency. P99 is the slowest 1% boundary. STRIM reports percentiles, not averages, because averages hide the slow requests users actually notice.
      </P>
      <H3>The three zones</H3>
      <ul className="list-disc space-y-2 pl-5 text-[15px] leading-[1.75] text-muted-foreground">
        <li><strong className="text-foreground">Safe band:</strong> latency is flat and throughput rises with load.</li>
        <li><strong className="text-foreground">Saturation knee:</strong> latency curves upward and throughput stops scaling.</li>
        <li><strong className="text-foreground">Breaking cliff:</strong> 429s, 5xx or timeouts surge.</li>
      </ul>
      <H3>Evidence-based diagnosis</H3>
      <P>
        Every finished run shows three parts: <em>Observed</em> facts read directly from the data, a <em>Likely explanation</em> worded as a hypothesis, and <em>Next checks</em> to confirm it. If the run was too short or too light to tell, the page says “insufficient evidence” rather than inventing a limit. A clean run proves the API handled that load, not that capacity is unlimited.
      </P>
      <H3>Live telemetry</H3>
      <P>Samples arrive every 500 ms over server-sent events. If the connection drops, the console reconnects and keeps the samples it already had; it never fills gaps with made-up values.</P>
    </>
  );
}

function Api() {
  return (
    <>
      <H>REST API</H>
      <P>
        Every request needs <Code>Authorization: Bearer &lt;API_KEY_OR_JWT&gt;</Code> and, on workspace routes, <Code>x-organization-id</Code>.
      </P>
      <H3>Start a load test</H3>
      <CodeBlock
        language="http"
        code={`POST /v1/load-tests
Content-Type: application/json

{
  "projectId": "proj_12345",
  "name": "Release v2.4 capacity probe",
  "profile": "RAMP_UP",
  "concurrency": 50,
  "durationSec": 30
}`}
      />
      <H3>Stream live telemetry</H3>
      <CodeBlock language="http" code={`GET /v1/load-tests/:id/stream\nAccept: text/event-stream`} />
      <P>Events: <Code>sample</Code> every 500 ms, then <Code>done</Code> with the final run, or <Code>abort</Code> if cancelled.</P>
      <H3>Abort a run</H3>
      <CodeBlock language="http" code={`POST /v1/load-tests/:id/abort`} />
      <P>Cancels all in-flight workers in under 200 ms and marks the run aborted.</P>
      <H3>Compare two runs</H3>
      <CodeBlock language="http" code={`GET /v1/compare?runA=<BASELINE_ID>&runB=<CANDIDATE_ID>`} />
      <P>Returns latency, throughput and error deltas for the pair.</P>
    </>
  );
}

function CiCd() {
  const input = { projectId: "<PROJECT_ID>", name: "PR gate", profile: "RAMP_UP", concurrency: 50, durationSec: 30, apiUrl: API_URL };
  return (
    <>
      <H>CI/CD integration</H>
      <P>Start a run on every pull request, wait for it to finish, then compare it with a baseline run and fail the check on a regression.</P>
      <H3>GitHub Actions</H3>
      <CodeBlock language="yaml" code={githubActionsSnippet(input)} />
      <H3>cURL</H3>
      <CodeBlock language="bash" code={curlSnippet(input)} />
      <Alert tone="warning" title="Keep keys out of your repository">
        {SECRETS_NOTE} Create a key under <Link href="/settings" className="font-medium underline">Settings</Link> after signing in.
      </Alert>
    </>
  );
}
