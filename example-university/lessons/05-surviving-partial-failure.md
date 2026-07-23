# Lesson 5 — Surviving partial failure

**Concept:** the workflow must not depend on every external side effect
succeeding.

Lesson 4 established that labels are derived. This lesson shows what that buys
you the day an external system is down.

## Ship into an outage

BANK-2 is at REVIEWED. Ship it while GitLab is unavailable:

```bash
SIMULATE_GITLAB_FAILURE_ONCE=1 npm run hallmark -- next BANK-2
npm run hallmark -- status BANK-2
```

([`transcripts/05-partial-failure.txt`](../transcripts/05-partial-failure.txt))

```
State: SHIPPED          <- the transition committed
Revision: 6
  Jira:   synced at revision 6
  GitLab: failed (...)  <- only the projection failed
```

Then heal it:

```bash
npm run hallmark -- reconcile BANK-2
#   GitLab: synced at revision 6
```

**No canonical state changed during the repair.** The run was already SHIPPED;
reconciliation only caught the projection up.

## The alternative is worse than it looks

Suppose the transition were transactional with the API call — fail the label
write, fail the step. Now a GitLab blip means:

- Work that genuinely shipped is recorded as not shipped.
- Retrying re-runs the *skill*, not just the projection: rebuilding, re-testing,
  possibly re-opening a merge request that already exists.
- Your workflow's availability is the product of every external system's
  availability. Three dependencies at 99% each gives you 97%.

Hallmark commits state first and projects afterwards. A projection failure is
recorded as a fact about the projection — `status: "failed"` with the error —
never as a fact about the work.

## Read the code

In `src/runner.ts`, `reconcileAll` wraps each projection in its own `try`:

```ts
try {
  const outcome = reconcileJira(runId);
  ...
} catch (err) {
  markJiraFailed(runId, msg);
  appendEvent(runId, { type: "PROJECTION_FAILED", ... });
}
```

Two properties fall out. Jira and GitLab fail **independently** — one outage
does not take the other down. And the failure is recorded in the history as an
event, so "why is this label wrong?" has an answer with a timestamp.

## The outage is genuinely one-time

The env var alone would fail forever. `.hallmark/markers/<runId>.gitlab-failure-consumed`
records that the fault has been used, so the retry succeeds even with the
variable still set. Otherwise the demo would prove that a permanent outage stays
broken, which is not interesting.

## The banking parallel

Same shape as an idempotency key (lesson 4's reference code, `transfer.ts`). A
payment network that times out has not told you whether the payment happened.
Retrying blindly moves money twice; refusing to retry loses the payment. The
resolution in both cases is to make the retry safe rather than to avoid it:

- The bank: the same idempotency key replays the original result.
- The runner: `reconcile` converges on the desired label set, whatever the
  current one is.

Both are idempotent because both compute a target rather than apply a delta.

---

Next: [Lesson 6 — The cost of WIP](06-the-cost-of-wip.md)
