// GitLab reconciler: projects canonical state onto the run's merge request as
// hallmark:* labels — only once an MR exists (i.e. from SHIPPED onward). Idempotent.
//
// Supports a one-time simulated outage: with SIMULATE_GITLAB_FAILURE_ONCE=1 the
// first reconcile that finds an MR throws, and a local marker file guarantees
// the failure happens at most once so a later `reconcile` heals the projection.
import fs from "node:fs";
import path from "node:path";
import { gitlabMrDir, markerFile, markersDir } from "../paths.ts";
import { labelsForState } from "../state-machine.ts";
import { readRun, updateRun } from "../run-store.ts";
import { ensureDir, readJson } from "../util.ts";
import { relabelFile } from "./labels.ts";
import type { ReconcileOutcome } from "./jira.ts";

function findMrFile(runId: string): string | null {
  const dir = gitlabMrDir();
  if (!fs.existsSync(dir)) return null;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const file = path.join(dir, f);
    const mr = readJson<{ relatedTicket?: string }>(file);
    if (mr.relatedTicket === runId) return file;
  }
  return null;
}

export function reconcileGitlab(runId: string): ReconcileOutcome {
  const run = readRun(runId);
  const desired = labelsForState(run.state);
  const mrFile = findMrFile(runId);

  // No MR to project onto yet — nothing to reconcile.
  if (!mrFile) {
    setProjection(runId, "pending", null, null);
    return { synced: false };
  }

  // One-time simulated failure, gated by a persistent marker so it fires once.
  if (process.env.SIMULATE_GITLAB_FAILURE_ONCE === "1") {
    const marker = markerFile(runId, "gitlab-failure-consumed");
    if (!fs.existsSync(marker)) {
      ensureDir(markersDir());
      fs.writeFileSync(marker, "consumed\n");
      throw new Error("Simulated GitLab outage (one-time).");
    }
  }

  relabelFile(mrFile, desired);
  setProjection(runId, "synced", run.revision, null);
  return { synced: true };
}

function setProjection(
  runId: string,
  status: "pending" | "synced" | "failed",
  reconciledRevision: number | null,
  error: string | null,
): void {
  const run = readRun(runId);
  updateRun(runId, run.revision, (r) => {
    r.projections.gitlab = {
      status,
      lastReconciledRevision:
        status === "synced"
          ? reconciledRevision
          : r.projections.gitlab.lastReconciledRevision,
      lastError: error,
    };
    return r;
  });
}

// Exposed so the runner can record a failed reconciliation without reverting
// canonical state.
export function markGitlabFailed(runId: string, error: string): void {
  setProjection(runId, "failed", null, error);
}
