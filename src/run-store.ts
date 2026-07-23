// The run store owns the canonical JSON files under .hallmark/runs/.
// It is the ONLY module that writes canonical run state, and it enforces
// optimistic concurrency via the `revision` field.
import fs from "node:fs";
import path from "node:path";
import type { RunState } from "./types.ts";
import { WORKFLOW_VERSION } from "./state-machine.ts";
import { runFile, runsDir } from "./paths.ts";
import { HallmarkError, ensureDir, nowIso, readJson, writeJsonAtomic } from "./util.ts";

export function runExists(runId: string): boolean {
  return fs.existsSync(runFile(runId));
}

export function readRun(runId: string): RunState {
  if (!runExists(runId)) {
    throw new HallmarkError(`Run ${runId} does not exist.`);
  }
  return readJson<RunState>(runFile(runId));
}

export function listRuns(): RunState[] {
  const dir = runsDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson<RunState>(path.join(dir, f)))
    .sort((a, b) => a.runId.localeCompare(b.runId));
}

export function activeRun(): RunState | null {
  return listRuns().find((r) => r.active) ?? null;
}

export function createRun(runId: string, title: string): RunState {
  if (runExists(runId)) {
    throw new HallmarkError(`Run ${runId} already exists.`);
  }
  const now = nowIso();
  const run: RunState = {
    runId,
    title,
    workflowVersion: WORKFLOW_VERSION,
    state: "STARTED",
    revision: 1,
    createdAt: now,
    updatedAt: now,
    active: true,
    currentStep: "spec",
    evidence: {},
    projections: {
      jira: { status: "pending", lastReconciledRevision: null, lastError: null },
      gitlab: { status: "pending", lastReconciledRevision: null, lastError: null },
    },
  };
  ensureDir(runsDir());
  writeJsonAtomic(runFile(runId), run);
  return run;
}

/**
 * Update a run under optimistic concurrency control.
 *
 * Re-reads the file, refuses the write if the on-disk revision no longer
 * matches `expectedRevision` (someone else modified it in between), applies
 * `mutator` to a clone, refreshes `updatedAt`, and writes atomically.
 *
 * The mutator is responsible for setting the new `revision` value:
 *  - state transitions bump it (expected + 1);
 *  - projection reconciliation leaves it unchanged.
 */
export function updateRun(
  runId: string,
  expectedRevision: number,
  mutator: (run: RunState) => RunState,
): RunState {
  const current = readRun(runId);
  if (current.revision !== expectedRevision) {
    throw new HallmarkError(
      `Optimistic concurrency conflict on ${runId}: expected revision ` +
        `${expectedRevision}, but on-disk revision is ${current.revision}. ` +
        `Re-read the run and retry.`,
    );
  }
  const next = mutator(structuredClone(current));
  next.updatedAt = nowIso();
  writeJsonAtomic(runFile(runId), next);
  return next;
}
