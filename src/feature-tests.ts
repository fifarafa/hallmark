// Runs the generated feature's test suite in a real child process.
// Used both by the `build` skill (to self-report) and — crucially —
// independently by the runner's verification (to not trust that report).
import { spawnSync } from "node:child_process";
import { featureTestFile } from "./paths.ts";

export type TestRun = {
  code: number;
  output: string;
};

export function runFeatureTests(runId: string): TestRun {
  const testFile = featureTestFile(runId);
  // We invoke node with the tsx loader so the .ts test + impl run directly.
  // cwd stays at the project root (process.cwd()) so `--import tsx` resolves
  // tsx from the repo's node_modules, while the test file path is absolute.
  const res = spawnSync(
    process.execPath,
    ["--import", "tsx", "--test", testFile],
    { encoding: "utf8", cwd: process.cwd() },
  );
  const output = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  return { code: res.status ?? 1, output };
}
