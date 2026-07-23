import { test } from "node:test";
import assert from "node:assert/strict";
import { money } from "../src/money.ts";
import { appendTransaction, type Journal } from "../src/journal.ts";
import { balanceOf, isJournalSound } from "../src/ledger.ts";
import { InvalidTransferError, transfer } from "../src/transfer.ts";

const AT = "2026-02-01T00:00:00.000Z";

function funded(): Journal {
  return appendTransaction([], {
    id: "tx-open",
    at: "2026-01-01T00:00:00.000Z",
    description: "open alice with 100.00",
    postings: [
      { accountId: "alice", amount: money(10_000, "PLN"), direction: "debit" },
      { accountId: "bank:cash", amount: money(10_000, "PLN"), direction: "credit" },
    ],
  });
}

test("a transfer moves money and keeps the journal sound", () => {
  const { journal } = transfer(funded(), {
    from: "alice",
    to: "bob",
    amount: money(2_500, "PLN"),
    description: "rent",
    at: AT,
    id: "tx-1",
  });

  assert.equal(balanceOf(journal, "alice", "PLN").minor, 7_500);
  assert.equal(balanceOf(journal, "bob", "PLN").minor, 2_500);
  assert.ok(isJournalSound(journal));
});

test("a transfer is one transaction with two postings, never two operations", () => {
  // There is no state in which the money has left alice but not reached bob.
  const { journal, transaction } = transfer(funded(), {
    from: "alice",
    to: "bob",
    amount: money(100, "PLN"),
    description: "atomic",
    at: AT,
    id: "tx-1",
  });
  assert.equal(journal.length, 2); // the opening deposit + this one
  assert.equal(transaction.postings.length, 2);
});

test("transferring to yourself is refused", () => {
  assert.throws(
    () =>
      transfer(funded(), {
        from: "alice",
        to: "alice",
        amount: money(100, "PLN"),
        description: "self",
        at: AT,
      }),
    InvalidTransferError,
  );
});

test("a non-positive amount is refused", () => {
  for (const minor of [0, -100]) {
    assert.throws(
      () =>
        transfer(funded(), {
          from: "alice",
          to: "bob",
          amount: money(minor, "PLN"),
          description: "bad",
          at: AT,
        }),
      InvalidTransferError,
    );
  }
});

test("a retried transfer with the same key does not move money twice", () => {
  // The scenario: the client times out, never sees the response, and resends.
  const first = transfer(funded(), {
    from: "alice",
    to: "bob",
    amount: money(2_500, "PLN"),
    description: "rent",
    idempotencyKey: "client-req-42",
    at: AT,
    id: "tx-1",
  });
  assert.equal(first.replayed, false);

  const retry = transfer(first.journal, {
    from: "alice",
    to: "bob",
    amount: money(2_500, "PLN"),
    description: "rent",
    idempotencyKey: "client-req-42",
    at: AT,
    id: "tx-2",
  });

  assert.equal(retry.replayed, true);
  assert.equal(retry.journal.length, first.journal.length); // nothing appended
  assert.equal(retry.transaction.id, "tx-1"); // the original, not a new one
  assert.equal(balanceOf(retry.journal, "bob", "PLN").minor, 2_500); // not 5000
});

test("without an idempotency key, a resend really does move money twice", () => {
  // Not a bug in transfer() — it is what "at least once" delivery means when
  // the caller supplies no key. This test documents the cost of omitting one.
  const first = transfer(funded(), {
    from: "alice",
    to: "bob",
    amount: money(2_500, "PLN"),
    description: "rent",
    at: AT,
    id: "tx-1",
  });
  const second = transfer(first.journal, {
    from: "alice",
    to: "bob",
    amount: money(2_500, "PLN"),
    description: "rent",
    at: AT,
    id: "tx-2",
  });
  assert.equal(balanceOf(second.journal, "bob", "PLN").minor, 5_000);
});

test("different keys are different transfers", () => {
  const first = transfer(funded(), {
    from: "alice",
    to: "bob",
    amount: money(100, "PLN"),
    description: "one",
    idempotencyKey: "key-a",
    at: AT,
    id: "tx-1",
  });
  const second = transfer(first.journal, {
    from: "alice",
    to: "bob",
    amount: money(100, "PLN"),
    description: "two",
    idempotencyKey: "key-b",
    at: AT,
    id: "tx-2",
  });
  assert.equal(second.replayed, false);
  assert.equal(balanceOf(second.journal, "bob", "PLN").minor, 200);
});
