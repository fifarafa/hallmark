# Lesson 1 — Your first run

**Concept:** an explicit state machine with one canonical source of truth.

Most delivery pipelines answer "where is this feature?" by inferring it — from a
Jira column, a branch name, a CI badge. Those disagree eventually, because each
is written by a different system at a different time. Hallmark stores the answer
in exactly one place and derives everything else from it.

## Run it

Free, offline, about a second. No containers, no credentials.

```bash
npm run hallmark -- start BANK-1 --title "Record a balanced transfer between two accounts"
npm run hallmark -- next BANK-1     # STARTED   -> SPECIFIED
npm run hallmark -- next BANK-1     # SPECIFIED -> PLANNED
npm run hallmark -- next BANK-1     # PLANNED   -> BUILT
npm run hallmark -- next BANK-1     # BUILT     -> REVIEWED
npm run hallmark -- next BANK-1     # REVIEWED  -> SHIPPED
npm run hallmark -- status BANK-1
```

Full output: [`transcripts/01-first-run.txt`](../transcripts/01-first-run.txt).

## What to notice

**The revision increments on every transition.** `status` after shipping reads
`Revision: 6` — one for the start, five for the steps. That number is optimistic
concurrency: a writer holding revision 5 cannot commit over a run that has since
moved to 6. It is the same mechanism as a version column in a database row.

**Evidence is recorded per step**, not summarised:

```
Evidence:
  spec: artifacts/BANK-1/spec.md
  plan: artifacts/BANK-1/plan.md
  build: workspace/BANK-1/src/invoiceArchive.ts
  review: artifacts/BANK-1/review.md
  ship: .simulated/gitlab/merge-requests/1.json
```

Every state has a file behind it. "It's in review" is not a status someone typed;
it is a claim backed by an artifact that the next transition re-reads.

**`Active: false` after SHIPPED.** The run has left the board. Lesson 6 covers
why that matters.

## The history is append-only

```bash
npm run hallmark -- history BANK-1
```

([`transcripts/03-history.txt`](../transcripts/03-history.txt))

```
[rev 1] RUN_STARTED
[rev 1] SKILL_COMPLETED skill=spec
[rev 2] STATE_TRANSITIONED STARTED -> SPECIFIED
[rev 2] PROJECTION_RECONCILED projection=jira
```

Read the ordering carefully, because it encodes the whole thesis:

1. The skill completes and says it succeeded.
2. *Then* the state transitions — but only after verification you cannot see in
   this log, because it produced no event by passing.
3. *Then* the projections are reconciled.

The skill finishing and the state changing are **two separate events**. Lesson 2
is about the gap between them.

## One honest caveat

You just ran the **deterministic provider**, and it builds the same placeholder
feature no matter what `--title` says — which is why the build evidence above
reads `invoiceArchive.ts` in a lesson about transfers.

That is deliberate, not a bug. The deterministic provider exists to exercise the
control plane, not to do the work, so the lessons stay free, fast, and identical
on every machine. Lesson 7 runs real agents that build actual banking code.

---

Next: [Lesson 2 — Claims are not proof](02-claims-are-not-proof.md)
