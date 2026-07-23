# Lesson 3 — Writing verifiable specs

**Concept:** a verifier can only enforce what the spec makes checkable.

Lesson 2 showed the runner refusing to trust a claim. But verification has a
ceiling: it can only check properties someone wrote down objectively. This is
where the banking domain earns its place in this course.

## Two acceptance criteria

> The system handles money safely and follows accounting best practices.

> Every transaction's debits equal its credits in each currency, and the sum of
> all account balances is zero.

Both sound reasonable. Only the second can be *checked*. The first has no
failing case — you cannot write a test that proves its absence, so an agent can
satisfy it by asserting it has. The second is a property with a decision
procedure: compute it, compare to zero.

This is why a bank is the right vehicle for showcasing hallmark. Its core rules
are arithmetic. "Debits equal credits" is not a matter of taste.

## The test

For each criterion, ask: **what input would make this fail, and how would I
detect it?** If you cannot answer, an agent cannot satisfy it and a verifier
cannot enforce it.

| Unfalsifiable | Checkable |
| --- | --- |
| "Handles concurrency correctly" | "Two transfers from the same account never produce a negative balance" |
| "Is well tested" | "Every acceptance criterion has a test asserting a returned value" |
| "Uses proper types for money" | "Constructing `money(12.34, 'PLN')` throws" |
| "Transfers are reliable" | "Replaying a transfer with the same idempotency key leaves balances unchanged" |
| "Follows double-entry principles" | "Appending an unbalanced transaction throws" |

The right-hand column is what `example-university/bank/reference/test/` actually
asserts. Read `journal.test.ts` alongside this table.

## What the runner already enforces

Every step's verification greps for literal markers, which is why the prompts in
`skills/*/SKILL.md` state them explicitly:

- `spec` must contain `## Acceptance Criteria` and `Definition of Done`.
- `plan` must reference `Acceptance Criteria` and produce exactly three tasks.
- `build` must produce sources with no `TODO`/`FIXME` and tests that pass.
- `review` must say exactly `Decision: APPROVED`.

Note what is *not* on that list: anything about the feature itself. Out of the
box the runner checks the shape of your process, not the correctness of your
domain. It will happily ship a ledger that invents money, as long as the tests
the agent wrote are green.

Closing that gap is lesson 7.

## Write one

Replace the deterministic spec with your own and check it against the table:

```markdown
## Acceptance Criteria
- `appendTransaction` throws when debits do not equal credits in any currency.
- `balanceOf` returns the sum of debits minus credits for the account.
- `trialBalance` is zero for every currency in any journal built via `transfer`.
- A transfer replayed with the same idempotency key does not change balances.
- An automated test covers each of the above and passes.

## Definition of Done
- All acceptance criteria have passing tests.
- No TODO/FIXME in the implementation.
- Review decision is APPROVED.
```

Every line has a failing case. That is the bar.

---

Next: [Lesson 4 — Labels are projections](04-labels-are-projections.md)
