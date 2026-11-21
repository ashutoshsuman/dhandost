import assert from "node:assert/strict";
import { test } from "node:test";
import { formatINR, formatINRWhole } from "./format";

test("monthly saving targets round to the nearest rupee with Indian grouping", () => {
  assert.equal(formatINRWhole(39252.66), "₹39,253");
  assert.equal(formatINRWhole(39252.5), "₹39,253");
  assert.equal(formatINRWhole(39252.4), "₹39,252");
  assert.equal(formatINRWhole(120000), "₹1,20,000");
  assert.equal(formatINRWhole(0), "₹0");
});

test("monthly saving targets never render decimals", () => {
  assert.doesNotMatch(formatINRWhole(39252.66), /\./);
  assert.doesNotMatch(formatINRWhole("39252.66"), /\./);
});

test("other amounts keep their existing decimals formatting", () => {
  assert.equal(formatINR(39252.66), "₹39,252.66");
  assert.equal(formatINR(120000), "₹1,20,000.00");
});
