import assert from "node:assert/strict";
import { test } from "node:test";
import {
  excludeHandledSurpriseSpend,
  handledSurpriseTransactionIds,
  type VariableInsightsResponse,
} from "./variable-spending";

const now = new Date("2026-11-21T12:12:00Z");

const insights: VariableInsightsResponse = {
  total_baseline: 10000,
  total_actual: 15000,
  total_variance: 5000,
  top_risk_category: "Food",
  categories: [
    { category: "Food", actual: 9000, baseline: 6000, variance: 3000, variance_percent: 50, status: "over" },
    { category: "Transport", actual: 6000, baseline: 4000, variance: 2000, variance_percent: 50, status: "over" },
  ],
};

const chosenSurprise = {
  trigger_type: "surprise_expense",
  path_chosen: "Safer",
  trigger_event: { trigger_transaction_id: "tx-surprise" },
};

test("only chosen surprise-expense plans identify handled transactions", () => {
  const ids = handledSurpriseTransactionIds([
    chosenSurprise,
    { ...chosenSurprise, path_chosen: null },
    { ...chosenSurprise, trigger_type: "surprise_income" },
    { ...chosenSurprise, trigger_event: { trigger_transaction_id: "tx-second" } },
  ]);
  assert.deepEqual([...ids].sort(), ["tx-second", "tx-surprise"]);
});

test("a chosen surprise debit is removed from category and total actual spend", () => {
  const result = excludeHandledSurpriseSpend(insights, [chosenSurprise], [
    { id: "tx-surprise", category: "Food", amount: 5000, direction: "debit", occurred_at: "2026-11-10T12:00:00Z" },
  ], now);

  assert.equal(result.categories[0]?.actual, 4000);
  assert.equal(result.categories[0]?.variance, -2000);
  assert.equal(result.categories[0]?.variance_percent, (-2000 / 6000) * 100);
  assert.equal(result.categories[0]?.status, undefined);
  assert.equal(result.total_actual, 10000);
  assert.equal(result.total_variance, 0);
  assert.equal(result.top_risk_category, "Transport");
});

test("credits, other months, and unchosen surprises remain in actual spend", () => {
  const rows = [
    { id: "tx-surprise", category: "Food", amount: 5000, direction: "credit", occurred_at: "2026-11-10T12:00:00Z" },
    { id: "tx-old", category: "Food", amount: 3000, direction: "debit", occurred_at: "2026-10-31T18:29:59Z" },
    { id: "tx-unhandled", category: "Food", amount: 2000, direction: "debit", occurred_at: "2026-11-10T12:00:00Z" },
  ];
  const selections = [
    chosenSurprise,
    { ...chosenSurprise, trigger_event: { trigger_transaction_id: "tx-old" } },
  ];
  assert.equal(excludeHandledSurpriseSpend(insights, selections, rows, now), insights);
});

test("duplicate plan rows do not subtract the same transaction twice", () => {
  const result = excludeHandledSurpriseSpend(insights, [chosenSurprise, chosenSurprise], [
    { id: "tx-surprise", category: "Food", amount: 5000, direction: "debit", occurred_at: "2026-11-01T00:00:00Z" },
  ], now);
  assert.equal(result.total_actual, 10000);
});

test("spend outside the insight categories does not change totals", () => {
  const result = excludeHandledSurpriseSpend(insights, [chosenSurprise], [
    { id: "tx-surprise", category: "Rent", amount: 5000, direction: "debit", occurred_at: "2026-11-10T12:00:00Z" },
  ], now);
  assert.equal(result, insights);
});
