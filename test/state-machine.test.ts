import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NEXT_STATE,
  STATES,
  STEP_FOR_STATE,
  labelsForState,
  nextState,
  stepForState,
} from "../src/state-machine.ts";

test("transitions are linear and never skip a stage", () => {
  assert.equal(nextState("STARTED"), "SPECIFIED");
  assert.equal(nextState("SPECIFIED"), "PLANNED");
  assert.equal(nextState("PLANNED"), "BUILT");
  assert.equal(nextState("BUILT"), "REVIEWED");
  assert.equal(nextState("REVIEWED"), "SHIPPED");
  assert.equal(nextState("SHIPPED"), null);
});

test("there is no transition that jumps more than one stage", () => {
  // Each state's successor must be the immediately following state in STATES.
  for (let i = 0; i < STATES.length; i++) {
    const expected = i + 1 < STATES.length ? STATES[i + 1] : null;
    assert.equal(NEXT_STATE[STATES[i]!], expected);
  }
});

test("each non-terminal state maps to exactly one step", () => {
  assert.equal(stepForState("STARTED"), "spec");
  assert.equal(stepForState("SPECIFIED"), "plan");
  assert.equal(stepForState("PLANNED"), "build");
  assert.equal(stepForState("BUILT"), "review");
  assert.equal(stepForState("REVIEWED"), "ship");
  assert.equal(STEP_FOR_STATE["SHIPPED"], null);
});

test("labels are a one-to-one projection of state", () => {
  assert.deepEqual(labelsForState("BUILT"), ["hallmark:built"]);
  assert.deepEqual(labelsForState("SHIPPED"), ["hallmark:shipped"]);
});
