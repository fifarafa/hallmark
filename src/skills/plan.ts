// Skill: plan. Reads the spec and produces a plan artifact plus three Jira tasks.
import fs from "node:fs";
import path from "node:path";
import type { SkillContext, SkillResult } from "../types.ts";
import { artifactsDir, jiraTaskFile, jiraTasksDir } from "../paths.ts";
import { ensureDir, writeFileAtomic, writeJsonAtomic } from "../util.ts";

const TASKS = [
  { suffix: "1", title: "Implement invoice archive function" },
  { suffix: "2", title: "Add automated tests" },
  { suffix: "3", title: "Prepare verification and merge request" },
];

export function runPlan(ctx: SkillContext): SkillResult {
  const { runId } = ctx;
  const specPath = path.join(artifactsDir(runId), "spec.md");
  const planPath = path.join(artifactsDir(runId), "plan.md");

  // A skill reads its inputs; here we read the spec to prove the plan derives
  // from it (and to fail loudly if spec is missing).
  const spec = fs.readFileSync(specPath, "utf8");
  const hasAcceptance = spec.includes("## Acceptance Criteria");

  ensureDir(artifactsDir(runId));
  ensureDir(jiraTasksDir());

  const evidencePaths: string[] = [planPath];

  const plan = `# Implementation Plan: ${runId}

Derived from the spec's Acceptance Criteria (${
    hasAcceptance ? "present" : "MISSING"
  }).

## Tasks
${TASKS.map((t) => `- ${runId}-${t.suffix} ${t.title}`).join("\n")}

## How this satisfies the Acceptance Criteria
- ${runId}-1 implements getInvoiceArchive per the acceptance criteria.
- ${runId}-2 adds the automated test the acceptance criteria require.
- ${runId}-3 produces the review and the simulated merge request.
`;
  writeFileAtomic(planPath, plan);

  for (const t of TASKS) {
    const key = `${runId}-${t.suffix}`;
    const file = jiraTaskFile(key);
    writeJsonAtomic(file, {
      key,
      type: "task",
      epic: runId,
      title: t.title,
      labels: [] as string[],
      status: "open",
    });
    evidencePaths.push(file);
  }

  return {
    skill: "plan",
    success: true,
    summary: `Wrote plan and ${TASKS.length} Jira tasks for ${runId}.`,
    evidencePaths,
    metadata: { taskCount: TASKS.length },
  };
}
