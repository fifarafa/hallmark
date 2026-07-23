// Centralised filesystem layout. All paths hang off a single base directory so
// tests can redirect the whole world with HALLMARK_HOME without touching the repo.
import fs from "node:fs";
import path from "node:path";

export function base(): string {
  return path.resolve(process.env.HALLMARK_HOME ?? process.cwd());
}

// --- canonical control state ---
export const runsDir = () => path.join(base(), ".hallmark", "runs");
export const runFile = (runId: string) => path.join(runsDir(), `${runId}.json`);

export const historyDir = () => path.join(base(), ".hallmark", "history");
export const historyFile = (runId: string) => path.join(historyDir(), `${runId}.jsonl`);

// Agent transcripts, written by the runner (never by the agent) so a live run
// leaves an auditable trail next to the history it produced.
export const logsDir = () => path.join(base(), ".hallmark", "logs");
export const agentLogFile = (runId: string, step: string) =>
  path.join(logsDir(), `${runId}.${step}.log`);

export const markersDir = () => path.join(base(), ".hallmark", "markers");
export const markerFile = (runId: string, name: string) =>
  path.join(markersDir(), `${runId}.${name}`);

// --- feature artifacts & workspace ---
export const artifactsDir = (runId: string) => path.join(base(), "artifacts", runId);
export const workspaceDir = (runId: string) => path.join(base(), "workspace", runId);
export const featureSrcDir = (runId: string) => path.join(workspaceDir(runId), "src");
export const featureTestDir = (runId: string) => path.join(workspaceDir(runId), "test");

// The feature is whatever the skill decided to build, so we discover its files
// rather than naming them. A deterministic stub and a real agent building from
// `--title` must both be verifiable by the same runner.
function listTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTsFiles(full));
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out.sort();
}

export const featureImplFiles = (runId: string) => listTsFiles(featureSrcDir(runId));
export const featureTestFiles = (runId: string) => listTsFiles(featureTestDir(runId));

// --- simulated external systems ---
export const jiraEpicsDir = () => path.join(base(), ".simulated", "jira", "epics");
export const jiraEpicFile = (key: string) => path.join(jiraEpicsDir(), `${key}.json`);
export const jiraTasksDir = () => path.join(base(), ".simulated", "jira", "tasks");
export const jiraTaskFile = (key: string) => path.join(jiraTasksDir(), `${key}.json`);
export const gitlabMrDir = () =>
  path.join(base(), ".simulated", "gitlab", "merge-requests");
export const gitlabMrFile = (iid: number) => path.join(gitlabMrDir(), `${iid}.json`);
