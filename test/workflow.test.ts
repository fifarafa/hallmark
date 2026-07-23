import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { makeHome, clearHome } from "./helpers.ts";
import { createRun, readRun } from "../src/run-store.ts";
import { advanceOne, runToCompletion } from "../src/runner.ts";
import { runSkill } from "../src/skills/index.ts";
import { artifactsDir } from "../src/paths.ts";
import { runFile } from "../src/paths.ts";
import { HallmarkError } from "../src/util.ts";
import path from "node:path";

beforeEach(() => makeHome());
afterEach(() => clearHome());

test("full workflow drives STARTED -> SHIPPED and deactivates the run", async () => {
  createRun("DEMO-1", "Hardcoded invoice archive endpoint");
  const outcomes = await runToCompletion("DEMO-1");

  assert.deepEqual(
    outcomes.map((o) => `${o.from}->${o.to}`),
    [
      "STARTED->SPECIFIED",
      "SPECIFIED->PLANNED",
      "PLANNED->BUILT",
      "BUILT->REVIEWED",
      "REVIEWED->SHIPPED",
    ],
  );
  const run = readRun("DEMO-1");
  assert.equal(run.state, "SHIPPED");
  assert.equal(run.active, false); // SHIPPED sets active:false
  assert.equal(run.revision, 6);
  assert.equal(run.projections.jira.status, "synced");
  assert.equal(run.projections.gitlab.status, "synced");
});

test("a failed verification leaves canonical state unchanged", async () => {
  createRun("DEMO-1", "Title");
  // Drive to REVIEWED (through spec, plan, build, review).
  for (let i = 0; i < 4; i++) await advanceOne("DEMO-1");
  assert.equal(readRun("DEMO-1").state, "REVIEWED");
  const before = readRun("DEMO-1");

  // Sabotage the review artifact so the ship transition's verification fails
  // even though the ship skill will still declare success:true.
  const reviewPath = path.join(artifactsDir("DEMO-1"), "review.md");
  fs.writeFileSync(reviewPath, "# Review\n\nDecision: CHANGES_REQUESTED\n");

  await assert.rejects(() => advanceOne("DEMO-1"), HallmarkError);

  const after = readRun("DEMO-1");
  assert.equal(after.state, "REVIEWED"); // unchanged
  assert.equal(after.revision, before.revision); // no revision bump
});

test("a skill cannot modify canonical run state", async () => {
  createRun("DEMO-1", "Title");
  const before = fs.readFileSync(runFile("DEMO-1"), "utf8");

  // Running the skill directly produces artifacts but must not touch the run.
  const result = await runSkill("spec", { runId: "DEMO-1", title: "Title" });
  assert.equal(result.success, true);

  const after = fs.readFileSync(runFile("DEMO-1"), "utf8");
  assert.equal(after, before); // byte-for-byte identical
});

// End-to-end CLI test of the WIP limit via a real child process.
function cli(args: string[], home: string) {
  return spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], {
    encoding: "utf8",
    cwd: process.cwd(),
    env: { ...process.env, HALLMARK_HOME: home },
  });
}

test("WIP is limited to a single active run", () => {
  const home = process.env.HALLMARK_HOME!;
  const start1 = cli(["start", "DEMO-1", "--title", "One"], home);
  assert.equal(start1.status, 0, start1.stderr);

  const start2 = cli(["start", "DEMO-2", "--title", "Two"], home);
  assert.equal(start2.status, 1); // refused
  assert.match(start2.stderr, /Cannot start DEMO-2/);
  assert.match(start2.stderr, /Active run DEMO-1/);
});
