import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatDelayGoalDuration,
  formatGoalDate,
  getTomorrow,
  isGoalTargetPassed,
  toLocalDateKey,
} from "./goal-utils";

const today = new Date(2026, 10, 21, 15, 30);

test("an incomplete goal with a past target date is lapsed", () => {
  assert.equal(isGoalTargetPassed("2026-09-09", false, today), true);
});

test("completed goals and goals due today or later are not lapsed", () => {
  assert.equal(isGoalTargetPassed("2026-09-09", true, today), false);
  assert.equal(isGoalTargetPassed("2026-11-21", false, today), false);
  assert.equal(isGoalTargetPassed("2026-11-22", false, today), false);
});

test("the earliest selectable replacement date is tomorrow", () => {
  assert.equal(toLocalDateKey(getTomorrow(today)), "2026-11-22");
});

test("goal dates use DD MMM YYYY formatting", () => {
  assert.equal(formatGoalDate("2026-09-09"), "09 Sep 2026");
});

test("delay_goal uses precise days below 60 days", () => {
  assert.equal(formatDelayGoalDuration(1), "1 day");
  assert.equal(formatDelayGoalDuration(45), "45 days");
  assert.equal(formatDelayGoalDuration(59), "59 days");
});

test("delay_goal uses rounded months from 60 days with correct pluralisation", () => {
  assert.equal(formatDelayGoalDuration(30), "30 days");
  assert.equal(formatDelayGoalDuration(60), "about 2 months");
  assert.equal(formatDelayGoalDuration(90), "about 3 months");
});

test("delay_goal falls back to whole months only when days are missing", () => {
  assert.equal(formatDelayGoalDuration(undefined, 1), "1 month");
  assert.equal(formatDelayGoalDuration(undefined, 2), "2 months");
  assert.equal(formatDelayGoalDuration(), null);
});
