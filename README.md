# hallmark-run

A local, deterministic proof-of-concept for **agentic software delivery**:

```
spec → plan → build → review → ship
```

In a real system each step would be driven by an AI agent, Jira, GitLab and
sandboxes. Here the moving parts are stubbed so the *control plane* — the part
that actually matters — can be shown clearly:

1. An explicit state machine.
2. One canonical source of truth.
3. Deterministic transitions.
4. Idempotent reconciliation.
5. Resumability.
6. WIP limited to one active feature.
7. Separation of a skill's **declaration** from the runner's **verification**.

## Why "hallmark"

A hallmark is the mark an independent assay office strikes into a piece of
silver *after* testing it. The maker's own claim about purity is not what gets
stamped — the office assays the metal itself and only then marks it. That is
exactly this runner: a skill claims `success: true`, the runner independently
verifies the evidence, and only a verified claim gets stamped into canonical
state.

## The core idea: the agent/skill is NOT the source of truth

A skill runs, produces artifacts, and returns `success: true`. The runner treats
that as a *claim*, never as proof. Before any state changes, the runner
**independently verifies the evidence** — it re-reads the files the skill wrote
and **re-runs the tests itself**. Only then does it perform an atomic transition.

Likewise, **labels are a projection of canonical state**, not state itself. You
can delete every label in the simulated Jira/GitLab and a single `reconcile`
rebuilds them from the one canonical run file. State never depends on a label,
and never depends on an external side effect having succeeded.

## Architecture

```
CLI
 ├── state machine        (explicit states + legal transitions)
 ├── skill executor       (deterministic local skills: spec/plan/build/review/ship)
 ├── evidence verifier    (re-checks artifacts, re-runs tests — trusts nothing)
 └── reconciler           (projects state onto external systems as labels)
       ├── simulated Jira      (.simulated/jira/**)
       └── simulated GitLab    (.simulated/gitlab/**)
```

Each transition performed by the runner:

1. checks the current state,
2. runs the matching skill,
3. receives a structured result,
4. **independently verifies the evidence**,
5. writes the new state **atomically** (temp file + `rename`),
6. increments `revision` (optimistic concurrency),
7. appends an event to the append-only history,
8. reconciles the projections.

If the skill or the verification fails, canonical state does **not** change.

### Where the truth lives

| Concern                     | Location                                  |
| --------------------------- | ----------------------------------------- |
| Canonical control state     | `.hallmark/runs/<runId>.json` (only writer: runner) |
| Append-only history         | `.hallmark/history/<runId>.jsonl`             |
| Feature artifacts           | `artifacts/<runId>/**`                    |
| Feature workspace + tests   | `workspace/<runId>/**`                    |
| Simulated Jira              | `.simulated/jira/**`                      |
| Simulated GitLab            | `.simulated/gitlab/**`                    |

## Requirements

- Node.js 22+ (developed on Node 26). No database, Docker, or external services.
- Dev dependencies only: `typescript`, `tsx`, `@types/node`.

## Install & run

```bash
npm install
npm test
```

CLI:

```bash
npm run hallmark -- start DEMO-1 --title "Hardcoded invoice archive endpoint"
npm run hallmark -- next DEMO-1        # exactly one legal step
npm run hallmark -- run DEMO-1         # keep taking legal steps until done/blocked
npm run hallmark -- status DEMO-1
npm run hallmark -- history DEMO-1
npm run hallmark -- reconcile DEMO-1   # idempotent
npm run hallmark -- list
```

## Full happy-path demo

```bash
npm run hallmark -- start DEMO-1 --title "Hardcoded invoice archive endpoint"
npm run hallmark -- status DEMO-1
npm run hallmark -- next DEMO-1   # STARTED   -> SPECIFIED
npm run hallmark -- next DEMO-1   # SPECIFIED -> PLANNED
npm run hallmark -- next DEMO-1   # PLANNED   -> BUILT
npm run hallmark -- next DEMO-1   # BUILT     -> REVIEWED
npm run hallmark -- next DEMO-1   # REVIEWED  -> SHIPPED
npm run hallmark -- status DEMO-1   # State: SHIPPED, Active: false
npm run hallmark -- history DEMO-1
```

(Or simply `npm run hallmark -- run DEMO-1` to do all five steps at once.)

## Partial-projection-failure demo

The merge request only exists once shipping starts, so the GitLab projection
first has something to reconcile during the **REVIEWED → SHIPPED** transition.
That is where we inject a one-time outage. Run DEMO-2 up to that step, then fail
GitLab exactly on the ship step:

```bash
npm run hallmark -- start DEMO-2 --title "Projection failure demonstration"
npm run hallmark -- next DEMO-2   # STARTED   -> SPECIFIED
npm run hallmark -- next DEMO-2   # SPECIFIED -> PLANNED
npm run hallmark -- next DEMO-2   # PLANNED   -> BUILT
npm run hallmark -- next DEMO-2   # BUILT     -> REVIEWED

# One-time GitLab outage on the ship step:
SIMULATE_GITLAB_FAILURE_ONCE=1 npm run hallmark -- next DEMO-2   # REVIEWED -> SHIPPED

npm run hallmark -- status DEMO-2
#   State: SHIPPED           <- canonical transition still committed
#   Jira: synced             <- Jira projection succeeded
#   GitLab: failed (...)     <- only the projection failed

# Heal the projection — no canonical state changes:
npm run hallmark -- reconcile DEMO-2
npm run hallmark -- status DEMO-2   # GitLab: synced
```

The outage is made genuinely one-time with a local marker file
(`.hallmark/markers/<runId>.gitlab-failure-consumed`), so even with the env var
still set, the retry succeeds. This proves the process state does **not** depend
on every external side effect succeeding.

## Why a label is a projection, not state

If labels were state, two systems (Jira and GitLab) could disagree, and a failed
API call would corrupt the workflow. Instead:

- `labelsFor(state)` is a pure function of the one canonical state.
- Reconciliation drops any existing `hallmark:*` label and applies the desired one,
  leaving non-`hallmark:` labels untouched. It is idempotent.
- If a projection is stale, wrong, or missing, `reconcile` rebuilds it. The
  workflow never reads a label to decide what to do next.

## The cost of too much WIP

The system allows **at most one `active: true` run**. Trying to `start` a second
feature while another is unfinished is refused, showing the active run, its
state, and its next legal step. This makes the cost of high WIP explicit:
context-switching and half-finished work are turned into a hard stop instead of
invisible drag. Finish (ship) the current feature before starting the next.

## How to replace the stubs later

Every stub sits behind a small, obvious seam:

- **`build` skill → a real sandbox (e.g. Sandcastle).** Replace
  `src/skills/build.ts` so it provisions a sandbox, runs the real build there,
  and returns evidence paths. The runner's `verifyBuilt` (re-running tests, exit
  code, no-TODO) stays exactly the same — it already trusts nothing.
- **Simulated Jira → real Jira API.** Replace `src/reconciliation/jira.ts`
  (label add/remove on epic + tasks) with REST calls. The `labelsFor(state)`
  contract and idempotent reconcile algorithm are unchanged.
- **Simulated GitLab → real GitLab API.** Replace `src/reconciliation/gitlab.ts`
  and the MR creation in `src/skills/ship.ts` with API calls. The one-time
  failure hook shows how transient outages are already tolerated.
- **Local JSON → durable storage.** Replace `src/run-store.ts` (atomic
  temp-file + rename, revision-based optimistic concurrency) with a database
  using a transaction and a version column. Every other module talks to it only
  through `readRun` / `updateRun` / `createRun`.

## Deliberate simplifications (proof of concept)

1. **Single-process, file-based store.** Optimistic concurrency via `revision`
   is real, but there is no cross-process locking; it assumes one operator.
2. **Skills are deterministic stubs.** They generate fixed content instead of
   invoking real agents — enough to exercise the control plane, not the work.
3. **Fixed 5-step linear pipeline.** No branching, rollback, or parallel steps;
   this is intentionally *not* a general workflow framework.
