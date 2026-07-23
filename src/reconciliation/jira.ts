// Jira reconciler: projects canonical state onto the epic and all of its tasks
// as hallmark:* labels. Idempotent.
import fs from "node:fs";
import path from "node:path";
import { jiraEpicFile, jiraTasksDir } from "../paths.ts";
import { labelsForState } from "../state-machine.ts";
import { readRun, updateRun } from "../run-store.ts";
import { readJson } from "../util.ts";
import { fileExists, relabelFile } from "./labels.ts";

export type ReconcileOutcome = { synced: boolean };

export function reconcileJira(runId: string): ReconcileOutcome {
  const run = readRun(runId);
  const desired = labelsForState(run.state);
  const epicPath = jiraEpicFile(runId);

  // Nothing to project yet (epic not created before SPECIFIED).
  if (!fileExists(epicPath)) {
    setProjection(runId, "pending", null);
    return { synced: false };
  }

  relabelFile(epicPath, desired);

  // Relabel every task belonging to this epic.
  const tasksDir = jiraTasksDir();
  if (fs.existsSync(tasksDir)) {
    for (const f of fs.readdirSync(tasksDir).filter((f) => f.endsWith(".json"))) {
      const file = path.join(tasksDir, f);
      const task = readJson<{ epic?: string }>(file);
      if (task.epic === runId) relabelFile(file, desired);
    }
  }

  setProjection(runId, "synced", run.revision);
  return { synced: true };
}

function setProjection(
  runId: string,
  status: "pending" | "synced" | "failed",
  reconciledRevision: number | null,
  error: string | null = null,
): void {
  const run = readRun(runId);
  updateRun(runId, run.revision, (r) => {
    r.projections.jira = {
      status,
      lastReconciledRevision:
        status === "synced" ? reconciledRevision : r.projections.jira.lastReconciledRevision,
      lastError: error,
    };
    return r;
  });
}

// Record a failed reconciliation without touching canonical state.
export function markJiraFailed(runId: string, error: string): void {
  setProjection(runId, "failed", null, error);
}
