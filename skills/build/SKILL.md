# Skill: build

You are the **build** step of the hallmark delivery pipeline.

- Run ID: `{{RUN_ID}}`
- Feature title: **{{TITLE}}**

## Your task

Implement the feature described in `artifacts/{{RUN_ID}}/spec.md`, following the
task breakdown in `artifacts/{{RUN_ID}}/plan.md`. Read both before writing code.
Implement what the spec actually says — the acceptance criteria are the contract.

## Files you must create

### 1. Implementation — `workspace/{{RUN_ID}}/src/<name>.ts`

Name the file after the feature. TypeScript, ESM, exporting the function(s) the
spec requires. Keep it small and dependency-free: Node's standard library only.

**It must contain no `TODO` and no `FIXME` anywhere.** The runner greps every
file under `workspace/{{RUN_ID}}/src/` for both words and fails the step if it
finds either. Do not leave placeholder comments — finish the work instead.

### 2. Tests — `workspace/{{RUN_ID}}/test/<name>.test.ts`

Use `node:test` and `node:assert/strict`. Import the implementation by relative
path with the `.ts` extension:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { yourFunction } from "../src/yourFile.ts";

test("describes the behaviour the spec requires", () => {
  assert.deepEqual(yourFunction("input"), { /* expected */ });
});
```

Assert real returned values, not just that a call did not throw. Cover every
acceptance criterion in the spec.

### 3. Support files

`workspace/{{RUN_ID}}/package.json` (with `"type": "module"`) and
`workspace/{{RUN_ID}}/tsconfig.json`.

### 4. `artifacts/{{RUN_ID}}/test-output.txt`

The **actual captured stdout+stderr** of your test run. Not a summary you wrote.

### 5. `artifacts/{{RUN_ID}}/build-report.md`

What you implemented, which files you created, the test exit code, and PASS or
FAIL.

## Run your tests before you finish

From the repository root:

```bash
node --import tsx --test workspace/{{RUN_ID}}/test/*.test.ts
```

This is the exact harness the runner uses — same loader, same working directory.
If it does not exit 0 for you, it will not exit 0 for the runner, and the run
will not advance. Fix the code until the tests genuinely pass. Do not delete or
weaken a test to make it green.

## Boundaries

- Write only under `workspace/{{RUN_ID}}/` and the two artifact files above.
- Do not modify `spec.md` or `plan.md`. They are inputs; changes to them are
  discarded.
- Do not add npm dependencies.

## How this step is judged

The runner does not read your build report's verdict. It discovers your source
and test files, greps the sources for TODO/FIXME, and **re-runs your tests
itself** in a fresh process. Exit code 0 from that run — not your claim about it
— is what advances the state to BUILT. An empty test directory counts as a
failure, not a pass.
