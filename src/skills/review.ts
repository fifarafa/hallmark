// Skill: review. Performs a local review of the built feature and writes a
// review artifact whose Decision line the runner will check. In the happy
// path this is APPROVED.
import fs from "node:fs";
import path from "node:path";
import type { SkillContext, SkillResult } from "../types.ts";
import { artifactsDir, featureImplFile, featureTestFile } from "../paths.ts";
import { ensureDir, writeFileAtomic } from "../util.ts";

export function runReview(ctx: SkillContext): SkillResult {
  const { runId } = ctx;
  const implPath = featureImplFile(runId);
  const testPath = featureTestFile(runId);

  const impl = fs.readFileSync(implPath, "utf8");
  const test = fs.readFileSync(testPath, "utf8");

  const checks = {
    hasTest: fs.existsSync(testPath),
    noTodo: !/TODO|FIXME/.test(impl),
    testAssertsValue: /deepEqual|assert/.test(test),
    // "simple": tiny single-function implementation, no unrelated machinery.
    simple: impl.length < 2000,
    matchesSpec: /getInvoiceArchive/.test(impl) && /ARCHIVED/.test(impl),
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
- Tests present: ${checks.hasTest}
- No TODO/FIXME: ${checks.noTodo}
- Test asserts returned value: ${checks.testAssertsValue}
- Implementation is simple: ${checks.simple}
- Matches spec (getInvoiceArchive, ARCHIVED): ${checks.matchesSpec}
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
