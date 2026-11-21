// Copy + formatting for the "free to spend this month" line in the Spending
// card. The number is compute-plan's discretionary_headroom, rendered as-is
// and only rounded to whole rupees here — never recomputed.

function formatWholeINR(n: number) {
  return `₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
}

export type HeadroomLineTone = "positive" | "neutral" | "negative";

export type HeadroomLine = {
  tone: HeadroomLineTone;
  /** Emphasised part (the amount). Empty string when there is no amount to show. */
  emphasis: string;
  /** The rest of the sentence, rendered as normal muted text. */
  rest: string;
};

export function describeHeadroom(headroom: number): HeadroomLine {
  const whole = Math.round(headroom);
  if (whole > 0) {
    return {
      tone: "positive",
      emphasis: formatWholeINR(whole),
      rest: " free to spend this month",
    };
  }
  if (whole < 0) {
    return {
      tone: "negative",
      emphasis: formatWholeINR(whole),
      rest: " short this month after your plan",
    };
  }
  return {
    tone: "neutral",
    emphasis: "",
    rest: "Nothing left to spend this month after your plan",
  };
}
