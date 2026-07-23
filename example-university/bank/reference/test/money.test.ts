import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CurrencyMismatchError,
  add,
  compare,
  formatMoney,
  isZero,
  money,
  negate,
  subtract,
  zero,
} from "../src/money.ts";

test("money rejects fractional minor units", () => {
  // 12.34 PLN is 1234 grosze. Passing 12.34 means someone used a float for
  // money, which is the bug this type exists to prevent.
  assert.throws(() => money(12.34, "PLN"), TypeError);
});

test("integer arithmetic avoids the classic float error", () => {
  // 0.1 + 0.2 !== 0.3 in binary floating point.
  const a = money(10, "PLN"); // 0.10
  const b = money(20, "PLN"); // 0.20
  assert.equal(add(a, b).minor, 30); // exactly 0.30
});

test("adding different currencies is refused", () => {
  assert.throws(
    () => add(money(100, "PLN"), money(100, "EUR")),
    CurrencyMismatchError,
  );
});

test("subtract and negate preserve currency", () => {
  assert.deepEqual(subtract(money(500, "EUR"), money(200, "EUR")), {
    minor: 300,
    currency: "EUR",
  });
  assert.deepEqual(negate(money(500, "EUR")), { minor: -500, currency: "EUR" });
});

test("zero and isZero agree", () => {
  assert.ok(isZero(zero("USD")));
  assert.ok(!isZero(money(1, "USD")));
});

test("compare orders amounts and rejects mixed currencies", () => {
  assert.ok(compare(money(200, "PLN"), money(100, "PLN")) > 0);
  assert.throws(
    () => compare(money(1, "PLN"), money(1, "USD")),
    CurrencyMismatchError,
  );
});

test("formatMoney renders minor units, including negatives", () => {
  assert.equal(formatMoney(money(1234, "PLN")), "12.34 PLN");
  assert.equal(formatMoney(money(-5, "EUR")), "-0.05 EUR");
  assert.equal(formatMoney(money(0, "USD")), "0.00 USD");
});
