// Runs the generated feature's test suite in a real child process.
// Used both by the `build` skill (to self-report) and — crucially —
// independently by the runner's verification (to not trust that report).
import { spawnSync } from "node:child_process";
import { featureTestDir, featureTestFiles } from "./paths.ts";

export type TestRun = {
  code: number;
  output: string;
};

export function runFeatureTests(runId: string): TestRun {
  // Discover the test files rather than assuming a name: the feature under test
  // is whatever the skill built. No test files at all is a failure, not a pass —
  // otherwise a skill could earn BUILT by writing nothing.
  const testFiles = featureTestFiles(runId);
  if (testFiles.length === 0) {
    return {
      code: 1,
      output: `No test files found under ${featureTestDir(runId)}.\n`,
    };
  }

  // We invoke node with the tsx loader so the .ts tests + impl run directly.
  // cwd stays at the project root (process.cwd()) so `--import tsx` resolves
  // tsx from the repo's node_modules, while the test paths are absolute.
  const res = spawnSync(
    process.execPath,
    ["--import", "tsx", "--test", ...testFiles],
    { encoding: "utf8", cwd: process.cwd() },
  );
  const output = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  return { code: res.status ?? 1, output };
}
