// The conformance harness must catch a journal that has been tampered with.
// These tests build corrupt journals *deliberately*, bypassing the writer, to
// prove the harness would notice what a passing unit-test suite would not.
import { test } from "node:test";
import assert from "node:assert/strict";
import { money } from "../src/money.ts";
import type { Journal, Transaction } from "../src/journal.ts";
import { appendTransaction } from "../src/journal.ts";
import { checkJournal, summarise } from "../src/conformance.ts";
import { transfer } from "../src/transfer.ts";

const AT = "2026-03-01T00:00:00.000Z";

function honest(): Journal {
  const opened = appendTransaction([], {
    id: "tx-open",
    at: "2026-01-01T00:00:00.000Z",
    description: "open",
    postings: [
      { accountId: "alice", amount: money(10_000, "PLN"), direction: "debit" },
      { accountId: "bank:cash", amount: money(10_000, "PLN"), direction: "credit" },
    ],
  });
  return transfer(opened, {
    from: "alice",
    to: "bob",
    amount: money(2_500, "PLN"),
    description: "rent",
    idempotencyKey: "req-1",
    at: AT,
    id: "tx-1",
  }).journal;
}

test("an honest journal passes every check", () => {
  const report = checkJournal(honest());
  assert.equal(report.ok, true, summarise(report));
  assert.deepEqual(report.findings, []);
});

test("an empty journal is vacuously conformant", () => {
  assert.equal(checkJournal([]).ok, true);
});

test("conjured money is caught by the trial balance", () => {
  // Constructed directly, bypassing appendTransaction — this is what a buggy or
  // dishonest implementation would produce, and what its own tests might miss.
  const corrupt: Transaction = {
    id: "tx-forged",
    at: AT,
    description: "credit from nowhere",
    postings: [
      { accountId: "bob", amount: money(1_000_000, "PLN"), direction: "debit" },
    ],
  };
  const report = checkJournal([...honest(), corrupt]);

  assert.equal(report.ok, false);
  assert.ok(report.findings.some((f) => f.check === "trial-balance-zero"));
  assert.ok(report.findings.some((f) => f.check === "transaction-balances"));
});

test("a double-posted retry is caught by the idempotency check", () => {
  const journal = honest();
  const replayed: Transaction = {
    ...journal[journal.length - 1]!,
    id: "tx-2", // a new transaction reusing an already-used key
  };
  const report = checkJournal([...journal, replayed]);

  assert.equal(report.ok, false);
  assert.ok(report.findings.some((f) => f.check === "idempotency-keys-unique"));
});

test("a single-account transaction is caught even when it balances", () => {
  // Debit and credit the same account for the same amount: perfectly balanced,
  // and completely meaningless. Per-transaction balance alone would allow it.
  const pointless: Transaction = {
    id: "tx-pointless",
    at: AT,
    description: "self-cancelling",
    postings: [
      { accountId: "alice", amount: money(500, "PLN"), direction: "debit" },
      { accountId: "alice", amount: money(500, "PLN"), direction: "credit" },
    ],
  };
  const report = checkJournal([...honest(), pointless]);

  assert.equal(report.ok, false);
  assert.ok(report.findings.some((f) => f.check === "at-least-two-accounts"));
});

test("a negative posting is caught", () => {
  const sneaky: Transaction = {
    id: "tx-negative",
    at: AT,
    description: "negative debit is a disguised credit",
    postings: [
      { accountId: "alice", amount: money(-500, "PLN"), direction: "debit" },
      { accountId: "bob", amount: money(-500, "PLN"), direction: "credit" },
    ],
  };
  const report = checkJournal([...honest(), sneaky]);

  assert.equal(report.ok, false);
  assert.ok(report.findings.some((f) => f.check === "no-negative-postings"));
});

test("summarise names the first failing check and counts the rest", () => {
  const report = checkJournal([
    {
      id: "tx-bad",
      at: AT,
      description: "broken",
      postings: [
        { accountId: "bob", amount: money(100, "PLN"), direction: "debit" },
      ],
    },
  ]);
  assert.match(summarise(report), /transaction-balances|trial-balance-zero/);
  assert.match(summarise(report), /\+\d+ more/);
});

test("summarise reports success with the number of checks run", () => {
  assert.match(summarise(checkJournal(honest())), /All \d+ domain invariants hold/);
});
