// Centralised filesystem layout. All paths hang off a single base directory so
// tests can redirect the whole world with HALLMARK_HOME without touching the repo.
import path from "node:path";

export function base(): string {
  return path.resolve(process.env.HALLMARK_HOME ?? process.cwd());
}

// --- canonical control state ---
export const runsDir = () => path.join(base(), ".hallmark", "runs");
export const runFile = (runId: string) => path.join(runsDir(), `${runId}.json`);

export const historyDir = () => path.join(base(), ".hallmark", "history");
export const historyFile = (runId: string) => path.join(historyDir(), `${runId}.jsonl`);

export const markersDir = () => path.join(base(), ".hallmark", "markers");
export const markerFile = (runId: string, name: string) =>
  path.join(markersDir(), `${runId}.${name}`);

// --- feature artifacts & workspace ---
export const artifactsDir = (runId: string) => path.join(base(), "artifacts", runId);
export const workspaceDir = (runId: string) => path.join(base(), "workspace", runId);
export const featureTestFile = (runId: string) =>
  path.join(workspaceDir(runId), "test", "invoiceArchive.test.ts");
export const featureImplFile = (runId: string) =>
  path.join(workspaceDir(runId), "src", "invoiceArchive.ts");

// --- simulated external systems ---
export const jiraEpicsDir = () => path.join(base(), ".simulated", "jira", "epics");
export const jiraEpicFile = (key: string) => path.join(jiraEpicsDir(), `${key}.json`);
export const jiraTasksDir = () => path.join(base(), ".simulated", "jira", "tasks");
export const jiraTaskFile = (key: string) => path.join(jiraTasksDir(), `${key}.json`);
export const gitlabMrDir = () =>
  path.join(base(), ".simulated", "gitlab", "merge-requests");
export const gitlabMrFile = (iid: number) => path.join(gitlabMrDir(), `${iid}.json`);
