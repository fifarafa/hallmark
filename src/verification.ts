// Independent evidence verification. This is the runner's gate: it re-checks
// the artifacts (and RE-RUNS tests) itself. A skill's `success: true` never
// reaches here — only the files it left behind are trusted, and only after
// this module confirms them.
import fs from "node:fs";
import path from "node:path";
import type { RunState, State, Verdict } from "./types.ts";
import {
  artifactsDir,
  featureImplFile,
  gitlabMrDir,
  jiraEpicFile,
  jiraTasksDir,
} from "./paths.ts";
import { readJson } from "./util.ts";
import { runFeatureTests } from "./feature-tests.ts";

const ok: Verdict = { ok: true, reason: "" };
const fail = (reason: string): Verdict => ({ ok: false, reason });

function exists(file: string): boolean {
  return fs.existsSync(file);
}

// Verify the evidence required to legally enter `target` state for this run.
export function verifyTransition(target: State, run: RunState): Verdict {
  switch (target) {
    case "SPECIFIED":
      return verifySpecified(run);
    case "PLANNED":
      return verifyPlanned(run);
    case "BUILT":
      return verifyBuilt(run);
    case "REVIEWED":
      return verifyReviewed(run);
    case "SHIPPED":
      return verifyShipped(run);
    default:
      return fail(`No verifier for target state ${target}.`);
  }
}

function verifySpecified(run: RunState): Verdict {
  const specPath = path.join(artifactsDir(run.runId), "spec.md");
  const epicPath = jiraEpicFile(run.runId);
  if (!exists(specPath)) return fail(`spec artifact missing at ${specPath}.`);
  if (!exists(epicPath)) return fail(`Jira epic missing at ${epicPath}.`);

  const epic = readJson<{ key: string }>(epicPath);
  if (epic.key !== run.runId) {
    return fail(`epic key ${epic.key} does not match run ${run.runId}.`);
  }
  const spec = fs.readFileSync(specPath, "utf8");
  if (!spec.includes("## Acceptance Criteria")) {
    return fail("spec is missing an Acceptance Criteria section.");
  }
  if (!spec.includes("Definition of Done")) {
    return fail("spec is missing an executable Definition of Done.");
  }
  return ok;
}

function verifyPlanned(run: RunState): Verdict {
  const planPath = path.join(artifactsDir(run.runId), "plan.md");
  if (!exists(planPath)) return fail(`plan artifact missing at ${planPath}.`);

  const tasksDir = jiraTasksDir();
  const taskFiles = exists(tasksDir)
    ? fs.readdirSync(tasksDir).filter((f) => f.endsWith(".json"))
    : [];
  const tasks = taskFiles
    .map((f) => readJson<{ key: string; epic: string }>(path.join(tasksDir, f)))
    .filter((t) => t.epic === run.runId);

  if (tasks.length !== 3) {
    return fail(`expected exactly 3 tasks for ${run.runId}, found ${tasks.length}.`);
  }
  const keys = new Set(tasks.map((t) => t.key));
  if (keys.size !== tasks.length) return fail("task keys are not unique.");
  if (!tasks.every((t) => t.epic === run.runId)) {
    return fail(`not all tasks reference epic ${run.runId}.`);
  }
  const plan = fs.readFileSync(planPath, "utf8");
  if (!/Acceptance Criteria/i.test(plan)) {
    return fail("plan does not reference the Acceptance Criteria.");
  }
  return ok;
}

function verifyBuilt(run: RunState): Verdict {
  const impl = featureImplFile(run.runId);
  const reportPath = path.join(artifactsDir(run.runId), "build-report.md");
  const testOutputPath = path.join(artifactsDir(run.runId), "test-output.txt");

  if (!exists(impl)) return fail(`implementation missing at ${impl}.`);
  if (!exists(reportPath)) return fail(`build report missing at ${reportPath}.`);
  if (!exists(testOutputPath)) return fail(`test output missing at ${testOutputPath}.`);

  const code = fs.readFileSync(impl, "utf8");
  if (/TODO|FIXME/.test(code)) return fail("implementation contains TODO/FIXME.");

  // Do not trust the report — re-run the tests ourselves.
  const testRun = runFeatureTests(run.runId);
  if (testRun.code !== 0) {
    return fail(`automated tests returned exit code ${testRun.code}.`);
  }
  return ok;
}

function verifyReviewed(run: RunState): Verdict {
  const reviewPath = path.join(artifactsDir(run.runId), "review.md");
  if (!exists(reviewPath)) return fail(`review artifact missing at ${reviewPath}.`);

  const review = fs.readFileSync(reviewPath, "utf8");
  if (/Decision:\s*CHANGES_REQUESTED/.test(review)) {
    return fail("review decision is CHANGES_REQUESTED.");
  }
  if (!/Decision:\s*APPROVED/.test(review)) {
    return fail("review decision is not exactly APPROVED.");
  }
  // Re-run the tests too — a review is not a substitute for green tests.
  const testRun = runFeatureTests(run.runId);
  if (testRun.code !== 0) {
    return fail(`automated tests returned exit code ${testRun.code}.`);
  }
  return ok;
}

function verifyShipped(run: RunState): Verdict {
  const dir = gitlabMrDir();
  const mrFiles = exists(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith(".json"))
    : [];
  const mr = mrFiles
    .map((f) => readJson<Record<string, unknown>>(path.join(dir, f)))
    .find((m) => m.relatedTicket === run.runId);

  if (!mr) return fail(`no merge request found for ${run.runId}.`);
  if (mr.relatedTicket !== run.runId) return fail("merge request ticket mismatch.");
  if (mr.title !== `${run.runId}: ${run.title}`) {
    return fail(`merge request title mismatch: got "${String(mr.title)}".`);
  }
  if (mr.state !== "opened") return fail(`merge request state is ${String(mr.state)}.`);

  const shipReport = path.join(artifactsDir(run.runId), "ship-report.md");
  if (!exists(shipReport)) return fail(`ship report missing at ${shipReport}.`);

  // Tests must still pass and the review must still be APPROVED.
  const reviewPath = path.join(artifactsDir(run.runId), "review.md");
  if (!exists(reviewPath)) return fail("review artifact missing.");
  if (!/Decision:\s*APPROVED/.test(fs.readFileSync(reviewPath, "utf8"))) {
    return fail("review is not APPROVED.");
  }
  const testRun = runFeatureTests(run.runId);
  if (testRun.code !== 0) {
    return fail(`automated tests returned exit code ${testRun.code}.`);
  }
  return ok;
}
