// The sandcastle provider: each agentic step is a real Claude Code agent run
// inside a Podman container, driven by that step's skills/<step>/SKILL.md.
//
// Isolation model — this is what makes "a skill cannot modify canonical state"
// an enforced property rather than a convention.
//
// The repo gitignores .hallmark/, .simulated/, artifacts/ and workspace/, so a
// fresh git worktree contains none of them. The agent therefore starts unable to
// see canonical state at all, and we control both directions explicitly:
//
//   COPY_IN  — the inputs this step is entitled to read, seeded into the
//              worktree before the agent starts. `.hallmark/` is in no step's
//              list, so canonical state is not merely read-only to the agent;
//              it is absent.
//   COPY_OUT — the outputs this step is permitted to produce, copied back after
//              the agent finishes. Anything else it wrote dies with the
//              worktree. A `spec` agent cannot emit a build report; a `build`
//              agent cannot rewrite the spec it was handed.
//
// The runner then verifies the copied-out evidence exactly as it verifies the
// deterministic stubs' — same rules, no special cases, no new trust.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { claudeCode, createWorktree } from "@ai-hero/sandcastle";
import type { SkillContext, SkillResult, Step } from "../../types.ts";
import { agentLogFile, base } from "../../paths.ts";
import { HallmarkError, ensureDir } from "../../util.ts";
import { agentModel, imageName, sandboxProvider } from "./config.ts";

// Inputs each step may read, as paths relative to the repo root.
//
// Note what is NOT here: node_modules. The host's is built for the host's
// platform, and copying it into a Linux container gives the agent a tsx whose
// native binary cannot execute. Dependencies are installed inside the sandbox
// instead (see SANDBOX_SETUP).
// The steps this provider runs as agents. `ship` is deliberately absent: it
// writes a fixed JSON structure and stays deterministic under every provider.
export type AgenticStep = "spec" | "plan" | "build" | "review";

type Allowlist = Record<AgenticStep, (runId: string) => string[]>;

export const COPY_IN: Allowlist = {
  spec: () => [],
  plan: (r) => [`artifacts/${r}/spec.md`],
  build: (r) => [`artifacts/${r}/spec.md`, `artifacts/${r}/plan.md`],
  review: (r) => [
    `artifacts/${r}/spec.md`,
    `artifacts/${r}/plan.md`,
    `workspace/${r}`,
  ],
};

// Installed in the container, for this container's platform. `build` and
// `review` both run the feature's tests, so both need the toolchain; `spec` and
// `plan` only write markdown and JSON and can skip the install entirely.
const SANDBOX_SETUP = [{ command: "npm install --no-audit --no-fund", timeoutMs: 300_000 }];
const NEEDS_DEPS: ReadonlySet<string> = new Set(["build", "review"]);

// Outputs each step may produce, as paths relative to the repo root.
export const COPY_OUT: Allowlist = {
  spec: (r) => [`artifacts/${r}/spec.md`, `.simulated/jira/epics/${r}.json`],
  plan: (r) => [`artifacts/${r}/plan.md`, ".simulated/jira/tasks"],
  build: (r) => [
    `workspace/${r}`,
    `artifacts/${r}/build-report.md`,
    `artifacts/${r}/test-output.txt`,
  ],
  review: (r) => [`artifacts/${r}/review.md`],
};

function allowlist(
  table: Allowlist,
  step: Step,
  runId: string,
  which: string,
): string[] {
  const fn = table[step as AgenticStep];
  if (!fn) throw new HallmarkError(`No ${which} allowlist defined for step '${step}'.`);
  return fn(runId);
}

// Copy a file or directory between roots. Directories merge rather than replace,
// so `plan` writing tasks does not wipe another run's.
export function copyTree(fromRoot: string, toRoot: string, rel: string): string[] {
  const src = path.join(fromRoot, rel);
  const dest = path.join(toRoot, rel);
  if (!fs.existsSync(src)) return [];

  if (fs.statSync(src).isDirectory()) {
    const written: string[] = [];
    ensureDir(dest);
    for (const entry of fs.readdirSync(src)) {
      written.push(...copyTree(fromRoot, toRoot, path.join(rel, entry)));
    }
    return written;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  return [dest];
}

function failure(
  step: Step,
  summary: string,
  metadata: Record<string, unknown>,
): SkillResult {
  return { skill: step, success: false, summary, evidencePaths: [], metadata };
}

export async function runAgenticSkill(
  step: Step,
  ctx: SkillContext,
): Promise<SkillResult> {
  const { runId, title } = ctx;
  const repoRoot = base();
  const promptFile = path.join(repoRoot, "skills", step, "SKILL.md");

  if (!fs.existsSync(promptFile)) {
    throw new HallmarkError(
      `Skill prompt missing at ${promptFile}. The sandcastle provider drives ` +
        `each step from its SKILL.md.`,
    );
  }

  const copyIn = allowlist(COPY_IN, step, runId, "copy-in");
  const copyOut = allowlist(COPY_OUT, step, runId, "copy-out");

  // A throwaway branch per step per run: the agent's commits never touch the
  // checked-out branch, and two steps can never collide on one worktree.
  const branch = `hallmark/${runId}/${step}`;
  const logPath = agentLogFile(runId, step);
  ensureDir(path.dirname(logPath));
  const meta: Record<string, unknown> = {
    provider: "sandcastle",
    step,
    branch,
    model: agentModel(),
    image: imageName(),
  };

  let worktree;
  try {
    worktree = await createWorktree({
      cwd: repoRoot,
      branchStrategy: { type: "branch", branch },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return failure(step, `Could not create worktree for '${step}': ${msg}`, {
      ...meta,
      error: msg,
    });
  }

  try {
    // Seed only this step's declared inputs. Gitignored paths are absent from a
    // fresh worktree, so this is the agent's entire view of prior work.
    // We copy these ourselves rather than via sandcastle's `copyToWorktree`,
    // which shells out to a plain `cp` and fails on any nested path whose parent
    // directory does not already exist in the worktree.
    for (const rel of copyIn) {
      copyTree(repoRoot, worktree.worktreePath, rel);
    }

    let result;
    try {
      result = await worktree.run({
        name: `hallmark ${runId} ${step}`,
        agent: claudeCode(agentModel(), { permissionMode: "bypassPermissions" }),
        sandbox: sandboxProvider(),
        promptFile,
        // Only what the prompts actually reference — sandcastle warns on unused
        // arguments, and an unused one usually means a prompt typo.
        promptArgs: { RUN_ID: runId, TITLE: title },
        maxIterations: 1,
        logging: { type: "file", path: logPath },
        hooks: NEEDS_DEPS.has(step)
          ? { sandbox: { onSandboxReady: SANDBOX_SETUP } }
          : undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // A container or agent failure is a skill failure, not a crash: the runner
      // records it and leaves canonical state untouched.
      return failure(step, `Agent run for '${step}' failed: ${msg}`, {
        ...meta,
        error: msg,
      });
    }

    meta.logFilePath = result.logFilePath ?? null;

    // Bring back only what this step is permitted to produce. Done before
    // close(), while the worktree still exists on disk.
    const written: string[] = [];
    for (const rel of copyOut) {
      written.push(...copyTree(worktree.worktreePath, repoRoot, rel));
    }

    if (written.length === 0) {
      return failure(
        step,
        `Agent for '${step}' produced none of its expected outputs (${copyOut.join(", ")}).`,
        meta,
      );
    }

    // Still only a *declaration*: the runner re-reads these files and re-runs
    // the tests before any state changes.
    return {
      skill: step,
      success: true,
      summary: `Agent completed '${step}' for ${runId} (${written.length} file(s) copied out).`,
      evidencePaths: written,
      metadata: meta,
    };
  } finally {
    // Always tear the worktree down, even on failure, so runs do not accumulate
    // stale worktrees. The agent's output has already been copied out (or was
    // not permitted to survive).
    await worktree.close().catch(() => {});
    // close() removes the worktree but leaves its branch behind, which would
    // accumulate one ref per step per run. The agent's outputs are gitignored,
    // so these branches carry nothing the runner ever reads; the transcript in
    // .hallmark/logs/ is what remains for debugging.
    spawnSync("git", ["branch", "-D", branch], { cwd: repoRoot, stdio: "ignore" });
  }
}
