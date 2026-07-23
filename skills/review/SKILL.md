# Skill: review

## Responsibility
Perform a local review of the built feature and record a decision.

## Inputs
- `runId`
- `workspace/<runId>/src/invoiceArchive.ts` (read)
- `workspace/<runId>/test/invoiceArchive.test.ts` (read)

## Checks performed
- Conformance to the spec (function name, returned shape).
- Presence of tests.
- No unrelated changes / no `TODO` / `FIXME`.
- Simplicity of the implementation.
- The test actually asserts the returned object's value.

## Outputs (artifacts only)
- `artifacts/<runId>/review.md` containing exactly one of:
  - `Decision: APPROVED`
  - `Decision: CHANGES_REQUESTED`

In the happy path the decision is `APPROVED`.

## Boundaries
- MUST NOT write canonical state, set labels, or transition.

## What the runner independently verifies before REVIEWED
- Re-runs the feature tests.
- Review artifact exists and the decision is exactly `APPROVED`.
- A `CHANGES_REQUESTED` decision blocks the transition.
