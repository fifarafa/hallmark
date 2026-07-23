// The conformance harness: domain checks the RUNNER owns.
//
// This is the point of lesson 7. An agent proves its work by writing tests, but
// an agent also writes those tests — so "the tests pass" only means the code
// agrees with the agent's own idea of correctness. A conformance harness is
// different: it lives outside `workspace/`, the agent never edits it, and it
// asserts properties of the *domain* rather than of any particular
// implementation.
//
// Under the sandcastle provider this is enforced structurally. `src/` is in the
// agent's worktree, so it *can* edit this file — but the copy-out allowlist
// never copies `src/` back, so the edit dies with the worktree and the runner
// executes the host's copy. The agent cannot weaken its own examiner.
//
// Every check here is a property, not an example: it must hold for any journal,
// not for one hand-picked case.
import type { Journal } from "./journal.ts";
import { isBalanced } from "./journal.ts";
import { balanceOf, currencies, trialBalance } from "./ledger.ts";
import { formatMoney } from "./money.ts";

export type ConformanceFinding = {
  readonly check: string;
  readonly detail: string;
};

export type ConformanceReport = {
  readonly ok: boolean;
  readonly checked: number;
  readonly findings: readonly ConformanceFinding[];
};

/**
 * Check a journal against the invariants a double-entry system must uphold.
 *
 * Returns findings rather than throwing, so a caller (the runner) can report
 * every violation at once instead of only the first.
 */
export function checkJournal(journal: Journal): ConformanceReport {
  const findings: ConformanceFinding[] = [];
  let checked = 0;

  // 1. Every transaction balances on its own.
  checked++;
  for (const tx of journal) {
    if (!isBalanced(tx.postings)) {
      findings.push({
        check: "transaction-balances",
        detail: `Transaction ${tx.id} (${tx.description}) does not balance.`,
      });
    }
  }

  // 2. The trial balance is zero in every currency. Money is only ever moved,
  //    never created — this is the property that catches a conjured credit that
  //    a per-transaction check might miss.
  checked++;
  for (const [currency, total] of trialBalance(journal)) {
    if (total.minor !== 0) {
      findings.push({
        check: "trial-balance-zero",
        detail:
          `Trial balance for ${currency} is ${formatMoney(total)}, expected 0. ` +
          `The journal has created or destroyed money.`,
      });
    }
  }

  // 3. No posting carries a negative amount. Direction carries the sign, so a
  //    negative amount is a second, contradictory way to express it.
  checked++;
  for (const tx of journal) {
    for (const posting of tx.postings) {
      if (posting.amount.minor < 0) {
        findings.push({
          check: "no-negative-postings",
          detail:
            `Posting to ${posting.accountId} in ${tx.id} is negative ` +
            `(${posting.amount.minor}); use the opposite direction instead.`,
        });
      }
    }
  }

  // 4. A transaction touches at least two accounts. A single-posting
  //    transaction can only balance by being zero, which moves nothing.
  checked++;
  for (const tx of journal) {
    const distinct = new Set(tx.postings.map((p) => p.accountId));
    if (distinct.size < 2) {
      findings.push({
        check: "at-least-two-accounts",
        detail: `Transaction ${tx.id} touches ${distinct.size} account(s).`,
      });
    }
  }

  // 5. Idempotency keys are unique. A repeated key means a retry was posted
  //    twice — the money moved twice for one instruction.
  checked++;
  const seen = new Map<string, string>();
  for (const tx of journal) {
    if (tx.idempotencyKey === undefined) continue;
    const previous = seen.get(tx.idempotencyKey);
    if (previous !== undefined) {
      findings.push({
        check: "idempotency-keys-unique",
        detail:
          `Idempotency key '${tx.idempotencyKey}' appears on both ${previous} ` +
          `and ${tx.id}. A retry was posted twice.`,
      });
    }
    seen.set(tx.idempotencyKey, tx.id);
  }

  // 6. Balances reconcile with a straight replay. Guards against a projection
  //    that has drifted from the history it claims to summarise.
  checked++;
  for (const currency of currencies(journal)) {
    for (const tx of journal) {
      for (const posting of tx.postings) {
        if (posting.amount.currency !== currency) continue;
        const derived = balanceOf(journal, posting.accountId, currency);
        const replayed = journal
          .flatMap((t) => t.postings)
          .filter((p) => p.accountId === posting.accountId)
          .filter((p) => p.amount.currency === currency)
          .reduce((sum, p) => sum + (p.direction === "debit" ? 1 : -1) * p.amount.minor, 0);
        if (derived.minor !== replayed) {
          findings.push({
            check: "balance-matches-replay",
            detail:
              `Balance of ${posting.accountId} in ${currency} is ` +
              `${derived.minor} but replaying the journal gives ${replayed}.`,
          });
        }
      }
    }
  }

  return { ok: findings.length === 0, checked, findings };
}

/** One-line summary suitable for a verification failure reason. */
export function summarise(report: ConformanceReport): string {
  if (report.ok) {
    return `All ${report.checked} domain invariants hold.`;
  }
  const first = report.findings[0];
  const rest = report.findings.length - 1;
  const suffix = rest > 0 ? ` (+${rest} more)` : "";
  return `${first?.check}: ${first?.detail}${suffix}`;
}
