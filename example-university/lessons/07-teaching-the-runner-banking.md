# Lesson 7 — Teaching the runner banking

**Concept:** domain invariants belong in the verifier, not only in the tests.

Everything so far has been generic. The runner checks that artifacts exist, that
markers are present, that tests pass. It knows nothing about money — and would
happily ship a ledger that invents it, provided the agent's own tests are green.

This lesson closes that gap, and it is where hallmark stops being a workflow
engine and starts being a guarantee.

## The hole

An agent proves its work by writing tests. But the agent also *writes* those
tests. "The tests pass" therefore means only: **the code agrees with the agent's
own idea of correctness.** If the agent misunderstands double-entry, its tests
encode the misunderstanding and pass with confidence.

Here is a transfer implementation that credits the destination without debiting
the source, and a test that certifies it:

```ts
const cheating: Journal = [
  { id: "tx-1", description: "bonus",
    postings: [{ accountId: "bob", amount: money(100_00, "PLN"), direction: "debit" }] },
];

// The agent's own test, and it genuinely passes:
assert.equal(balanceOf(cheating, "bob", "PLN").minor, 100_00);
```

Bob received 100.00. The test is green. Money appeared from nowhere.

## The fix: a harness the agent does not own

Run it against `bank/reference/src/conformance.ts`
([`transcripts/08-conformance-catches-cheat.txt`](../transcripts/08-conformance-catches-cheat.txt)):

```
agent's test: bob received 100.00 -> PASS
runner verdict: REJECTED
reason: transaction-balances: Transaction tx-1 (bonus) does not balance. (+2 more)

all findings:
  - [transaction-balances] Transaction tx-1 (bonus) does not balance.
  - [trial-balance-zero] Trial balance for PLN is 100.00 PLN, expected 0.
                         The journal has created or destroyed money.
  - [at-least-two-accounts] Transaction tx-1 touches 1 account(s).
```

Same code, same green test, opposite verdict — because the harness asserts
**properties of the domain**, not examples chosen by the author:

| Check | Catches |
| --- | --- |
| `transaction-balances` | debits ≠ credits in any single transaction |
| `trial-balance-zero` | money created or destroyed across the whole journal |
| `no-negative-postings` | a "debit" that secretly credits |
| `at-least-two-accounts` | a balanced but meaningless self-cancelling entry |
| `idempotency-keys-unique` | a retry that posted twice |
| `balance-matches-replay` | a projection that has drifted from its history |

Note `at-least-two-accounts`. A transaction that debits and credits the *same*
account for the same amount balances perfectly and moves nothing — per-transaction
balance alone would wave it through. Properties compose; examples do not.

## Wiring it into verification

`verifyBuilt` in `src/verification.ts` currently ends with the generic check:

```ts
  // Do not trust the report — re-run the tests ourselves.
  const testRun = runFeatureTests(run.runId);
  if (testRun.code !== 0) {
    return fail(`automated tests returned exit code ${testRun.code}.`);
  }
  return ok;
```

Add the domain gate after it:

```ts
  // Domain invariants the agent cannot weaken: load the journal the built
  // module produces and check it against properties we own.
  const journal = await loadJournalFrom(featureSrcDir(run.runId));
  const report = checkJournal(journal);
  if (!report.ok) {
    return fail(`ledger invariant violated — ${summarise(report)}`);
  }
  return ok;
```

Now `BUILT` requires green tests **and** a sound ledger. An agent can no longer
earn the transition by being convincing.

## Why the agent cannot simply delete this

Under the sandcastle provider the agent works in a git worktree, and `src/` is
in that worktree — so it *can* edit `conformance.ts`. The reason that does not
help it is the copy-out allowlist in `src/skills/sandcastle/index.ts`:

```ts
build: (r) => [
  `workspace/${r}`,
  `artifacts/${r}/build-report.md`,
  `artifacts/${r}/test-output.txt`,
],
```

`src/` is not on the list, so any edit to the harness dies with the worktree.
The runner executes the host's copy. **The examinee cannot rewrite the exam** —
not by policy, but because the edit has nowhere to go.

That is the same mechanism that stops an agent forging `.hallmark/runs/<id>.json`,
applied to a different file.

## Run it yourself

```bash
npm run university:test
```

38 tests. `conformance.test.ts` deliberately constructs corrupt journals —
bypassing `appendTransaction` — to prove the harness notices what a passing unit
suite would not.

Then the real thing, which costs tokens and takes a few minutes:

```bash
HALLMARK_SKILLS=sandcastle npm run hallmark -- start BANK-5 \
  --title "Append-only journal with a balanced-transaction invariant"
HALLMARK_SKILLS=sandcastle npm run hallmark -- next BANK-5
```

Four real agents, each in a Podman container, each verified independently. A
captured run is in [`transcripts/07-agentic-chain.txt`](../transcripts/07-agentic-chain.txt):

```
SPEC   -> SPECIFIED   agent: success (38s)   runner verdict: VERIFIED
PLAN   -> PLANNED     agent: success (43s)   runner verdict: VERIFIED
BUILD  -> BUILT       agent: success (94s)   runner verdict: VERIFIED
REVIEW -> REVIEWED    agent: success (59s)   runner verdict: VERIFIED
```

Every line has two verdicts. The agent's is a claim. The runner's is the one
that moved the state.

Your output will differ from the reference — that is what nondeterminism means,
and why the verifier exists.

---

Back to the [course index](../README.md).
