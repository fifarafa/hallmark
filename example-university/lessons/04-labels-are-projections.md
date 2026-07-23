# Lesson 4 — Labels are projections

**Concept:** state lives in one place; everything else is derived and rebuildable.

This is the lesson that transfers directly into the banking domain, so it is
worth reading twice.

## Vandalise the labels

BANK-1 shipped in lesson 1. Set its Jira label to something wrong, strip the
GitLab label entirely, then reconcile:

```bash
# epic labels := ["hallmark:state:STARTED", "team:payments"]   (wrong + unrelated)
# MR labels   := []                                            (missing)

npm run hallmark -- reconcile BANK-1
```

([`transcripts/04-labels-rebuilt.txt`](../transcripts/04-labels-rebuilt.txt))

```json
{
  "key": "BANK-1",
  "labels": [
    "team:payments",
    "hallmark:shipped"
  ]
}
```

Three things happened, and each is deliberate:

1. **The wrong label was dropped.** `hallmark:state:STARTED` is gone — not
   merged with, not appended to. Reconciliation computes the desired label set
   from canonical state and replaces the `hallmark:*` namespace wholesale.
2. **The correct label was restored.** `hallmark:shipped` came back from
   `labelsFor(state)`, a pure function of the run's state. Nothing read the old
   label to decide.
3. **`team:payments` survived.** Reconciliation only owns its own namespace.
   Labels other people set are not yours to delete.

Run `reconcile` again and nothing changes. It is idempotent by construction,
because it computes a target and converges to it rather than applying a diff.

## Why not just store the label?

Because two systems would then hold the same fact. Jira says `shipped`, GitLab
says `in-review`, and now there is no answer to "which is right?" — only a
guess about which was written last.

Deriving instead of storing means:

- A projection can never disagree with state; at worst it is *stale*, and
  `reconcile` fixes stale.
- A failed API call cannot corrupt the workflow. Lesson 5.
- Adding a third system is a new projection, not a new source of truth.

**The workflow never reads a label to decide what to do next.** Grep for it —
`stepForState` takes a state, not a label.

## The same idea, in the bank

This is exactly the design in `bank/reference/src/ledger.ts`:

| Hallmark | The bank |
| --- | --- |
| `.hallmark/runs/<id>.json` is canonical | the journal is canonical |
| `labelsFor(state)` derives a label | `balanceOf(journal, id)` derives a balance |
| Never read a label to decide | Never read a balance to decide |
| `reconcile` rebuilds labels | replay rebuilds balances |

A stored `balance` column is the banking equivalent of a stored label: a second
copy of a fact you already have, which can drift, and which no amount of care
keeps in sync under concurrency. Derive it and the drift is structurally
impossible.

You even get capabilities the stored version cannot offer. `balanceOf` takes an
optional `asOf` timestamp and answers "what was this balance last Tuesday?" — a
question a mutable column has permanently destroyed the ability to answer.

```bash
npm run university:test    # see ledger.test.ts, "as it stood at a past moment"
```

---

Next: [Lesson 5 — Surviving partial failure](05-surviving-partial-failure.md)
