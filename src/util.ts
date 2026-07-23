import fs from "node:fs";
import path from "node:path";

// A workflow/verification error we want to surface cleanly to the user
// (as a clear, actionable message) rather than as a raw stack trace.
export class HallmarkError extends Error {}

export function nowIso(): string {
  return new Date().toISOString();
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

// Atomic write: write to a temp file in the same directory, then rename.
// rename(2) is atomic on the same filesystem, so a reader never sees a
// half-written file.
export function writeFileAtomic(file: string, contents: string): void {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp.${process.pid}.${Math.floor(process.hrtime()[1])}`;
  fs.writeFileSync(tmp, contents);
  fs.renameSync(tmp, file);
}

export function writeJsonAtomic(file: string, value: unknown): void {
  writeFileAtomic(file, JSON.stringify(value, null, 2) + "\n");
}
