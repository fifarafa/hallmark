# Skill: spec

## Responsibility
Turn a feature title into a specification and open a simulated Jira epic.

## Inputs
- `runId`
- `title`

## Outputs (artifacts only — never canonical state)
- `artifacts/<runId>/spec.md` — goal, scope, out-of-scope, acceptance criteria,
  and an executable Definition of Done.
- `.simulated/jira/epics/<runId>.json` — epic with an empty `labels` array.

## Boundaries
- MUST NOT write `.hallmark/runs/*.json` or history.
- MUST NOT set labels (labels are a projection owned by the reconciler).
- MUST NOT perform the state transition.
- Returns a `SkillResult`; `success: true` is a declaration, not proof.

## What the runner independently verifies before SPECIFIED
- Both files exist.
- Epic `key` equals `runId`.
- Spec contains an Acceptance Criteria section.
- Spec contains an executable Definition of Done.
