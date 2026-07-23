# Skill: ship

## Responsibility
Simulate opening a merge request and write a ship report.

## Inputs
- `runId`
- `title`

## Outputs (artifacts only)
- `.simulated/gitlab/merge-requests/<iid>.json` with:
  `state: "opened"`, `relatedTicket: <runId>`,
  `title: "<runId>: <title>"`, empty `labels`.
- `artifacts/<runId>/ship-report.md`

The `iid` is allocated as the next free integer (reused if this run already has
an MR), so multiple runs get distinct merge requests.

## Boundaries
- MUST NOT write canonical state, set labels, or transition.

## What the runner independently verifies before SHIPPED
- MR exists with `relatedTicket == runId`.
- MR title is `"<runId>: <title>"`.
- MR `state == "opened"`.
- Ship report exists.
- The feature tests still pass.
- The review decision is still `APPROVED`.
