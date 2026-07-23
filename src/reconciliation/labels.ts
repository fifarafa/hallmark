// Deterministic label projection. Labels under the `hallmark:` namespace are
// wholly derived from canonical state; any other labels are left untouched.
import fs from "node:fs";
import { readJson, writeJsonAtomic } from "../util.ts";

const HALLMARK_PREFIX = "hallmark:";

// Compute the desired label set: drop every existing hallmark:* label, keep the
// rest, add exactly the desired hallmark:* labels. Idempotent and order-stable.
export function projectLabels(existing: string[], desired: string[]): string[] {
  const kept = existing.filter((l) => !l.startsWith(HALLMARK_PREFIX));
  const result = [...kept];
  for (const d of desired) {
    if (!result.includes(d)) result.push(d);
  }
  return result;
}

// Relabel one simulated-external-system JSON file in place, then re-read and
// verify the desired labels landed (the "read file again / verify" step).
export function relabelFile(file: string, desired: string[]): void {
  const obj = readJson<{ labels?: string[] }>(file);
  const projected = projectLabels(obj.labels ?? [], desired);
  obj.labels = projected;
  writeJsonAtomic(file, obj);

  const after = readJson<{ labels?: string[] }>(file);
  const labels = after.labels ?? [];
  for (const d of desired) {
    if (!labels.includes(d)) {
      throw new Error(`label reconciliation failed to apply ${d} to ${file}.`);
    }
  }
  const hallmarkLabels = labels.filter((l) => l.startsWith(HALLMARK_PREFIX));
  if (hallmarkLabels.length !== desired.length) {
    throw new Error(
      `expected exactly ${desired.length} hallmark:* label(s) on ${file}, ` +
        `found ${hallmarkLabels.length}.`,
    );
  }
}

export function fileExists(file: string): boolean {
  return fs.existsSync(file);
}
