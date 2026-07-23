# Hallmark University

A seven-lesson course in **hallmark** — the control plane in this repository —
taught by building the core of a retail bank.

The subject is hallmark. The bank is the vehicle, chosen for one specific
reason: **banking invariants are machine-checkable.** "Debits equal credits" can
be independently proven by a verifier; "the code is well designed" cannot. A
domain whose rules are arithmetic is the ideal way to showcase a runner whose
entire thesis is *verify, don't trust*.

## The lessons

| # | Lesson | Hallmark concept |
| --- | --- | --- |
| 1 | [Your first run](lessons/01-your-first-run.md) | explicit state machine, one canonical source of truth |
| 2 | [Claims are not proof](lessons/02-claims-are-not-proof.md) | skills declare, the runner verifies |
| 3 | [Writing verifiable specs](lessons/03-writing-verifiable-specs.md) | a verifier enforces only what is checkable |
| 4 | [Labels are projections](lessons/04-labels-are-projections.md) | derive, never store, what you can rebuild |
| 5 | [Surviving partial failure](lessons/05-surviving-partial-failure.md) | state must not depend on side effects succeeding |
| 6 | [The cost of WIP](lessons/06-the-cost-of-wip.md) | one active run, enforced |
| 7 | [Teaching the runner banking](lessons/07-teaching-the-runner-banking.md) | domain invariants in the verifier |

Read them in order — each builds on the run state the previous one left behind.

**Lesson 2 is the one to read if you only read one.** It is the thesis in a
single command: forge a review decision, watch the runner reject it, watch the
revision refuse to move.

**Lesson 7 is the payoff.** It closes the gap the first six leave open: out of
the box, hallmark verifies the shape of your process, not the correctness of
your domain. Lesson 7 puts banking rules inside the verifier, so an agent can no
longer earn `BUILT` by writing code that passes its own tests while conjuring
money.

## Cost and setup

Lessons 1–6 need **nothing**: no containers, no credentials, no network. They
run on hallmark's deterministic provider in about a second.

```bash
npm install
npm run hallmark -- start BANK-1 --title "Record a balanced transfer between two accounts"
```

Every lesson embeds real captured output in [`transcripts/`](transcripts/), so
you can read the whole course start to finish without running anything.

Lesson 7's optional agentic section costs tokens and needs Podman plus a Claude
Code token — see the repo [README](../README.md#running-real-agents-hallmark_skillssandcastle).
Its output will differ from the reference every time it runs. That is what
nondeterminism means, and precisely why the verifier exists.

## The bank

[`bank/`](bank/) holds the reference implementation the lessons refer to. It is
real, typechecked under `strict` + `noUncheckedIndexedAccess`, and tested:

```bash
npm run university:test     # 38 tests
```

Five ideas, none of them CRUD:

1. **Money is integer minor units** with a currency in the type. Never floats —
   `0.1 + 0.2 !== 0.3` is a real banking bug, not a curiosity.
2. **The journal is append-only.** Postings are never updated or deleted.
3. **Every transaction balances**, rejected at write time otherwise. This is
   what makes money impossible to conjure.
4. **Balance is a projection** — a fold over the journal, never a stored column.
   The same relationship hallmark has between canonical state and labels.
5. **Transfers are atomic** and **idempotency keys** make retries safe, because
   at-least-once is the only delivery guarantee you actually get.

[`bank/README.md`](bank/README.md) has the feature backlog and what is
deliberately out of scope.

## Reading order if you are short on time

- 20 minutes: lesson 1, then lesson 2, then the table in lesson 3.
- An hour: all seven, skipping the optional agentic run in lesson 7.
- A day: run every command, then do the sabotage table in lesson 2 yourself.
  Trying to fool the verifier teaches more than reading about it.
