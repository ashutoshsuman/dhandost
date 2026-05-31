import { useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";

export function WhyThisRecommendation() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium cursor-pointer hover:bg-secondary/40 transition-colors rounded-lg"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Why this recommendation?
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 text-xs text-muted-foreground leading-relaxed space-y-2">
          <p>
            Recommendations are generated locally from your own financial signals:
          </p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>Income</li>
            <li>Expenses</li>
            <li>Goals</li>
            <li>Spending patterns</li>
          </ul>
          <p>
            Your data is never shared externally or sold to third parties.
          </p>
        </div>
      )}
    </div>
  );
}

export default WhyThisRecommendation;
