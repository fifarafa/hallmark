// Shared type definitions for the hallmark-run workflow engine.
// These are plain data shapes — no behaviour lives here.

export type State =
  | "STARTED"
  | "SPECIFIED"
  | "PLANNED"
  | "BUILT"
  | "REVIEWED"
  | "SHIPPED";

export type Step = "spec" | "plan" | "build" | "review" | "ship";

export type ProjectionName = "jira" | "gitlab";

export type ProjectionStatus = "pending" | "synced" | "failed";

export type Projection = {
  status: ProjectionStatus;
  lastReconciledRevision: number | null;
  lastError: string | null;
};

// The single canonical source of truth for one run. Only the runner writes this.
export type RunState = {
  runId: string;
  title: string;
  workflowVersion: string;
  state: State;
  revision: number;
  createdAt: string;
  updatedAt: string;
  active: boolean;
  currentStep: Step | null;
  // step name -> representative evidence path produced by that skill
  evidence: Record<string, string>;
  projections: {
    jira: Projection;
    gitlab: Projection;
  };
};

// What a skill hands back to the runner. `success: true` is a *declaration*,
// never accepted as proof — the runner verifies evidence independently.
export type SkillResult = {
  skill: Step;
  success: boolean;
  summary: string;
  evidencePaths: string[];
  metadata: Record<string, unknown>;
};

// Context the runner passes into a skill. A skill sees only this — never the
// canonical run file, never the projection systems' label state.
export type SkillContext = {
  runId: string;
  title: string;
};

// Result of the runner's independent verification of a proposed transition.
export type Verdict = {
  ok: boolean;
  reason: string;
};
