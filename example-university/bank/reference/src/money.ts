// Money is an integer count of minor units (grosze, cents) plus a currency.
//
// Two rules, both of which exist because violating them has cost real banks
// real money:
//
//   1. Never a float. `0.1 + 0.2 === 0.30000000000000004`, and a rounding error
//      repeated across a million transactions is a reconciliation nightmare that
//      surfaces weeks later as an unexplained imbalance.
//   2. Currency lives in the type. Adding PLN to EUR must be impossible to do by
//      accident, so `add` rejects it rather than silently producing nonsense.

export type Currency = "PLN" | "EUR" | "USD";

export type Money = {
  /** Integer count of the currency's smallest unit. 12_34 is 12.34. */
  readonly minor: number;
  readonly currency: Currency;
};

export class CurrencyMismatchError extends Error {}

export function money(minor: number, currency: Currency): Money {
  if (!Number.isInteger(minor)) {
    throw new TypeError(
      `Money must be an integer count of minor units, received ${minor}. ` +
        `Use 12_34 rather than 12.34.`,
    );
  }
  return { minor, currency };
}

export function zero(currency: Currency): Money {
  return { minor: 0, currency };
}

function requireSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new CurrencyMismatchError(
      `Cannot combine ${a.currency} with ${b.currency}. Convert explicitly ` +
        `through an FX transaction instead.`,
    );
  }
}

export function add(a: Money, b: Money): Money {
  requireSameCurrency(a, b);
  return { minor: a.minor + b.minor, currency: a.currency };
}

export function subtract(a: Money, b: Money): Money {
  requireSameCurrency(a, b);
  return { minor: a.minor - b.minor, currency: a.currency };
}

export function negate(a: Money): Money {
  return { minor: -a.minor, currency: a.currency };
}

export function isZero(a: Money): boolean {
  return a.minor === 0;
}

export function isPositive(a: Money): boolean {
  return a.minor > 0;
}

export function compare(a: Money, b: Money): number {
  requireSameCurrency(a, b);
  return a.minor - b.minor;
}

/** Human-readable form. Presentation only — never parse this back. */
export function formatMoney(a: Money): string {
  const sign = a.minor < 0 ? "-" : "";
  const abs = Math.abs(a.minor);
  const major = Math.floor(abs / 100);
  const minor = String(abs % 100).padStart(2, "0");
  return `${sign}${major}.${minor} ${a.currency}`;
}
