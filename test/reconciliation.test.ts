import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { makeHome, clearHome } from "./helpers.ts";
import { projectLabels } from "../src/reconciliation/labels.ts";
import { reconcileGitlab } from "../src/reconciliation/gitlab.ts";
import { markGitlabFailed } from "../src/reconciliation/gitlab.ts";
import { createRun, readRun, updateRun } from "../src/run-store.ts";
import { gitlabMrFile } from "../src/paths.ts";
import { writeJsonAtomic, readJson } from "../src/util.ts";

beforeEach(() => makeHome());
afterEach(() => clearHome());

test("projectLabels replaces the previous hallmark:* label", () => {
  const result = projectLabels(["hallmark:built"], ["hallmark:reviewed"]);
  assert.deepEqual(result, ["hallmark:reviewed"]);
  assert.equal(result.filter((l) => l.startsWith("hallmark:")).length, 1);
});

test("projectLabels preserves labels outside the hallmark namespace", () => {
  const result = projectLabels(
    ["team:payments", "hallmark:planned", "priority:high"],
    ["hallmark:built"],
  );
  assert.deepEqual(result, ["team:payments", "priority:high", "hallmark:built"]);
});

test("projectLabels is idempotent", () => {
  const once = projectLabels(["hallmark:shipped"], ["hallmark:shipped"]);
  const twice = projectLabels(once, ["hallmark:shipped"]);
  assert.deepEqual(once, ["hallmark:shipped"]);
  assert.deepEqual(twice, ["hallmark:shipped"]);
});

// Build a minimal SHIPPED run with an MR so gitlab reconciliation has a target.
function shippedRunWithMr(runId: string): void {
  createRun(runId, "Failure demo");
  updateRun(runId, 1, (r) => {
    r.state = "SHIPPED";
    r.revision = 6;
    r.active = false;
    return r;
  });
  writeJsonAtomic(gitlabMrFile(1), {
    iid: 1,
    title: `${runId}: Failure demo`,
    state: "opened",
    labels: [],
    relatedTicket: runId,
  });
}

test("gitlab failure is one-time, then reconcile heals it", () => {
  shippedRunWithMr("DEMO-2");

  // Simulate the runner's behaviour: first reconcile throws, projection failed.
  process.env.SIMULATE_GITLAB_FAILURE_ONCE = "1";
  assert.throws(() => reconcileGitlab("DEMO-2"));
  markGitlabFailed("DEMO-2", "Simulated GitLab outage (one-time).");
  assert.equal(readRun("DEMO-2").projections.gitlab.status, "failed");

  // Canonical state was untouched by the projection failure.
  assert.equal(readRun("DEMO-2").state, "SHIPPED");
  assert.equal(readRun("DEMO-2").revision, 6);

  // A second reconcile (marker already consumed) succeeds and heals.
  const outcome = reconcileGitlab("DEMO-2");
  assert.equal(outcome.synced, true);
  assert.equal(readRun("DEMO-2").projections.gitlab.status, "synced");
  assert.deepEqual(readJson<{ labels: string[] }>(gitlabMrFile(1)).labels, ["hallmark:shipped"]);
});

test("reconcileGitlab is idempotent (no duplicate labels)", () => {
  shippedRunWithMr("DEMO-3");
  reconcileGitlab("DEMO-3");
  reconcileGitlab("DEMO-3");
  assert.deepEqual(readJson<{ labels: string[] }>(gitlabMrFile(1)).labels, ["hallmark:shipped"]);
});
