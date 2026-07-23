// Test helpers: give each test its own isolated HALLMARK_HOME so runs never collide
// and the repo's real .hallmark/ is never touched.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function makeHome(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hallmark-test-"));
  process.env.HALLMARK_HOME = dir;
  return dir;
}

export function clearHome(): void {
  delete process.env.HALLMARK_HOME;
  delete process.env.SIMULATE_GITLAB_FAILURE_ONCE;
}
