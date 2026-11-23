import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeDiscretionaryCut,
  sumMonthlyDiscretionaryCuts,
} from "./discretionary-cut";

test("an even cut keeps the regular monthly wording with Indian whole-rupee formatting", () => {
  const result = describeDiscretionaryCut({
    target: "Shopping",
    amount: 120000,
    monthly_amount: 40000,
    duration_months: 3,
  });

  assert.equal(
    result.text,
    "Reduce Shopping by ₹40,000/month for 3 months (₹1,20,000 total)",
  );
  assert.equal(result.invalidFinalMonth, false);
});

test("a one-month cut uses its exact total and says this month", () => {
  const result = describeDiscretionaryCut({
    target: "Food",
    amount: 1450,
    monthly_amount: 2000,
    duration_months: 1,
  });

  assert.equal(result.text, "Reduce Food by ₹1,450 this month");
  assert.equal(result.invalidFinalMonth, false);
});

test("a different final month shows the regular cuts followed by the exact final cut", () => {
  const result = describeDiscretionaryCut({
    target: "Transport",
    amount: 12500,
    monthly_amount: 5000,
    duration_months: 3,
  });

  assert.equal(
    result.text,
    "Reduce Transport by ₹5,000/month for 2 months, then ₹2,500 in the final month (₹12,500 total)",
  );
  assert.equal(result.invalidFinalMonth, false);
});

test("one earlier month uses the singular month label", () => {
  const result = describeDiscretionaryCut({
    target: "Entertainment",
    amount: 3000,
    monthly_amount: 2000,
    duration_months: 2,
  });

  assert.equal(
    result.text,
    "Reduce Entertainment by ₹2,000/month for 1 month, then ₹1,000 in the final month (₹3,000 total)",
  );
});

test("a non-positive final month falls back to regular wording and is flagged", () => {
  const result = describeDiscretionaryCut({
    target: "Shopping",
    amount: 2000,
    monthly_amount: 2000,
    duration_months: 3,
  });

  assert.equal(
    result.text,
    "Reduce Shopping by ₹2,000/month for 3 months (₹2,000 total)",
  );
  assert.equal(result.invalidFinalMonth, true);
});

test("the path summary sums only regular monthly discretionary cuts", () => {
  const total = sumMonthlyDiscretionaryCuts([
    { action: "reduce_discretionary", monthly_amount: 5000 },
    { action: "reduce_discretionary", monthly_amount: 2500 },
    { action: "fund_goal", monthly_amount: 9000 },
    { action: "reduce_discretionary" },
  ]);

  assert.equal(total, 7500);
});
