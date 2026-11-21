import assert from "node:assert/strict";
import { test } from "node:test";
import { describeHeadroom } from "./headroom-line";

test("positive headroom reads as free to spend, in whole rupees", () => {
  const line = describeHeadroom(44852);
  assert.equal(line.tone, "positive");
  assert.equal(line.emphasis, "₹44,852");
  assert.equal(line.rest, " free to spend this month");
});

test("the amount is rounded to whole rupees, no paise", () => {
  assert.equal(describeHeadroom(44852.6).emphasis, "₹44,853");
  assert.equal(describeHeadroom(44852.4).emphasis, "₹44,852");
});

test("zero headroom says nothing is left, with no amount shown", () => {
  const line = describeHeadroom(0);
  assert.equal(line.tone, "neutral");
  assert.equal(line.emphasis, "");
  assert.equal(line.rest, "Nothing left to spend this month after your plan");
});

test("a headroom that rounds to zero is not called short", () => {
  assert.equal(describeHeadroom(-0.4).tone, "neutral");
  assert.equal(describeHeadroom(0.4).tone, "neutral");
});

test("negative headroom is short, without a minus sign", () => {
  const line = describeHeadroom(-12500);
  assert.equal(line.tone, "negative");
  assert.equal(line.emphasis, "₹12,500");
  assert.equal(line.rest, " short this month after your plan");
});

test("amounts use Indian digit grouping", () => {
  assert.equal(describeHeadroom(1200000).emphasis, "₹12,00,000");
  assert.equal(describeHeadroom(-1200000).emphasis, "₹12,00,000");
});
