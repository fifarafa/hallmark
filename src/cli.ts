// CLI entrypoint. Parses argv with the standard library only and dispatches to
// the runner. All user-facing errors are HallmarkErrors printed as clean messages.
import { parseArgs } from "node:util";
import type { RunState } from "./types.ts";
import { stepForState } from "./state-machine.ts";
import {
  activeRun,
  createRun,
  listRuns,
  readRun,
  runExists,
} from "./run-store.ts";
import { appendEvent, readHistory } from "./history.ts";
import { advanceOne, reconcileAll, runToCompletion } from "./runner.ts";
import { HallmarkError } from "./util.ts";

function nextStepLabel(run: RunState): string {
  const step = stepForState(run.state);
  return step ?? "(done)";
}

function cmdStart(runId: string, title: string): void {
  const active = activeRun();
  if (active && active.runId !== runId) {
    throw new HallmarkError(
      `Cannot start ${runId}. Active run ${active.runId} is currently in ` +
        `state ${active.state}.\nNext legal step: ${nextStepLabel(active)}.\n` +
        `WIP is limited to one active run — finish (ship) ${active.runId} first.`,
    );
  }
  if (runExists(runId)) {
    throw new HallmarkError(`Run ${runId} already exists.`);
  }
  const run = createRun(runId, title);
  appendEvent(runId, { type: "RUN_STARTED", revision: run.revision });
  console.log(`Started ${runId} in state ${run.state}. Next step: ${nextStepLabel(run)}.`);
}

function cmdNext(runId: string): void {
  const outcome = advanceOne(runId);
  if (!outcome.transitioned) {
    console.log(outcome.message);
    return;
  }
  const run = readRun(runId);
  console.log(
    `${runId}: ${outcome.from} -> ${outcome.to} (revision ${run.revision}). ` +
      `Next step: ${nextStepLabel(run)}.`,
  );
}

function cmdRun(runId: string): void {
  const outcomes = runToCompletion(runId);
  if (outcomes.length === 0) {
    console.log(`${runId}: nothing to do (state ${readRun(runId).state}).`);
  } else {
    for (const o of outcomes) console.log(`${runId}: ${o.from} -> ${o.to}`);
  }
  const run = readRun(runId);
  console.log(`${runId}: final state ${run.state} (active: ${run.active}).`);
}

function cmdReconcile(runId: string): void {
  reconcileAll(runId);
  const run = readRun(runId);
  console.log(`Reconciled ${runId}.`);
  printProjections(run);
}

function cmdStatus(runId: string): void {
  const run = readRun(runId);
  console.log(`Run: ${run.runId}`);
  console.log(`Title: ${run.title}`);
  console.log(`State: ${run.state}`);
  console.log(`Revision: ${run.revision}`);
  console.log(`Active: ${run.active}`);
  console.log(`Next step: ${nextStepLabel(run)}`);
  console.log("");
  console.log("Projections:");
  printProjections(run, "  ");
  console.log("");
  console.log("Evidence:");
  const entries = Object.entries(run.evidence);
  if (entries.length === 0) {
    console.log("  (none yet)");
  } else {
    for (const [step, path] of entries) console.log(`  ${step}: ${path}`);
  }
}

function printProjections(run: RunState, indent = "  "): void {
  const j = run.projections.jira;
  const g = run.projections.gitlab;
  console.log(`${indent}Jira: ${describeProjection(j)}`);
  console.log(`${indent}GitLab: ${describeProjection(g)}`);
}

function describeProjection(p: RunState["projections"]["jira"]): string {
  if (p.status === "synced") return `synced at revision ${p.lastReconciledRevision}`;
  if (p.status === "failed") return `failed (${p.lastError})`;
  return "pending";
}

function cmdHistory(runId: string): void {
  const events = readHistory(runId);
  if (events.length === 0) {
    console.log(`No history for ${runId}.`);
    return;
  }
  console.log(`History for ${runId}:`);
  for (const e of events) {
    console.log(`  [rev ${e.revision}] ${formatEvent(e)}  (${e.at})`);
  }
}

function formatEvent(e: ReturnType<typeof readHistory>[number]): string {
  switch (e.type) {
    case "RUN_STARTED":
      return "RUN_STARTED";
    case "SKILL_COMPLETED":
      return `SKILL_COMPLETED skill=${e.skill}`;
    case "SKILL_FAILED":
      return `SKILL_FAILED skill=${e.skill} error=${e.error}`;
    case "VERIFICATION_FAILED":
      return `VERIFICATION_FAILED step=${e.step} error=${e.error}`;
    case "STATE_TRANSITIONED":
      return `STATE_TRANSITIONED ${e.from} -> ${e.to}`;
    case "PROJECTION_RECONCILED":
      return `PROJECTION_RECONCILED projection=${e.projection}`;
    case "PROJECTION_FAILED":
      return `PROJECTION_FAILED projection=${e.projection} error=${e.error}`;
    case "RUN_COMPLETED":
      return "RUN_COMPLETED";
    default:
      return JSON.stringify(e);
  }
}

function cmdList(): void {
  const runs = listRuns();
  if (runs.length === 0) {
    console.log("No runs.");
    return;
  }
  for (const r of runs) {
    const flag = r.active ? "* " : "  ";
    console.log(
      `${flag}${r.runId}  ${r.state}  (rev ${r.revision})  next=${nextStepLabel(r)}  ${r.title}`,
    );
  }
}

function main(): void {
  const [command, ...rest] = process.argv.slice(2);

  try {
    switch (command) {
      case "start": {
        const { values, positionals } = parseArgs({
          args: rest,
          options: { title: { type: "string" } },
          allowPositionals: true,
        });
        const runId = positionals[0];
        if (!runId) throw new HallmarkError("Usage: hallmark start <RUN-ID> --title <title>");
        cmdStart(runId, values.title ?? runId);
        break;
      }
      case "next":
        cmdNext(requireRunId(rest));
        break;
      case "run":
        cmdRun(requireRunId(rest));
        break;
      case "reconcile":
        cmdReconcile(requireRunId(rest));
        break;
      case "status":
        cmdStatus(requireRunId(rest));
        break;
      case "history":
        cmdHistory(requireRunId(rest));
        break;
      case "list":
        cmdList();
        break;
      default:
        console.error(
          "Usage: hallmark <start|next|run|status|reconcile|history|list> [RUN-ID] [--title ...]",
        );
        process.exit(2);
    }
  } catch (err) {
    if (err instanceof HallmarkError) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

function requireRunId(rest: string[]): string {
  const runId = rest[0];
  if (!runId) throw new HallmarkError("A RUN-ID is required.");
  return runId;
}

main();
