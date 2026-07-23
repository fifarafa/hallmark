// Skill: review. Performs a local review of the built feature and writes a
// review artifact whose Decision line the runner will check. In the happy
// path this is APPROVED.
import fs from "node:fs";
import path from "node:path";
import type { SkillContext, SkillResult } from "../../types.ts";
import { artifactsDir, featureImplFiles, featureTestFiles } from "../../paths.ts";
import { ensureDir, writeFileAtomic } from "../../util.ts";

export function runReview(ctx: SkillContext): SkillResult {
  const { runId } = ctx;
  const implFiles = featureImplFiles(runId);
  const testFiles = featureTestFiles(runId);

  const impl = implFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");
  const test = testFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");

  const specPath = path.join(artifactsDir(runId), "spec.md");
  const spec = fs.existsSync(specPath) ? fs.readFileSync(specPath, "utf8") : "";

  const checks = {
    hasImpl: implFiles.length > 0,
    hasTest: testFiles.length > 0,
    noTodo: !/TODO|FIXME/.test(impl),
    testAssertsValue: /deepEqual|assert/.test(test),
    // "simple": a proof-of-concept feature, not a framework.
    simple: impl.length < 2000,
    // Traceable to a spec rather than to one hardcoded feature name.
    matchesSpec: spec.includes("## Acceptance Criteria"),
  };

  const approved = Object.values(checks).every(Boolean);
  const decision = approved ? "APPROVED" : "CHANGES_REQUESTED";

  const reviewPath = path.join(artifactsDir(runId), "review.md");
  ensureDir(artifactsDir(runId));
  writeFileAtomic(
    reviewPath,
    `# Review: ${runId}

Decision: ${decision}

## Checks
- Implementation present: ${checks.hasImpl}
- Tests present: ${checks.hasTest}
- No TODO/FIXME: ${checks.noTodo}
- Test asserts returned value: ${checks.testAssertsValue}
- Implementation is simple: ${checks.simple}
- Traceable to spec acceptance criteria: ${checks.matchesSpec}
`,
  );

  return {
    skill: "review",
    success: approved,
    summary: `Review of ${runId}: ${decision}.`,
    evidencePaths: [reviewPath],
    metadata: { decision },
  };
}
