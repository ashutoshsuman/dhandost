import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, TrendingDown, TrendingUp, Minus, AlertTriangle, Sparkles } from "lucide-react";
import { formatINR } from "@/lib/format";
import { fetchThreePaths, storePathsResponse } from "@/lib/three-paths";

type Status = "under" | "within" | "over";

type CategoryRow = {
  category: string;
  actual: number;
  baseline: number;
  variance: number;
  variance_percent?: number;
  status?: Status;
};

type InsightsResponse = {
  total_baseline: number;
  total_actual: number;
  total_variance: number;
  top_risk_category?: string | null;
  forecast_total_month_end_spend?: number;
  forecast_total_variance?: number;
  categories: CategoryRow[];
};

const URL =
  "https://ibjsdafxjggjyamkdjeh.supabase.co/functions/v1/variable-spending-insights";
const KEY = "sb_publishable_ztTyEdZPNNfk5PjttJimDg_-g3fmC0D";

function statusFor(actual: number, baseline: number, provided?: Status): Status {
  if (provided) return provided;
  if (baseline <= 0) return actual > 0 ? "over" : "under";
  if (actual <= baseline) return "under";
  if (actual <= baseline * 1.1) return "within";
  return "over";
}

const statusStyles: Record<
  Status,
  { border: string; bg: string; text: string; chipBg: string; label: string }
> = {
  under: {
    border: "border-success/30",
    bg: "bg-success/5",
    text: "text-success",
    chipBg: "bg-success/10",
    label: "Under",
  },
  within: {
    border: "border-warning/30",
    bg: "bg-warning/5",
    text: "text-warning",
    chipBg: "bg-warning/10",
    label: "Near",
  },
  over: {
    border: "border-debit/30",
    bg: "bg-debit/5",
    text: "text-debit",
    chipBg: "bg-debit/10",
    label: "Over",
  },
};

export default function VariableSpendingTracker() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["variable-spending-insights"],
    queryFn: async () => {
      const res = await fetch(URL, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as InsightsResponse;
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <section className="space-y-3">
        <Header />
        <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="space-y-3">
        <Header />
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center text-xs text-muted-foreground">
          Couldn&apos;t load variable spending insights.
        </div>
      </section>
    );
  }

  const sorted = [...(data.categories ?? [])].sort(
    (a, b) => (b.variance ?? 0) - (a.variance ?? 0),
  );

  const overall = statusFor(data.total_actual, data.total_baseline);
  const overallStyles = statusStyles[overall];

  return (
    <section className="space-y-3">
      <Header topRisk={data.top_risk_category} />

      {/* Top totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Total Variable Spend" value={formatINR(data.total_actual)} />
        <Stat label="Total Baseline" value={formatINR(data.total_baseline)} />
        <Stat
          label="Variance"
          value={`${data.total_variance > 0 ? "+" : ""}${formatINR(data.total_variance)}`}
          accentClass={overallStyles.text}
          icon={
            overall === "over" ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : overall === "under" ? (
              <TrendingDown className="h-3.5 w-3.5" />
            ) : (
              <Minus className="h-3.5 w-3.5" />
            )
          }
        />
      </div>

      <ForecastCard
        forecastSpend={data.forecast_total_month_end_spend}
        forecastVariance={data.forecast_total_variance}
        topRisk={data.top_risk_category}
      />



      {/* Category cards */}
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center text-xs text-muted-foreground">
          No category data yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {sorted.map((c) => {
            const s = statusFor(c.actual, c.baseline, c.status);
            const st = statusStyles[s];
            return (
              <div
                key={c.category}
                className={`rounded-lg border ${st.border} ${st.bg} px-3 py-2.5`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate">
                    {c.category}
                  </p>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${st.chipBg} ${st.text}`}
                  >
                    {st.label}
                    {typeof c.variance_percent === "number" && (
                      <span className="ml-1 opacity-80">
                        {c.variance_percent > 0 ? "+" : ""}
                        {Math.round(c.variance_percent)}%
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-1.5 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Actual</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatINR(c.actual)}
                    </p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-[11px] text-muted-foreground">Baseline</p>
                    <p className="text-sm tabular-nums text-foreground/80">
                      {formatINR(c.baseline)}
                    </p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-[11px] text-muted-foreground">Variance</p>
                    <p className={`text-sm font-semibold tabular-nums ${st.text}`}>
                      {c.variance > 0 ? "+" : ""}
                      {formatINR(c.variance)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Header({ topRisk }: { topRisk?: string | null }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          Variable Spending Tracker
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Compare this month&apos;s discretionary spend against your baseline.
        </p>
      </div>
      {topRisk && (
        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-debit/10 text-debit shrink-0">
          Top risk: {topRisk}
        </span>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accentClass,
  icon,
}: {
  label: string;
  value: string;
  accentClass?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </p>
      <p
        className={`mt-1.5 text-xl font-semibold tabular-nums tracking-tight inline-flex items-center gap-1.5 ${accentClass ?? ""}`}
      >
        {icon}
        {value}
      </p>
    </div>
  );
}

function ForecastCard({
  forecastSpend,
  forecastVariance,
  topRisk,
}: {
  forecastSpend?: number;
  forecastVariance?: number;
  topRisk?: string | null;
}) {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (forecastSpend == null && forecastVariance == null) return null;

  const variance = forecastVariance ?? 0;
  const overspend = variance > 0;

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const resp = await fetchThreePaths({
        trigger_type: "drift_correction",
        trigger_amount: variance,
        trigger_description: "Forecasted variable spending overspend",
      });
      storePathsResponse(resp);
      navigate({ to: "/paths" });
    } catch (e) {
      setError((e as Error).message);
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat
          label="Forecast Spend"
          value={forecastSpend != null ? formatINR(forecastSpend) : "—"}
        />
        <Stat
          label="Projected Overspend"
          value={overspend ? formatINR(variance) : formatINR(0)}
          accentClass={overspend ? "text-debit" : "text-success"}
        />
        <Stat
          label="Risk Driver"
          value={topRisk || "—"}
          accentClass={topRisk ? "text-debit" : undefined}
        />
      </div>

      {overspend && (
        <div className="rounded-xl border border-debit/30 bg-debit/5 p-4 space-y-3">
          <div className="flex items-start gap-2 text-sm text-debit">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              At your current pace you may overspend by{" "}
              <span className="font-semibold tabular-nums">
                {formatINR(variance)}
              </span>{" "}
              this month.
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg bg-debit text-white text-sm font-medium px-3 py-2 hover:bg-debit/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating ? "Generating…" : "Generate Recovery Plan"}
          </button>
          {error && (
            <p className="text-xs text-debit">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

