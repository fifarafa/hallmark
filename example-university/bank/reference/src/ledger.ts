// Balances are projections of the journal, not stored columns.
//
// This is the file that makes the example not-CRUD. There is no
// `UPDATE accounts SET balance = balance - 100`. A balance is computed by
// folding over the postings, exactly as hallmark computes a label with
// `labelsFor(state)` instead of storing one.
//
// What you get for free by deriving rather than storing:
//   - A complete audit trail, because the history *is* the state.
//   - Point-in-time balances (`balanceOf(journal, id, ccy, asOf)`), because the
//     past is still there.
//   - No lost updates: two concurrent writers append, and neither clobbers the
//     other's arithmetic the way two read-modify-write cycles would.
import type { Currency, Money } from "./money.ts";
import { add, money, zero } from "./money.ts";
import type { Journal } from "./journal.ts";
import { signedMinor } from "./journal.ts";

/**
 * Balance of one account in one currency: debits minus credits.
 *
 * Pass `asOf` (an ISO timestamp) to get the balance as it stood at that moment.
 * A stored-column design cannot answer that question at all.
 */
export function balanceOf(
  journal: Journal,
  accountId: string,
  currency: Currency,
  asOf?: string,
): Money {
  let total = zero(currency);
  for (const tx of journal) {
    if (asOf !== undefined && tx.at > asOf) continue;
    for (const posting of tx.postings) {
      if (posting.accountId !== accountId) continue;
      if (posting.amount.currency !== currency) continue;
      total = add(total, money(signedMinor(posting), currency));
    }
  }
  return total;
}

/** Every account that appears anywhere in the journal. */
export function accountIds(journal: Journal): string[] {
  const ids = new Set<string>();
  for (const tx of journal) {
    for (const posting of tx.postings) ids.add(posting.accountId);
  }
  return [...ids].sort();
}

export function currencies(journal: Journal): Currency[] {
  const found = new Set<Currency>();
  for (const tx of journal) {
    for (const posting of tx.postings) found.add(posting.amount.currency);
  }
  return [...found].sort();
}

/**
 * The trial balance: sum of every account's balance, per currency.
 *
 * It must be zero. Money is never created or destroyed inside the bank — it
 * only moves — so if this is non-zero the journal is corrupt. This is the
 * property the runner checks in lesson 7, and no amount of green unit tests
 * from an agent can substitute for it.
 */
export function trialBalance(journal: Journal): Map<Currency, Money> {
  const totals = new Map<Currency, Money>();
  for (const currency of currencies(journal)) {
    let total = zero(currency);
    for (const id of accountIds(journal)) {
      total = add(total, balanceOf(journal, id, currency));
    }
    totals.set(currency, total);
  }
  return totals;
}

/** True when every currency in the journal nets to zero across all accounts. */
export function isJournalSound(journal: Journal): boolean {
  for (const total of trialBalance(journal).values()) {
    if (total.minor !== 0) return false;
  }
  return true;
}
