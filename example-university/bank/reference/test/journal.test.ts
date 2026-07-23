import { test } from "node:test";
import assert from "node:assert/strict";
import { money } from "../src/money.ts";
import {
  UnbalancedTransactionError,
  appendTransaction,
  isBalanced,
  type Journal,
  type Transaction,
} from "../src/journal.ts";

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: "tx-1",
  at: "2026-01-01T00:00:00.000Z",
  description: "test",
  postings: [
    { accountId: "alice", amount: money(100, "PLN"), direction: "debit" },
    { accountId: "bank", amount: money(100, "PLN"), direction: "credit" },
  ],
  ...over,
});

test("a balanced transaction is accepted", () => {
  const journal = appendTransaction([], tx());
  assert.equal(journal.length, 1);
});

test("an unbalanced transaction is rejected at write time", () => {
  // Debit 100 but credit only 60: 40 would appear from nowhere.
  const bad = tx({
    postings: [
      { accountId: "alice", amount: money(100, "PLN"), direction: "debit" },
      { accountId: "bank", amount: money(60, "PLN"), direction: "credit" },
    ],
  });
  assert.throws(() => appendTransaction([], bad), UnbalancedTransactionError);
});

test("the rejection message names the currency and the gap", () => {
  const bad = tx({
    postings: [
      { accountId: "alice", amount: money(100, "PLN"), direction: "debit" },
      { accountId: "bank", amount: money(60, "PLN"), direction: "credit" },
    ],
  });
  assert.throws(() => appendTransaction([], bad), /PLN off by 40/);
});

test("a transaction must balance in every currency independently", () => {
  // Each leg nets to zero overall only if you wrongly add PLN to EUR.
  const bad = tx({
    postings: [
      { accountId: "alice", amount: money(100, "PLN"), direction: "debit" },
      { accountId: "bank", amount: money(100, "EUR"), direction: "credit" },
    ],
  });
  assert.throws(() => appendTransaction([], bad), UnbalancedTransactionError);
});

test("a multi-currency transaction balancing in both is accepted", () => {
  const ok = tx({
    postings: [
      { accountId: "alice", amount: money(100, "PLN"), direction: "debit" },
      { accountId: "bank", amount: money(100, "PLN"), direction: "credit" },
      { accountId: "alice", amount: money(50, "EUR"), direction: "debit" },
      { accountId: "bank", amount: money(50, "EUR"), direction: "credit" },
    ],
  });
  assert.equal(appendTransaction([], ok).length, 1);
});

test("negative posting amounts are rejected", () => {
  // Direction carries the sign; a negative amount is a contradictory second way
  // to say the same thing, and lets a 'debit' secretly credit.
  const bad = tx({
    postings: [
      { accountId: "alice", amount: money(-100, "PLN"), direction: "debit" },
      { accountId: "bank", amount: money(-100, "PLN"), direction: "credit" },
    ],
  });
  assert.throws(() => appendTransaction([], bad), /negative amount/);
});

test("an empty transaction is rejected", () => {
  assert.throws(
    () => appendTransaction([], tx({ postings: [] })),
    UnbalancedTransactionError,
  );
});

test("appending never mutates the journal it was given", () => {
  const before: Journal = [];
  const after = appendTransaction(before, tx());
  assert.equal(before.length, 0); // the input is untouched
  assert.equal(after.length, 1);
});

test("isBalanced agrees with the writer", () => {
  assert.ok(isBalanced(tx().postings));
  assert.ok(
    !isBalanced([
      { accountId: "alice", amount: money(1, "PLN"), direction: "debit" },
    ]),
  );
});
