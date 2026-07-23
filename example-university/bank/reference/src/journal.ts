// The journal is the bank's canonical state: an append-only list of balanced
// transactions. Nothing in this file updates or deletes anything.
//
// This is the same shape as hallmark's own control plane. `.hallmark/runs/` is
// written only by the runner and never derived from a label; the journal is
// written only by `appendTransaction` and never derived from a balance. In both
// systems the stored thing is the history, and the useful thing is a projection
// of it (see ledger.ts).
import type { Currency, Money } from "./money.ts";
import { add, isZero, money, zero } from "./money.ts";

export type Direction = "debit" | "credit";

export type Posting = {
  readonly accountId: string;
  /** Always a positive amount; `direction` carries the sign. */
  readonly amount: Money;
  readonly direction: Direction;
};

export type Transaction = {
  readonly id: string;
  readonly at: string;
  readonly description: string;
  readonly postings: readonly Posting[];
  /** Present when the caller supplied one, so retries can be recognised. */
  readonly idempotencyKey?: string;
};

export type Journal = readonly Transaction[];

export class UnbalancedTransactionError extends Error {}

/** Signed contribution of a posting: debits add, credits subtract. */
export function signedMinor(posting: Posting): number {
  return posting.direction === "debit" ? posting.amount.minor : -posting.amount.minor;
}

/**
 * The invariant: within each currency, debits must equal credits.
 *
 * This is what makes money impossible to conjure. Every unit that leaves one
 * account must arrive in another, so the sum across all accounts is always zero
 * (see `trialBalance`). A CRUD design with a mutable `balance` column has no
 * equivalent check — nothing structurally prevents a decrement without a
 * matching increment.
 */
export function imbalance(postings: readonly Posting[]): Map<Currency, Money> {
  const totals = new Map<Currency, Money>();
  for (const posting of postings) {
    const currency = posting.amount.currency;
    const running = totals.get(currency) ?? zero(currency);
    totals.set(currency, add(running, money(signedMinor(posting), currency)));
  }
  // Currencies that net to zero are balanced; drop them from the report.
  for (const [currency, total] of [...totals]) {
    if (isZero(total)) totals.delete(currency);
  }
  return totals;
}

export function isBalanced(postings: readonly Posting[]): boolean {
  return imbalance(postings).size === 0;
}

/**
 * Append a transaction, refusing anything that would break the invariant.
 *
 * Validation happens here rather than in a periodic audit precisely because an
 * unbalanced journal should be unrepresentable, not merely detectable later.
 */
export function appendTransaction(journal: Journal, tx: Transaction): Journal {
  if (tx.postings.length === 0) {
    throw new UnbalancedTransactionError(
      `Transaction ${tx.id} has no postings. A transaction must move money ` +
        `between at least two accounts.`,
    );
  }

  for (const posting of tx.postings) {
    if (posting.amount.minor < 0) {
      throw new UnbalancedTransactionError(
        `Posting to ${posting.accountId} in transaction ${tx.id} has a negative ` +
          `amount. Use direction '${posting.direction === "debit" ? "credit" : "debit"}' ` +
          `with a positive amount instead.`,
      );
    }
  }

  const off = imbalance(tx.postings);
  if (off.size > 0) {
    const detail = [...off]
      .map(([currency, total]) => `${currency} off by ${total.minor}`)
      .join(", ");
    throw new UnbalancedTransactionError(
      `Transaction ${tx.id} does not balance (${detail}). Debits must equal ` +
        `credits in every currency.`,
    );
  }

  // Append-only: a new array, never a mutation of the one passed in.
  return [...journal, tx];
}
