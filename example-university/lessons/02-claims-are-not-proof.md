# Lesson 2 — Claims are not proof

**Concept:** the skill declares; the runner verifies. This is the lesson the
whole project is named for.

A hallmark is the mark an assay office strikes into silver *after* testing it.
The maker's claim about purity is not what gets stamped — the office assays the
metal and only then marks it. A skill returning `success: true` is a maker's
claim. The runner is the assay office.

## The demonstration

Drive a run to REVIEWED, then forge the evidence — exactly what a broken or
dishonest agent would produce:

```bash
npm run hallmark -- start BANK-2 --title "Reject an unbalanced transaction"
npm run hallmark -- next BANK-2   # x4, through to REVIEWED

printf '# Review\n\nDecision: CHANGES_REQUESTED\n' > artifacts/BANK-2/review.md

npm run hallmark -- next BANK-2
```

([`transcripts/02-verification-rejects.txt`](../transcripts/02-verification-rejects.txt))

```
Error: Ship verification failed: review is not APPROVED.
Canonical state remains REVIEWED.
(exit code 1)
```

And afterwards:

```
State: REVIEWED
Revision: 5
```

**The revision did not move.** Not rolled back — never advanced. The ship skill
ran, wrote its merge request, and returned `success: true`. The runner read the
evidence anyway, disagreed, and refused the transition.

## Why this ordering is the whole design

Look at `src/runner.ts`. The sequence in `advanceOne` is:

1. Run the skill. It produces artifacts and a declared result.
2. **Verify the evidence independently** (`verifyTransition`).
3. Only then write the new state atomically.
4. Only then reconcile projections.

Step 2 never consults `result.success`. It re-reads the files from disk and, for
`build` and `review`, **re-runs the test suite in a fresh process**. A skill that
claims green tests over a failing build gets caught, because the report and the
test run are two different things.

Invert steps 2 and 3 and you have most real pipelines: state advances on the
word of the thing doing the work, and verification becomes a dashboard nobody
reads.

## Try to fool it

Worth doing, because the failure modes are the point:

| Sabotage | Result |
| --- | --- |
| `Decision: LGTM` in `review.md` | Rejected — the verifier matches `APPROVED` literally |
| Delete `artifacts/<id>/spec.md`, retry `spec` | Rejected — artifact missing |
| Add `// TODO` to the built implementation | Rejected — `verifyBuilt` greps every source file |
| Break an assertion in the generated test | Rejected — the runner re-runs the tests itself |
| Empty the `test/` directory entirely | Rejected — no tests is a failure, not a pass |

That last row is worth dwelling on. "Zero tests ran, zero failed, exit 0" is how
a naive harness reports success for code with no tests at all. `runFeatureTests`
treats an empty test directory as exit code 1 for exactly this reason.

## Where this stops being hypothetical

With the deterministic provider the skill is a stub that always does the same
thing, so you have to sabotage it by hand. With real agents (lesson 7) the claim
is genuinely unreliable: an agent can misread a spec, write a test that asserts
nothing, or report PASS from a run that never happened.

That is not an argument against agents. It is an argument for a runner that was
never going to believe them.

---

Next: [Lesson 3 — Writing verifiable specs](03-writing-verifiable-specs.md)
