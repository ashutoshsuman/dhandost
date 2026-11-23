import assert from "node:assert/strict";
import { test } from "node:test";
import { categoryOptions, DEFAULT_CATEGORIES, hasCategoryChange } from "./categories";

test("every picker gets the complete shared default list", () => {
  const expected = ["Salary", "Freelance", "Bonus", "Refund", "Food", "Groceries", "Transport", "Shopping", "Entertainment", "Household", "Utilities", "Rent", "EMI", "SIP", "Investment", "Insurance", "Health", "Family Transfer", "Money Transfer", "Transfer", "Other"];
  assert.deepEqual([...DEFAULT_CATEGORIES].sort(), expected.sort());
});

test("Money Transfer remains the selected option rather than falling back to Bonus", () => {
  const options = categoryOptions([], "Money Transfer");
  assert.equal(options.filter((name) => name === "Money Transfer").length, 1);
});

test("missing stored names are included as-is without normalization", () => {
  const stored = "Legacy  category";
  assert.ok(categoryOptions([], stored).includes(stored));
  assert.ok(categoryOptions([], "money transfer").includes("money transfer"));
});

test("options include user categories and do not mutate the default list", () => {
  const before = [...DEFAULT_CATEGORIES];
  const options = categoryOptions(["Pet Care", "food"], "Legacy");
  assert.ok(options.includes("Pet Care"));
  assert.ok(options.includes("Legacy"));
  assert.equal(options.filter((name) => name.toLowerCase() === "food").length, 1);
  assert.deepEqual(DEFAULT_CATEGORIES, before);
});

test("unchanged or empty selections cannot write a category", () => {
  assert.equal(hasCategoryChange("Money Transfer", "Money Transfer"), false);
  assert.equal(hasCategoryChange("Money Transfer", ""), false);
  assert.equal(hasCategoryChange(null, ""), false);
  assert.equal(hasCategoryChange("Money Transfer", "Food"), true);
});