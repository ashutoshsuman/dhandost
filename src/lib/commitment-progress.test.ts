import assert from "node:assert/strict";
import { test } from "node:test";
import { splitCommitments, istMonthBounds, reductionProgress, categoryDebitSpend, cancellationUpdate } from "./commitment-progress";

const now = new Date("2026-11-21T12:12:00Z");

test("only active reductions and goal delays count as ongoing", () => {
  const rows = [
    { commitment_type: "reduce_discretionary", status: "active" },
    { commitment_type: "delay_goal", status: "active" },
    { commitment_type: "debt_paydown", status: "active" },
    { commitment_type: "allocate_savings", status: "pending" },
    { commitment_type: "reduce_discretionary", status: "cancelled" },
    { commitment_type: "delay_goal", status: "completed" },
  ];
  assert.deepEqual(splitCommitments(rows, now).ongoing, rows.slice(0, 2));
});

test("confirmed and completed one-time actions use IST month boundaries, never the badge", () => {
  const rows = [
    { commitment_type: "debt_paydown", status: "confirmed", confirmed_at: "2026-10-31T18:30:00Z" },
    { commitment_type: "allocate_savings", status: "completed", confirmed_at: "2026-11-30T18:29:59Z" },
    { commitment_type: "debt_paydown", status: "confirmed", confirmed_at: "2026-10-31T18:29:59Z" },
    { commitment_type: "debt_paydown", status: "pending" },
  ];
  const result = splitCommitments(rows, now);
  assert.equal(result.ongoing.length, 0);
  assert.deepEqual(result.done, rows.slice(0, 2));
  assert.deepEqual(result.past, rows.slice(2, 3));
  assert.deepEqual(istMonthBounds(now), { start: "2026-10-31T18:30:00.000Z", end: "2026-11-30T18:30:00.000Z" });
});

test("progress target is the category baseline minus this commitment's monthly cut", () => {
  assert.deepEqual(reductionProgress(10000, 2000, 6000),
    { baseline: 10000, target: 8000, spent: 6000, review: false, over: false, percent: 75 });
});

test("overspending is red and progress never exceeds the bar", () => {
  assert.equal(reductionProgress(10000, 2000, 9000)?.over, true);
  assert.equal(reductionProgress(10000, 2000, 9000)?.percent, 100);
});

test("missing baseline omits progress", () => {
  assert.equal(reductionProgress(undefined, 2000, 0), null);
});

test("zero and negative targets require review instead of a progress bar", () => {
  assert.equal(reductionProgress(2000, 2000, 0)?.review, true);
  assert.equal(reductionProgress(1000, 2000, 0)?.review, true);
});

test("category spend counts only current IST month's debits", () => {
  const rows = [
    { category: "Food", direction: "debit", amount: 1500, occurred_at: "2026-10-31T18:30:00Z" },
    { category: "Food", direction: "credit", amount: 800, occurred_at: "2026-11-02T12:00:00Z" },
    { category: "Food", direction: "debit", amount: 900, occurred_at: "2026-10-31T18:29:59Z" },
    { category: "Transport", direction: "debit", amount: 200, occurred_at: "2026-11-10T12:00:00Z" },
  ];
  assert.equal(categoryDebitSpend(rows, now).get("Food"), 1500);
  assert.equal(categoryDebitSpend(rows, now).get("Transport"), 200);
});

test("cancel action sets cancelled status", () => {
  assert.deepEqual(cancellationUpdate, { status: "cancelled" });
});

test("only pending one-time actions join ongoing commitments in the badge", () => {
  const rows = [
    { commitment_type: "debt_paydown", status: "pending" },
    { commitment_type: "allocate_savings", status: "pending" },
    { commitment_type: "reduce_discretionary", status: "active" },
    { commitment_type: "delay_goal", status: "pending" },
    { commitment_type: "allocate_savings", status: "cancelled" },
    { commitment_type: "debt_paydown", status: "confirmed", confirmed_at: now.toISOString() },
  ];
  const result = splitCommitments(rows, now);
  assert.deepEqual(result.pending, rows.slice(0, 2));
  assert.equal(result.badgeCount, 3);
});

test("confirmation moves a pending action into Done this month and out of the badge", () => {
  for (const commitment_type of ["debt_paydown", "allocate_savings"]) {
    const before = splitCommitments([{ commitment_type, status: "pending" }], now);
    const after = splitCommitments([{ commitment_type, status: "confirmed", confirmed_at: now.toISOString() }], now);
    assert.equal(before.pending.length, 1);
    assert.equal(before.badgeCount, 1);
    assert.equal(after.pending.length, 0);
    assert.equal(after.badgeCount, 0);
    assert.equal(after.done.length, 1);
  }
});

test("cancelling a pending action removes it without recording a completed action", () => {
  const result = splitCommitments([{ commitment_type: "debt_paydown", ...cancellationUpdate }], now);
  assert.equal(result.pending.length, 0);
  assert.equal(result.badgeCount, 0);
  assert.equal(result.done.length + result.past.length, 0);
});

test("no ongoing or current actions leaves the empty state even when history exists", () => {
  const result = splitCommitments([{ commitment_type: "debt_paydown", status: "completed", confirmed_at: "2026-09-01" }], now);
  assert.equal(result.ongoing.length + result.done.length, 0);
  assert.equal(result.past.length, 1);
});