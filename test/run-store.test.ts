import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { makeHome, clearHome } from "./helpers.ts";
import { createRun, readRun, updateRun, activeRun, listRuns } from "../src/run-store.ts";
import { runFile } from "../src/paths.ts";
import { HallmarkError } from "../src/util.ts";

beforeEach(() => makeHome());
afterEach(() => clearHome());

test("createRun writes a canonical STARTED run", () => {
  const run = createRun("DEMO-1", "Title");
  assert.equal(run.state, "STARTED");
  assert.equal(run.revision, 1);
  assert.equal(run.active, true);
  assert.equal(run.currentStep, "spec");
  assert.ok(fs.existsSync(runFile("DEMO-1")));
});

test("updateRun enforces optimistic concurrency via revision", () => {
  createRun("DEMO-1", "Title");
  const run = readRun("DEMO-1"); // revision 1

  // A concurrent writer bumps the revision to 2.
  updateRun("DEMO-1", 1, (r) => {
    r.revision = 2;
    return r;
  });

  // Our stale write (still expecting revision 1) must be rejected.
  assert.throws(
    () =>
      updateRun("DEMO-1", run.revision, (r) => {
        r.title = "stale";
        return r;
      }),
    HallmarkError,
  );
  // And the file was not modified by the rejected write.
  assert.equal(readRun("DEMO-1").title, "Title");
});

test("activeRun and listRuns reflect stored runs", () => {
  createRun("DEMO-1", "One");
  assert.equal(activeRun()?.runId, "DEMO-1");
  updateRun("DEMO-1", 1, (r) => {
    r.active = false;
    return r;
  });
  assert.equal(activeRun(), null);
  assert.equal(listRuns().length, 1);
});
