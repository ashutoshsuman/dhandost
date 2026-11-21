import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatDelayGoalDuration,
  formatGoalDate,
  getTomorrow,
  goalSavingsExplanation,
  isGoalTargetPassed,
  revisedGoalNote,
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

test("a revised goal shows a muted note naming the original date", () => {
  assert.equal(
    revisedGoalNote({ original_target_date: "2026-09-09", target_revised_at: "2026-10-01T09:30:00+00:00" }),
    "Revised · originally 09 Sep 2026",
  );
});

test("a goal that was never revised shows no note", () => {
  assert.equal(revisedGoalNote({ original_target_date: null, target_revised_at: null }), null);
  assert.equal(revisedGoalNote({}), null);
});

test("revised goals explain the remaining amount and the date the pace was set from", () => {
  assert.equal(
    goalSavingsExplanation(82000, "2027-06-30", {
      original_target_date: "2026-09-09",
      target_revised_at: "2026-10-01T09:30:00+00:00",
    }),
    "Required monthly savings is the ₹82,000.00 still needed spread over the time until 30 Jun 2027. Status compares your progress with that pace, measured from when you set this date (01 Oct 2026).",
  );
});

test("revised goals without a revision timestamp omit the measured-from clause", () => {
  assert.equal(
    goalSavingsExplanation(82000, "2027-06-30", { original_target_date: "2026-09-09" }),
    "Required monthly savings is the ₹82,000.00 still needed spread over the time until 30 Jun 2027. Status compares your progress with that pace.",
  );
});

test("goals that were never revised keep the original explanation wording", () => {
  assert.equal(
    goalSavingsExplanation(82000, "2027-06-30", {}),
    "Required monthly savings is derived from the gap between ₹82,000.00 remaining and the months until 30 Jun 2027. Status reflects whether your current pace meets that schedule.",
  );
});
