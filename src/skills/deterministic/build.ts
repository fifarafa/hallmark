// Skill: build. Generates a tiny feature into workspace/<runId>/, runs its
// tests, and writes a build report + captured test output. The runner will
// later re-run these tests independently — this report is only a declaration.
import path from "node:path";
import type { SkillContext, SkillResult } from "../../types.ts";
import { artifactsDir, workspaceDir } from "../../paths.ts";
import { runFeatureTests } from "../../feature-tests.ts";
import { ensureDir, writeFileAtomic } from "../../util.ts";

const IMPL = `// Generated feature: hardcoded invoice archive endpoint.
export type Invoice = {
  invoiceId: string;
  customerId: string;
  amount: number;
  currency: string;
  status: string;
};

export function getInvoiceArchive(invoiceId: string): Invoice {
  return {
    invoiceId,
    customerId: "customer-123",
    amount: 12345,
    currency: "PLN",
    status: "ARCHIVED",
  };
}
`;

const TEST = `import { test } from "node:test";
import assert from "node:assert/strict";
import { getInvoiceArchive } from "../src/invoiceArchive.ts";

test("getInvoiceArchive returns the full archived invoice", () => {
  const result = getInvoiceArchive("inv-1");
  assert.deepEqual(result, {
    invoiceId: "inv-1",
    customerId: "customer-123",
    amount: 12345,
    currency: "PLN",
    status: "ARCHIVED",
  });
});
`;

const PKG = `{
  "name": "feature-invoice-archive",
  "version": "0.0.0",
  "private": true,
  "type": "module"
}
`;

const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "strict": true,
    "noEmit": true
  }
}
`;

export function runBuild(ctx: SkillContext): SkillResult {
  const { runId } = ctx;
  const ws = workspaceDir(runId);

  ensureDir(path.join(ws, "src"));
  ensureDir(path.join(ws, "test"));
  ensureDir(artifactsDir(runId));

  writeFileAtomic(path.join(ws, "src", "invoiceArchive.ts"), IMPL);
  writeFileAtomic(path.join(ws, "test", "invoiceArchive.test.ts"), TEST);
  writeFileAtomic(path.join(ws, "package.json"), PKG);
  writeFileAtomic(path.join(ws, "tsconfig.json"), TSCONFIG);

  const testRun = runFeatureTests(runId);

  const testOutputPath = path.join(artifactsDir(runId), "test-output.txt");
  const reportPath = path.join(artifactsDir(runId), "build-report.md");

  writeFileAtomic(testOutputPath, testRun.output);
  writeFileAtomic(
    reportPath,
    `# Build Report: ${runId}

- Implementation: workspace/${runId}/src/invoiceArchive.ts
- Test: workspace/${runId}/test/invoiceArchive.test.ts
- Test exit code: ${testRun.code}
- Result: ${testRun.code === 0 ? "PASS" : "FAIL"}
`,
  );

  return {
    skill: "build",
    success: testRun.code === 0,
    summary: `Built feature for ${runId}; tests exited ${testRun.code}.`,
    evidencePaths: [
      path.join(ws, "src", "invoiceArchive.ts"),
      reportPath,
      testOutputPath,
    ],
    metadata: { testExitCode: testRun.code },
  };
}
