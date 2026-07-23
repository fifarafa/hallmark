# Skill: build

## Responsibility
Implement a tiny feature into an isolated workspace, run its tests, and report.

## Inputs
- `runId`

## Outputs (artifacts only)
- `workspace/<runId>/src/invoiceArchive.ts` — exports
  `getInvoiceArchive(invoiceId)` returning a hardcoded archived invoice.
- `workspace/<runId>/test/invoiceArchive.test.ts` — asserts the full object.
- `workspace/<runId>/package.json`, `tsconfig.json`.
- `artifacts/<runId>/build-report.md`
- `artifacts/<runId>/test-output.txt`

## Boundaries
- MUST NOT write canonical state, set labels, or transition.
- Reports its own test result, but the runner does not trust it.

## What the runner independently verifies before BUILT
- Re-runs the feature tests itself and checks the exit code is 0.
- Implementation file exists.
- No `TODO` / `FIXME` in the implementation.
- Build report and test output exist.
