// Append-only event history, one JSONL file per run under .hallmark/history/.
import fs from "node:fs";
import { historyDir, historyFile } from "./paths.ts";
import { ensureDir, nowIso } from "./util.ts";

export type HallmarkEvent =
  | { type: "RUN_STARTED"; revision: number }
  | { type: "SKILL_COMPLETED"; skill: string; revision: number }
  | { type: "SKILL_FAILED"; skill: string; revision: number; error: string }
  | { type: "VERIFICATION_FAILED"; step: string; revision: number; error: string }
  | { type: "STATE_TRANSITIONED"; from: string; to: string; revision: number }
  | { type: "PROJECTION_RECONCILED"; projection: string; revision: number }
  | { type: "PROJECTION_FAILED"; projection: string; revision: number; error: string }
  | { type: "RUN_COMPLETED"; revision: number };

export function appendEvent(runId: string, event: HallmarkEvent): void {
  ensureDir(historyDir());
  const line = JSON.stringify({ ...event, at: nowIso() }) + "\n";
  fs.appendFileSync(historyFile(runId), line);
}

export function readHistory(runId: string): Array<HallmarkEvent & { at: string }> {
  const file = historyFile(runId);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l));
}
