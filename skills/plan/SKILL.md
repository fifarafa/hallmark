# Skill: plan

## Responsibility
Read the specification and produce a small implementation plan plus three Jira
tasks under the epic.

## Inputs
- `runId`
- `artifacts/<runId>/spec.md` (read)

## Outputs (artifacts only)
- `artifacts/<runId>/plan.md` — references the spec's Acceptance Criteria.
- `.simulated/jira/tasks/<runId>-1.json` — Implement invoice archive function
- `.simulated/jira/tasks/<runId>-2.json` — Add automated tests
- `.simulated/jira/tasks/<runId>-3.json` — Prepare verification and merge request

Each task has an empty `labels` array and `epic: <runId>`.

## Boundaries
- MUST NOT write canonical state, set labels, or transition.

## What the runner independently verifies before PLANNED
- Plan exists.
- Exactly three tasks exist for the epic.
- Every task references epic `<runId>`.
- Task keys are unique.
- Plan references the Acceptance Criteria.
