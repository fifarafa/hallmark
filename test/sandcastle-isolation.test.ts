// The sandcastle provider hands a real agent a writable working directory, so
// "a skill cannot modify canonical state" has to hold structurally rather than
// by convention. These tests pin the two mechanisms that enforce it — the
// copy-in/copy-out allowlists and the copier — without needing a container,
// so they run in the normal offline suite.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { COPY_IN, COPY_OUT, copyTree } from "../src/skills/sandcastle/index.ts";

const AGENTIC = ["spec", "plan", "build", "review"] as const;

function tmpRoot(name: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `hallmark-${name}-`));
}

test("no step may read or write canonical control state", () => {
  for (const step of AGENTIC) {
    for (const [label, table] of [
      ["copy-in", COPY_IN],
      ["copy-out", COPY_OUT],
    ] as const) {
      for (const rel of table[step]("DEMO-1")) {
        assert.ok(
          !rel.split("/").includes(".hallmark"),
          `${step} ${label} allowlist must not reference .hallmark (got '${rel}')`,
        );
      }
    }
  }
});

test("each step's outputs are confined to its own run", () => {
  // Every declared output is either scoped to the run id or is the shared
  // simulated-Jira task directory, which the plan step legitimately adds to.
  for (const step of AGENTIC) {
    for (const rel of COPY_OUT[step]("DEMO-1")) {
      const scoped = rel.includes("DEMO-1") || rel === ".simulated/jira/tasks";
      assert.ok(scoped, `${step} may not write unscoped path '${rel}'`);
    }
  }
});

test("a step cannot read artifacts it was not given", () => {
  // spec runs first and is entitled to nothing; review is entitled to the
  // built workspace. Neither may see the other's private outputs.
  assert.deepEqual(COPY_IN.spec("DEMO-1"), []);
  assert.ok(!COPY_IN.build("DEMO-1").some((p) => p.includes("review.md")));
  assert.ok(!COPY_IN.plan("DEMO-1").some((p) => p.includes("workspace/")));
});

// Regression: sandcastle's own copyToWorktree shells out to `cp`, which fails
// on a nested destination whose parent does not exist yet. Every step except
// spec seeds a nested path, so the copier must create parents itself.
test("copyTree creates missing parent directories", () => {
  const from = tmpRoot("from");
  const to = tmpRoot("to");
  try {
    fs.mkdirSync(path.join(from, "artifacts", "DEMO-1"), { recursive: true });
    fs.writeFileSync(path.join(from, "artifacts", "DEMO-1", "spec.md"), "# Spec\n");

    const written = copyTree(from, to, "artifacts/DEMO-1/spec.md");

    assert.equal(written.length, 1);
    assert.equal(
      fs.readFileSync(path.join(to, "artifacts", "DEMO-1", "spec.md"), "utf8"),
      "# Spec\n",
    );
  } finally {
    fs.rmSync(from, { recursive: true, force: true });
    fs.rmSync(to, { recursive: true, force: true });
  }
});

test("copyTree merges directories instead of replacing them", () => {
  const from = tmpRoot("from");
  const to = tmpRoot("to");
  try {
    fs.mkdirSync(path.join(from, "tasks"), { recursive: true });
    fs.writeFileSync(path.join(from, "tasks", "DEMO-2-1.json"), "{}");
    fs.mkdirSync(path.join(to, "tasks"), { recursive: true });
    fs.writeFileSync(path.join(to, "tasks", "DEMO-1-1.json"), "{}");

    copyTree(from, to, "tasks");

    // A second run's tasks must not wipe the first run's.
    assert.ok(fs.existsSync(path.join(to, "tasks", "DEMO-1-1.json")));
    assert.ok(fs.existsSync(path.join(to, "tasks", "DEMO-2-1.json")));
  } finally {
    fs.rmSync(from, { recursive: true, force: true });
    fs.rmSync(to, { recursive: true, force: true });
  }
});

test("copyTree ignores paths the agent did not produce", () => {
  const from = tmpRoot("from");
  const to = tmpRoot("to");
  try {
    // Nothing was written at this path: copying is a no-op, not a crash.
    assert.deepEqual(copyTree(from, to, "artifacts/DEMO-1/spec.md"), []);
    assert.ok(!fs.existsSync(path.join(to, "artifacts")));
  } finally {
    fs.rmSync(from, { recursive: true, force: true });
    fs.rmSync(to, { recursive: true, force: true });
  }
});

test("anything outside the copy-out allowlist never reaches the repo", () => {
  const worktree = tmpRoot("worktree");
  const repo = tmpRoot("repo");
  try {
    // Simulate an agent that wrote its legitimate output *and* tried to forge
    // canonical state plus another step's artifact.
    fs.mkdirSync(path.join(worktree, "artifacts", "DEMO-1"), { recursive: true });
    fs.writeFileSync(path.join(worktree, "artifacts", "DEMO-1", "spec.md"), "# Spec\n");
    fs.writeFileSync(
      path.join(worktree, "artifacts", "DEMO-1", "review.md"),
      "Decision: APPROVED\n",
    );
    fs.mkdirSync(path.join(worktree, ".hallmark", "runs"), { recursive: true });
    fs.writeFileSync(
      path.join(worktree, ".hallmark", "runs", "DEMO-1.json"),
      JSON.stringify({ state: "SHIPPED" }),
    );

    for (const rel of COPY_OUT.spec("DEMO-1")) copyTree(worktree, repo, rel);

    // Its own output came back...
    assert.ok(fs.existsSync(path.join(repo, "artifacts", "DEMO-1", "spec.md")));
    // ...but the forged review and the forged canonical state did not.
    assert.ok(!fs.existsSync(path.join(repo, "artifacts", "DEMO-1", "review.md")));
    assert.ok(!fs.existsSync(path.join(repo, ".hallmark")));
  } finally {
    fs.rmSync(worktree, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  }
});
