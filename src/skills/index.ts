// Skill registry: maps a step name to its deterministic implementation.
import type { SkillContext, SkillResult, Step } from "../types.ts";
import { runSpec } from "./spec.ts";
import { runPlan } from "./plan.ts";
import { runBuild } from "./build.ts";
import { runReview } from "./review.ts";
import { runShip } from "./ship.ts";

const SKILLS: Record<Step, (ctx: SkillContext) => SkillResult> = {
  spec: runSpec,
  plan: runPlan,
  build: runBuild,
  review: runReview,
  ship: runShip,
};

export function runSkill(step: Step, ctx: SkillContext): SkillResult {
  return SKILLS[step](ctx);
}
