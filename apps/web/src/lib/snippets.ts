import type { TestRun } from "./types";

type SnippetInput = {
  projectId: string;
  name: string;
  profile: string;
  concurrency: number;
  durationSec: number;
  baselineRunId?: string;
  apiUrl: string;
};

/** Generated from the current REST contract (POST /v1/load-tests, GET /v1/load-tests/:id, GET /v1/compare). */
export function snippetInputFromRun(run: TestRun, apiUrl: string): SnippetInput {
  return {
    projectId: run.projectId,
    name: "PR gate",
    profile: run.profile,
    concurrency: run.concurrency,
    durationSec: run.durationSec,
    baselineRunId: run.id,
    apiUrl,
  };
}

export function curlSnippet(i: SnippetInput): string {
  return `curl -sS -X POST "${i.apiUrl}/v1/load-tests" \\
  -H "Authorization: Bearer $STRIM_API_KEY" \\
  -H "x-organization-id: $STRIM_ORG_ID" \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectId": "${i.projectId}",
    "name": "${i.name}",
    "profile": "${i.profile}",
    "concurrency": ${i.concurrency},
    "durationSec": ${i.durationSec}
  }'`;
}

export function githubActionsSnippet(i: SnippetInput): string {
  const baseline = i.baselineRunId ?? "<BASELINE_RUN_ID>";
  const wait = Math.max(120, i.durationSec * 3);
  return `name: STRIM performance gate
on: [pull_request]

jobs:
  benchmark-gate:
    runs-on: ubuntu-latest
    env:
      STRIM_API_URL: ${i.apiUrl}
      STRIM_API_KEY: \${{ secrets.STRIM_API_KEY }}
      STRIM_ORG_ID: \${{ secrets.STRIM_ORG_ID }}
      BASELINE_RUN_ID: "${baseline}"
    steps:
      - name: Start load test
        id: start
        run: |
          RUN_ID=$(curl -sS -X POST "$STRIM_API_URL/v1/load-tests" \\
            -H "Authorization: Bearer $STRIM_API_KEY" \\
            -H "x-organization-id: $STRIM_ORG_ID" \\
            -H "Content-Type: application/json" \\
            -d '{"projectId":"${i.projectId}","name":"PR #\${{ github.event.number }} gate","profile":"${i.profile}","concurrency":${i.concurrency},"durationSec":${i.durationSec}}' \\
            | jq -r '.run.id')
          echo "run_id=$RUN_ID" >> "$GITHUB_OUTPUT"

      - name: Wait for completion
        run: |
          for i in $(seq 1 ${wait}); do
            STATUS=$(curl -sS "$STRIM_API_URL/v1/load-tests/\${{ steps.start.outputs.run_id }}" \\
              -H "Authorization: Bearer $STRIM_API_KEY" \\
              -H "x-organization-id: $STRIM_ORG_ID" | jq -r '.run.status')
            case "$STATUS" in
              COMPLETED) exit 0 ;;
              FAILED|ABORTED|CANCELLED) echo "Run ended with $STATUS"; exit 1 ;;
            esac
            sleep 2
          done
          echo "Timed out waiting for the run"; exit 1

      - name: Compare against baseline
        run: |
          curl -sS "$STRIM_API_URL/v1/compare?runA=$BASELINE_RUN_ID&runB=\${{ steps.start.outputs.run_id }}" \\
            -H "Authorization: Bearer $STRIM_API_KEY" \\
            -H "x-organization-id: $STRIM_ORG_ID" > compare.json
          cat compare.json | jq '.comparison.deltas'
          # Fail the check if P95 slows by more than 10% or throughput drops by more than 10%.
          jq -e '.comparison.deltas | (.p95LatencyDeltaPct <= 10) and (.avgRpsDeltaPct >= -10)' compare.json`;
}

export const SECRETS_NOTE =
  "Store STRIM_API_KEY and STRIM_ORG_ID as repository secrets. Never commit tokens to your repository.";
