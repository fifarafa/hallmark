# example-university — design

Date: 2026-07-23
Status: approved

## Purpose

Showcase **hallmark** — its control plane, and specifically its "a skill's claim
is not proof" thesis. A retail bank is the vehicle, not the subject.

The bank earns its place for one reason: **banking invariants are
machine-checkable.** "Debits equal credits" can be independently proven by a
verifier; "the code is well designed" cannot. A domain with objective invariants
is the ideal showcase for a runner built to verify rather than trust.

## Non-goals

- Teaching banking architecture as an end in itself.
- A general double-entry accounting library.
- Replacing the repo README, which stays the reference for the control plane.

## Structure

```
example-university/
  README.md                            the curriculum
  lessons/
    01-your-first-run.md               pipeline, states, evidence, history
    02-claims-are-not-proof.md         forge evidence, watch verification reject
    03-writing-verifiable-specs.md     checkable criteria vs. unfalsifiable ones
    04-labels-are-projections.md       delete labels, reconcile, rebuild
    05-surviving-partial-failure.md    projection outage, canonical state survives
    06-the-cost-of-wip.md              one active run, and why
    07-teaching-the-runner-banking.md  domain invariants in the verifier
  bank/
    README.md                          the feature backlog lessons deliver
    reference/src/*.ts                 the reference bank
    reference/test/*.test.ts           its tests
  transcripts/                         real captured output
```

## The seven lessons

Each lesson heading is a **hallmark concept**; the bank feature is what you
happen to be delivering while learning it.

1. **Your first run** — drive `spec → plan → build → review → ship`, read
   `status` and `history`, see evidence recorded per step.
2. **Claims are not proof** — hand-edit `review.md` to `Decision: APPROVED` over
   failing code, run `next`, watch verification reject it and the revision hold.
   This is the thesis in one command.
3. **Writing verifiable specs** — acceptance criteria a machine can check
   (`debits == credits`) versus ones it cannot ("handles money safely").
4. **Labels are projections** — delete every `hallmark:*` label, run `reconcile`,
   watch them rebuild from canonical state.
5. **Surviving partial failure** — inject the one-time GitLab outage; canonical
   state commits, only the projection fails, `reconcile` heals it.
6. **The cost of WIP** — starting a second feature is refused, making
   context-switching a hard stop instead of invisible drag.
7. **Teaching the runner banking** — extend verification with a domain invariant
   so an agent cannot earn `BUILT` by writing code that passes its own tests
   while conjuring money.

## Lesson 7: the payoff

The runner owns a **conformance harness** the agent cannot weaken. It lives in
the repo, not in `workspace/`, and the sandcastle copy-out allowlist means any
edit an agent makes to it is discarded with the worktree.

The harness re-derives every balance from the journal and asserts the trial
balance is zero, then asserts the agent's module upholds it under generated
transfers. `success: true` from the agent is irrelevant.

## The bank

Double-entry, deliberately small:

- **Money** is integer minor units with a currency in the type. No floats.
- **The journal is append-only.** Postings are never updated or deleted.
- **Every transaction balances** — rejected at write time otherwise.
- **Balance is a projection**, a fold over the journal, never a stored column.
- **Transfers are atomic**; **idempotency keys** make retries safe.

Out of scope: holds, interest, FX, statements, concurrency control. Named
explicitly in `bank/README.md` so the boundary is deliberate.

## Verification

- Reference code is real and runs: `npm run university:test`.
- `example-university/**` joins `tsconfig.json` include, so it is held to the
  same `strict` + `noUncheckedIndexedAccess` bar as `src/`.
- The existing 23-test suite is untouched; `npm test` still globs `test/*.test.ts`.
- Transcripts are captured from real runs, not written by hand.

## Honest limits to state in the README

- Lessons run on the deterministic provider by default: free, offline, ~1s.
- The "build it yourself" agentic commands cost tokens and produce output that
  will differ from the reference. Lessons say so rather than implying a match.
