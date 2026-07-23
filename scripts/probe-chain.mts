// End-to-end proof of the agentic path: runs spec -> plan -> build -> review as
// real agents, and after each step applies the runner's OWN verifier to what the
// agent produced. Nothing here trusts the agent's success flag.
//
// Uses a scratch run id and never writes canonical state, so it neither disturbs
// existing runs nor trips the one-active-run WIP limit.
//
//   npx tsx scripts/probe-chain.mts [RUN_ID]
import { runAgenticSkill } from "../src/skills/sandcastle/index.ts";
import { verifyTransition } from "../src/verification.ts";
import type { RunState, State, Step } from "../src/types.ts";

const runId = process.argv[2] ?? "CHAIN-1";
const title = "Parse an ISO-8601 duration string into seconds";

// A stand-in run record for the verifier. It is never persisted — the point is
// to exercise verification, not to mutate canonical state.
const run: RunState = {
  runId,
  title,
  workflowVersion: "0.1.0",
  state: "STARTED",
  revision: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  active: true,
  currentStep: "spec",
  evidence: {},
  projections: {
    jira: { status: "pending", lastReconciledRevision: null, lastError: null },
    gitlab: { status: "pending", lastReconciledRevision: null, lastError: null },
  },
};

const STEPS: { step: Step; target: State }[] = [
  { step: "spec", target: "SPECIFIED" },
  { step: "plan", target: "PLANNED" },
  { step: "build", target: "BUILT" },
  { step: "review", target: "REVIEWED" },
];

let failures = 0;

for (const { step, target } of STEPS) {
  console.log(`\n${"=".repeat(64)}\n${step.toUpperCase()}  ->  ${target}\n${"=".repeat(64)}`);
  const started = Date.now();

  const result = await runAgenticSkill(step, { runId, title });
  const secs = ((Date.now() - started) / 1000).toFixed(0);

  console.log(`agent claims : ${result.success ? "success" : "FAILURE"}  (${secs}s)`);
  console.log(`  ${result.summary}`);

  if (!result.success) {
    failures++;
    break;
  }

  // The whole point: the agent said success. Check it independently.
  const verdict = verifyTransition(target, run);
  console.log(`runner verdict: ${verdict.ok ? "VERIFIED" : "REJECTED"}`);
  if (!verdict.ok) {
    console.log(`  reason: ${verdict.reason}`);
    failures++;
    break;
  }

  run.state = target;
  run.evidence[step] = result.evidencePaths[0] ?? "";
}

console.log(`\n${"=".repeat(64)}`);
console.log(failures === 0 ? `ALL STEPS VERIFIED (${run.state})` : `STOPPED at ${run.state}`);
process.exit(failures === 0 ? 0 : 1);
