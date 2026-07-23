// Skill registry and provider selection.
//
// A *provider* decides HOW a step is performed; it never decides WHETHER the
// step counts. Both providers hand back the same `SkillResult` declaration and
// the runner verifies both by exactly the same rules — that symmetry is the
// point. Swapping a deterministic stub for a live agent must not require
// touching verification.ts.
//
//   deterministic — fixed local stubs. Offline, ~1s, no containers. Default,
//                   so `npm test` and CI never need credentials or a runtime.
//   sandcastle    — real Claude Code agents in Podman containers, one isolated
//                   git worktree per step (see ./sandcastle/index.ts).
import type { SkillContext, SkillResult, Step } from "../types.ts";
import { HallmarkError } from "../util.ts";

import { runSpec } from "./deterministic/spec.ts";
import { runPlan } from "./deterministic/plan.ts";
import { runBuild } from "./deterministic/build.ts";
import { runReview } from "./deterministic/review.ts";
import { runShip } from "./deterministic/ship.ts";

export type ProviderName = "deterministic" | "sandcastle";

const DETERMINISTIC: Record<Step, (ctx: SkillContext) => SkillResult> = {
  spec: runSpec,
  plan: runPlan,
  build: runBuild,
  review: runReview,
  ship: runShip,
};

export function activeProvider(): ProviderName {
  const raw = process.env.HALLMARK_SKILLS?.trim().toLowerCase();
  if (!raw || raw === "deterministic") return "deterministic";
  if (raw === "sandcastle") return "sandcastle";
  throw new HallmarkError(
    `Unknown HALLMARK_SKILLS='${raw}'. Expected 'deterministic' or 'sandcastle'.`,
  );
}

// `ship` only writes a fixed merge-request JSON — there is no judgement in it,
// so it stays deterministic under every provider. Spending an agent on it would
// buy nondeterminism and latency for nothing.
const AGENTIC_STEPS: ReadonlySet<Step> = new Set<Step>([
  "spec",
  "plan",
  "build",
  "review",
]);

export async function runSkill(step: Step, ctx: SkillContext): Promise<SkillResult> {
  if (activeProvider() === "sandcastle" && AGENTIC_STEPS.has(step)) {
    // Imported lazily so the deterministic path never loads sandcastle, and a
    // container runtime is never needed just to run the test suite.
    const { runAgenticSkill } = await import("./sandcastle/index.ts");
    return runAgenticSkill(step, ctx);
  }
  return DETERMINISTIC[step](ctx);
}
