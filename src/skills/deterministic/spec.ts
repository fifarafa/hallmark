// Skill: spec. Produces a specification artifact and a simulated Jira epic.
// A skill may only write artifacts belonging to its own responsibility.
// It never touches .hallmark/, never sets labels, never performs the transition.
import type { SkillContext, SkillResult } from "../../types.ts";
import { artifactsDir, jiraEpicFile } from "../../paths.ts";
import { ensureDir, writeFileAtomic, writeJsonAtomic } from "../../util.ts";
import path from "node:path";

export function runSpec(ctx: SkillContext): SkillResult {
  const { runId, title } = ctx;
  const specPath = path.join(artifactsDir(runId), "spec.md");
  const epicPath = jiraEpicFile(runId);

  ensureDir(artifactsDir(runId));

  const spec = `# Spec: ${title}

Run: ${runId}

## Goal
Expose a \`getInvoiceArchive(invoiceId)\` endpoint that returns an archived
invoice. For this proof of concept the invoice is hardcoded.

## Scope
- A single function \`getInvoiceArchive\` returning one archived invoice object.
- An automated test asserting the full returned object.

## Out of scope
- Persistence, databases, authentication.
- Real invoice generation or lookup.
- Pagination or multiple invoices.

## Acceptance Criteria
- \`getInvoiceArchive\` returns an object with the exact expected shape.
- The automated test passes.
- The implementation contains no TODO/FIXME markers.
- Review decision is APPROVED.
- A simulated merge request is created.

## Definition of Done (executable)
- funkcja getInvoiceArchive zwraca zahardkodowaną fakturę;
- test automatyczny przechodzi;
- nie ma TODO w implementacji;
- wynik review jest pozytywny;
- został utworzony symulowany merge request.
`;

  writeFileAtomic(specPath, spec);

  const epic = {
    key: runId,
    type: "epic",
    title,
    labels: [] as string[],
    status: "open",
  };
  writeJsonAtomic(epicPath, epic);

  return {
    skill: "spec",
    success: true,
    summary: `Wrote spec and Jira epic for ${runId}.`,
    evidencePaths: [specPath, epicPath],
    metadata: { epicKey: runId },
  };
}
