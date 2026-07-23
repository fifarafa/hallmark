// Transfers and idempotency.
//
// Two operational realities drive this file:
//
//   1. A transfer is one transaction with two postings, not two separate
//      operations. Partial application is unrepresentable rather than merely
//      avoided — there is no window in which the money has left one account and
//      not arrived at the other.
//
//   2. Networks retry. A client that times out will resend, and "at least once"
//      is the only delivery guarantee you actually get. Without an idempotency
//      key, the honest retry of a successful transfer moves the money twice.
import type { Money } from "./money.ts";
import { isPositive } from "./money.ts";
import type { Journal, Transaction } from "./journal.ts";
import { appendTransaction } from "./journal.ts";

export class InsufficientFundsError extends Error {}
export class InvalidTransferError extends Error {}

export type TransferRequest = {
  readonly from: string;
  readonly to: string;
  readonly amount: Money;
  readonly description: string;
  /** Supply the same key on a retry to make it a no-op. */
  readonly idempotencyKey?: string;
  /** Injected so tests are deterministic; defaults to now. */
  readonly at?: string;
  readonly id?: string;
};

export type TransferResult = {
  readonly journal: Journal;
  readonly transaction: Transaction;
  /** True when this request replayed an earlier one rather than posting anew. */
  readonly replayed: boolean;
};

/** Find the transaction a key already produced, if any. */
export function findByIdempotencyKey(
  journal: Journal,
  key: string,
): Transaction | undefined {
  return journal.find((tx) => tx.idempotencyKey === key);
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `tx-${counter}`;
}

/**
 * Move money between two accounts.
 *
 * Returns a new journal; the input is never mutated. A repeated
 * `idempotencyKey` returns the original transaction with `replayed: true`
 * instead of posting a second time.
 */
export function transfer(journal: Journal, request: TransferRequest): TransferResult {
  const { from, to, amount, description, idempotencyKey } = request;

  if (from === to) {
    throw new InvalidTransferError(
      `Cannot transfer from ${from} to itself: the transaction would balance ` +
        `but move nothing.`,
    );
  }
  if (!isPositive(amount)) {
    throw new InvalidTransferError(
      `Transfer amount must be positive, received ${amount.minor}. To move ` +
        `money the other way, swap 'from' and 'to'.`,
    );
  }

  // Idempotency is checked before anything else: a replay must not re-run the
  // balance check, because the account may legitimately have moved on since.
  if (idempotencyKey !== undefined) {
    const existing = findByIdempotencyKey(journal, idempotencyKey);
    if (existing !== undefined) {
      return { journal, transaction: existing, replayed: true };
    }
  }

  const transaction: Transaction = {
    id: request.id ?? nextId(),
    at: request.at ?? new Date().toISOString(),
    description,
    // Debit the destination, credit the source. The two postings are created
    // together and validated together — there is no intermediate state.
    postings: [
      { accountId: to, amount, direction: "debit" },
      { accountId: from, amount, direction: "credit" },
    ],
    ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
  };

  return {
    journal: appendTransaction(journal, transaction),
    transaction,
    replayed: false,
  };
}

/** Reset the id counter so tests get stable ids. Test-support only. */
export function resetTransactionIds(): void {
  counter = 0;
}
