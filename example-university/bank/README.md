# The bank

The reference implementation the lessons refer to. Small on purpose: enough
domain to make verification meaningful, not enough to become a product.

```bash
npm run university:test     # 38 tests
```

## Modules

| File | Responsibility |
| --- | --- |
| `reference/src/money.ts` | integer minor units, currency in the type |
| `reference/src/journal.ts` | append-only transactions, the balance invariant |
| `reference/src/ledger.ts` | balances and trial balance as projections |
| `reference/src/transfer.ts` | atomic transfers, idempotency keys |
| `reference/src/conformance.ts` | the domain checks **the runner owns** (lesson 7) |

`conformance.ts` is the one to read closely. Everything else is the bank;
that file is what makes the bank's rules enforceable by hallmark.

## The feature backlog

The increments the lessons deliver, in order. Each is a plausible hallmark run.

| Run | Title | Introduced in |
| --- | --- | --- |
| BANK-1 | Record a balanced transfer between two accounts | lesson 1 |
| BANK-2 | Reject an unbalanced transaction | lesson 2 |
| BANK-3 | Make transfers idempotent under retry | lesson 6 |
| BANK-4 | Derive account statements | lesson 6 (refused — WIP limit) |
| BANK-5 | Append-only journal with a balanced-transaction invariant | lesson 7 |

## Why this is not CRUD

A CRUD bank stores a `balance` column and updates it:

```sql
UPDATE accounts SET balance = balance - 100 WHERE id = 'alice';
UPDATE accounts SET balance = balance + 100 WHERE id = 'bob';
```

Two statements, and every hard problem in the domain lives in the gap between
them. Crash after the first and money has vanished. Run two transfers
concurrently and read-modify-write loses one. Ask what the balance was last
Tuesday and the answer has been overwritten. Ask *why* the balance is what it is
and there is no record at all.

The append-only version has none of those gaps, because the two postings are one
transaction that is validated as a unit and never mutated afterwards. The
balance is computed when you ask for it:

```ts
balanceOf(journal, "alice", "PLN")              // now
balanceOf(journal, "alice", "PLN", lastTuesday) // then
```

The history *is* the state. That is the same claim hallmark makes about
`.hallmark/runs/` versus the labels it projects — see lesson 4.

## Deliberately out of scope

Named so the boundary is a decision rather than an oversight:

- **Authorization holds** — pending vs. settled funds, and the expiry of a hold.
- **Interest accrual** — daily accrual, periodic capitalisation.
- **FX** — multi-currency conversion with a rate source and a spread.
- **Statements** — period boundaries, opening/closing balances, ordering.
- **Concurrency control** — the journal is an in-memory array; a real one needs
  an append with an isolation guarantee.
- **Persistence, auth, an API surface** — nothing here is wired to a database or
  a network.

Each would be a natural next hallmark run. None is needed to demonstrate why a
verifier that re-derives balances beats one that trusts a build report.
