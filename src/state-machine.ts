// The explicit state machine. Transitions are total and linear — no skipping.
import type { State, Step } from "./types.ts";

export const WORKFLOW_VERSION = "0.1.0";

export const STATES: readonly State[] = [
  "STARTED",
  "SPECIFIED",
  "PLANNED",
  "BUILT",
  "REVIEWED",
  "SHIPPED",
];

// For each state, the single legal next state (null = terminal).
export const NEXT_STATE: Record<State, State | null> = {
  STARTED: "SPECIFIED",
  SPECIFIED: "PLANNED",
  PLANNED: "BUILT",
  BUILT: "REVIEWED",
  REVIEWED: "SHIPPED",
  SHIPPED: null,
};

// The skill that must run to leave a given state (null = terminal, nothing to do).
export const STEP_FOR_STATE: Record<State, Step | null> = {
  STARTED: "spec",
  SPECIFIED: "plan",
  PLANNED: "build",
  BUILT: "review",
  REVIEWED: "ship",
  SHIPPED: null,
};

// Labels are a *projection* of the canonical state, never a source of truth.
export const LABELS_BY_STATE: Record<State, string[]> = {
  STARTED: ["hallmark:started"],
  SPECIFIED: ["hallmark:specified"],
  PLANNED: ["hallmark:planned"],
  BUILT: ["hallmark:built"],
  REVIEWED: ["hallmark:reviewed"],
  SHIPPED: ["hallmark:shipped"],
};

export function nextState(state: State): State | null {
  return NEXT_STATE[state];
}

export function stepForState(state: State): Step | null {
  return STEP_FOR_STATE[state];
}

export function labelsForState(state: State): string[] {
  return LABELS_BY_STATE[state];
}
