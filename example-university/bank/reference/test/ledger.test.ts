import { test } from "node:test";
import assert from "node:assert/strict";
import { money } from "../src/money.ts";
import { appendTransaction, type Journal, type Transaction } from "../src/journal.ts";
import { accountIds, balanceOf, isJournalSound, trialBalance } from "../src/ledger.ts";

function deposit(id: string, who: string, minor: number, at: string): Transaction {
  return {
    id,
    at,
    description: `deposit ${minor}`,
    postings: [
      { accountId: who, amount: money(minor, "PLN"), direction: "debit" },
      { accountId: "bank:cash", amount: money(minor, "PLN"), direction: "credit" },
    ],
  };
}

function seeded(): Journal {
  let journal: Journal = [];
  journal = appendTransaction(journal, deposit("tx-1", "alice", 10_000, "2026-01-01T00:00:00.000Z"));
  journal = appendTransaction(journal, deposit("tx-2", "bob", 2_500, "2026-01-02T00:00:00.000Z"));
  return journal;
}

test("balance is derived from postings, not stored", () => {
  const journal = seeded();
  assert.equal(balanceOf(journal, "alice", "PLN").minor, 10_000);
  assert.equal(balanceOf(journal, "bob", "PLN").minor, 2_500);
  // The bank's cash account is the mirror of both deposits.
  assert.equal(balanceOf(journal, "bank:cash", "PLN").minor, -12_500);
});

test("an unknown account has a zero balance rather than an error", () => {
  assert.equal(balanceOf(seeded(), "nobody", "PLN").minor, 0);
});

test("a balance can be asked for as it stood at a past moment", () => {
  // Impossible with a stored balance column: the past has been overwritten.
  const journal = seeded();
  const before = balanceOf(journal, "bob", "PLN", "2026-01-01T12:00:00.000Z");
  assert.equal(before.minor, 0); // bob's deposit lands on the 2nd
  assert.equal(balanceOf(journal, "bob", "PLN").minor, 2_500);
});

test("balances are per currency", () => {
  let journal = seeded();
  journal = appendTransaction(journal, {
    id: "tx-3",
    at: "2026-01-03T00:00:00.000Z",
    description: "eur deposit",
    postings: [
      { accountId: "alice", amount: money(700, "EUR"), direction: "debit" },
      { accountId: "bank:cash", amount: money(700, "EUR"), direction: "credit" },
    ],
  });
  assert.equal(balanceOf(journal, "alice", "PLN").minor, 10_000);
  assert.equal(balanceOf(journal, "alice", "EUR").minor, 700);
});

test("the trial balance is zero in every currency", () => {
  // The core soundness property: money moved, never created.
  const totals = trialBalance(seeded());
  assert.equal(totals.get("PLN")?.minor, 0);
  assert.ok(isJournalSound(seeded()));
});

test("an empty journal is sound and has no accounts", () => {
  assert.deepEqual(accountIds([]), []);
  assert.ok(isJournalSound([]));
});

test("accountIds lists every account exactly once, sorted", () => {
  assert.deepEqual(accountIds(seeded()), ["alice", "bank:cash", "bob"]);
});
