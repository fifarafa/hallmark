// The runner is the ONLY component allowed to change canonical state. It wires
// together: state machine -> skill -> independent verification -> atomic write
// -> history -> reconciliation. Skills declare; the runner decides.
import path from "node:path";
import type { RunState } from "./types.ts";
import { nextState, stepForState } from "./state-machine.ts";
import { base } from "./paths.ts";
import { readRun, updateRun } from "./run-store.ts";
import { appendEvent } from "./history.ts";
import { runSkill } from "./skills/index.ts";
import { verifyTransition } from "./verification.ts";
import { reconcileJira, markJiraFailed } from "./reconciliation/jira.ts";
import { reconcileGitlab, markGitlabFailed } from "./reconciliation/gitlab.ts";
import { HallmarkError } from "./util.ts";

export type StepOutcome = {
  transitioned: boolean;
  from: string;
  to: string | null;
  message: string;
};

// Reconcile both projections. A projection failure is recorded but never
// reverts canonical state — that is the whole point of the exercise.
export function reconcileAll(runId: string): void {
  try {
    const outcome = reconcileJira(runId);
    if (outcome.synced) {
      appendEvent(runId, {
        type: "PROJECTION_RECONCILED",
        projection: "jira",
        revision: readRun(runId).revision,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    markJiraFailed(runId, msg);
    appendEvent(runId, {
      type: "PROJECTION_FAILED",
      projection: "jira",
      revision: readRun(runId).revision,
      error: msg,
    });
  }

  try {
    const outcome = reconcileGitlab(runId);
    if (outcome.synced) {
      appendEvent(runId, {
        type: "PROJECTION_RECONCILED",
        projection: "gitlab",
        revision: readRun(runId).revision,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    markGitlabFailed(runId, msg);
    appendEvent(runId, {
      type: "PROJECTION_FAILED",
      projection: "gitlab",
      revision: readRun(runId).revision,
      error: msg,
    });
  }
}

// Execute exactly one legal step. Throws HallmarkError (with an actionable message)
// on skill failure or verification failure, leaving canonical state untouched.
export function advanceOne(runId: string): StepOutcome {
  const run = readRun(runId);
  const from = run.state;
  const step = stepForState(from);

  if (step === null) {
    return {
      transitioned: false,
      from,
      to: null,
      message: `Run ${runId} is already ${from}. Nothing to do.`,
    };
  }
  const to = nextState(from)!;

  // 1. Run the skill (it only produces artifacts + a declared result).
  const result = runSkill(step, { runId, title: run.title });
  if (!result.success) {
    appendEvent(runId, {
      type: "SKILL_FAILED",
      skill: step,
      revision: run.revision,
      error: result.summary,
    });
    throw new HallmarkError(
      `Skill '${step}' declared failure: ${result.summary}\n` +
        `Canonical state remains ${from}.`,
    );
  }
  appendEvent(runId, { type: "SKILL_COMPLETED", skill: step, revision: run.revision });

  // 2. Independently verify the evidence — success:true is not proof.
  const verdict = verifyTransition(to, run);
  if (!verdict.ok) {
    appendEvent(runId, {
      type: "VERIFICATION_FAILED",
      step,
      revision: run.revision,
      error: verdict.reason,
    });
    throw new HallmarkError(
      `${cap(step)} verification failed: ${verdict.reason}\n` +
        `Canonical state remains ${from}.`,
    );
  }

  // 3. Atomically write the new state under optimistic concurrency.
  const newRevision = run.revision + 1;
  updateRun(runId, run.revision, (r: RunState) => {
    r.state = to;
    r.revision = newRevision;
    r.currentStep = stepForState(to);
    const primary = result.evidencePaths[0] ?? "";
    r.evidence[step] = primary ? path.relative(base(), primary) : "";
    if (to === "SHIPPED") r.active = false;
    return r;
  });
  appendEvent(runId, { type: "STATE_TRANSITIONED", from, to, revision: newRevision });
  if (to === "SHIPPED") {
    appendEvent(runId, { type: "RUN_COMPLETED", revision: newRevision });
  }

  // 4. Reconcile projections (may partially fail without affecting state).
  reconcileAll(runId);

  return { transitioned: true, from, to, message: `${from} -> ${to}` };
}

// Run legal steps until the workflow completes, errors, or has nothing to do.
export function runToCompletion(runId: string): StepOutcome[] {
  const outcomes: StepOutcome[] = [];
  // Bounded loop: at most one step per state, so 6 is a safe hard cap.
  for (let i = 0; i < 8; i++) {
    const before = readRun(runId).state;
    if (stepForState(before) === null) break;
    const outcome = advanceOne(runId);
    outcomes.push(outcome);
    if (!outcome.transitioned) break;
  }
  return outcomes;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
