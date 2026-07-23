# Lesson 6 — The cost of WIP

**Concept:** at most one active run, enforced rather than encouraged.

## Try to start two things

```bash
npm run hallmark -- start BANK-3 --title "Make transfers idempotent under retry"
npm run hallmark -- start BANK-4 --title "Derive account statements"
```

([`transcripts/06-wip-limit.txt`](../transcripts/06-wip-limit.txt))

```
Error: Cannot start BANK-4. Active run BANK-3 is currently in state STARTED.
Next legal step: spec.
WIP is limited to one active run — finish (ship) BANK-3 first.
(exit code 1)
```

Note the refusal is *useful*: it names what is blocking, what state it is in,
and the single command that moves it forward. A limit you cannot act on is just
an obstacle.

```bash
npm run hallmark -- list
#   BANK-1  SHIPPED  (rev 6)  next=(done)
#   BANK-2  SHIPPED  (rev 6)  next=(done)
# * BANK-3  STARTED  (rev 1)  next=spec
```

The `*` marks the one run that is active. `SHIPPED` sets `active: false`, so
finishing work is what buys the capacity to start more.

## Why enforce it in a tool

Half-finished work is invisible. It does not appear on a burndown, it does not
fail a build, and its cost — context reloaded, review queues stalled, merge
conflicts aged — is paid diffusely by everyone later. The usual response is a
WIP column on a board that nobody's tooling actually enforces.

Making it a hard stop converts a diffuse cost into an immediate one. You feel it
at the moment you create it, which is the only moment you can cheaply decide not
to.

## Why it matters more with agents

An agentic pipeline makes starting work nearly free. Four parallel runs is one
shell loop away, and each will happily produce a spec, a plan, and a branch.

What does not get cheaper is the human review at the end, or the merge conflicts
between four agents editing adjacent code, or your ability to hold four
half-finished features in your head while judging whether each is correct. The
bottleneck moves to verification, and unbounded WIP floods it.

The limit is `active: true` on exactly one run — a single boolean, checked in
`createRun`. Cheap to implement, and the cheapness is the point: this is a
policy that pays for itself.

## Where you would relax it

For a real team, one active run globally is too strict. The useful shapes are:

- One active run **per developer**, keeping the personal focus property.
- One per **component**, so unrelated work proceeds but conflicts do not.
- A small **global cap** (say 3), tuned to review capacity rather than to how
  many agents you can afford to run.

All three are the same check against a different scope. What you should not do
is remove it and rely on discipline — that is what a board column already is.

---

Next: [Lesson 7 — Teaching the runner banking](07-teaching-the-runner-banking.md)
