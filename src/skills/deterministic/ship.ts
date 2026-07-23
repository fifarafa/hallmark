// Skill: ship. Simulates opening a merge request and writes a ship report.
import fs from "node:fs";
import path from "node:path";
import type { SkillContext, SkillResult } from "../../types.ts";
import { artifactsDir, gitlabMrDir, gitlabMrFile } from "../../paths.ts";
import { ensureDir, readJson, writeFileAtomic, writeJsonAtomic } from "../../util.ts";

// Pick the next merge-request iid, reusing this run's MR if it already exists
// (so re-running ship is safe and each run gets a distinct iid).
function nextMrIid(runId: string): number {
  const dir = gitlabMrDir();
  if (!fs.existsSync(dir)) return 1;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  let max = 0;
  for (const f of files) {
    const mr = readJson<{ iid: number; relatedTicket?: string }>(path.join(dir, f));
    if (mr.relatedTicket === runId) return mr.iid; // idempotent reuse
    if (mr.iid > max) max = mr.iid;
  }
  return max + 1;
}

export function runShip(ctx: SkillContext): SkillResult {
  const { runId, title } = ctx;
  const iid = nextMrIid(runId);
  const mrPath = gitlabMrFile(iid);

  ensureDir(gitlabMrDir());
  ensureDir(artifactsDir(runId));

  const mr = {
    iid,
    title: `${runId}: ${title}`,
    sourceBranch: `feature/${runId}`,
    targetBranch: "main",
    state: "opened",
    labels: [] as string[],
    relatedTicket: runId,
  };
  writeJsonAtomic(mrPath, mr);

  const reportPath = path.join(artifactsDir(runId), "ship-report.md");
  writeFileAtomic(
    reportPath,
    `# Ship Report: ${runId}

- Merge request: !${iid} (${mr.title})
- Source branch: ${mr.sourceBranch}
- Target branch: ${mr.targetBranch}
- State: ${mr.state}
`,
  );

  return {
    skill: "ship",
    success: true,
    summary: `Opened simulated MR !${iid} for ${runId}.`,
    evidencePaths: [mrPath, reportPath],
    metadata: { mrIid: iid },
  };
}
