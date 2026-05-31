import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, TrendingUp, Flame } from "lucide-react";
import { formatINR } from "@/lib/format";

type CategoryRow = {
  category: string;
  actual: number;
  baseline: number;
  variance: number;
  variance_percent?: number;
  status?: "under" | "within" | "over";
};

type InsightsResponse = {
  total_baseline: number;
  total_actual: number;
  total_variance: number;
  top_risk_category?: string | null;
  categories: CategoryRow[];
};

const URL =
  "https://ibjsdafxjggjyamkdjeh.supabase.co/functions/v1/variable-spending-insights";
const KEY = "sb_publishable_ztTyEdZPNNfk5PjttJimDg_-g3fmC0D";

function isOver(c: CategoryRow) {
  if (c.status) return c.status === "over";
  return c.actual > c.baseline;
}

export default function SpendingInsights() {
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

  const Header = (
    <div>
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
        Spending Insights
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Friendly nudges based on this month&apos;s pace.
      </p>
    </div>
  );

  if (isLoading || error || !data) {
    return (
      <section className="space-y-3">
        {Header}
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center text-xs text-muted-foreground">
          {isLoading ? "Loading insights…" : "Couldn't load spending insights."}
        </div>
      </section>
    );
  }

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = Math.max(now.getDate(), 1);
  const paceFactor = daysInMonth / dayOfMonth;

  const overCats = (data.categories ?? []).filter(isOver);
  const overCount = overCats.length;

  // Forecast month-end overspend = sum over categories of max(0, forecast - baseline)
  const forecastOverspend = (data.categories ?? []).reduce((sum, c) => {
    const forecast = c.actual * paceFactor;
    return sum + Math.max(0, forecast - c.baseline);
  }, 0);

  const largest = [...overCats].sort((a, b) => b.variance - a.variance)[0];
  const largestForecast = largest ? largest.actual * paceFactor : 0;
  const largestForecastOver = largest
    ? Math.max(0, largestForecast - largest.baseline)
    : 0;
  const largestPct = largest
    ? Math.round((largest.actual / Math.max(largest.baseline, 1)) * 100)
    : 0;

  return (
    <section className="space-y-3">
      {Header}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Categories Over Baseline"
          value={`${overCount}`}
          accent={overCount > 0 ? "text-debit" : "text-success"}
        />
        <StatCard
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Forecast Month-End Overspend"
          value={formatINR(forecastOverspend)}
          accent={forecastOverspend > 0 ? "text-debit" : "text-success"}
        />
        <StatCard
          icon={<Flame className="h-3.5 w-3.5" />}
          label="Largest Overspending Category"
          value={largest ? largest.category : "—"}
          subtitle={largest ? `+${formatINR(largest.variance)} over` : "All on track"}
          accent={largest ? "text-debit" : "text-success"}
        />
      </div>

      {largest && (
        <div className="space-y-2">
          <InsightLine
            tone="warn"
            text={`${largest.category} spending is already ${largestPct}% of your normal monthly spend.`}
          />
          {largestForecastOver > 0 && (
            <InsightLine
              tone="danger"
              text={`At your current pace you may exceed your ${largest.category} budget by ${formatINR(largestForecastOver)} this month.`}
            />
          )}
          {overCount > 1 && (
            <InsightLine
              tone="warn"
              text={`${overCount} categories are tracking above baseline this month — review the tracker above to rebalance.`}
            />
          )}
        </div>
      )}

      {!largest && (
        <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2.5 text-sm text-success">
          Nice — every category is within or under its baseline this month.
        </div>
      )}
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtitle,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium inline-flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p
        className={`mt-1.5 text-xl font-semibold tabular-nums tracking-tight ${accent ?? ""}`}
      >
        {value}
      </p>
      {subtitle && (
        <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}

function InsightLine({
  tone,
  text,
}: {
  tone: "warn" | "danger";
  text: string;
}) {
  const styles =
    tone === "danger"
      ? "border-debit/30 bg-debit/5 text-debit"
      : "border-warning/30 bg-warning/5 text-warning";
  return (
    <div className={`rounded-lg border ${styles} px-3 py-2.5 text-sm`}>
      {text}
    </div>
  );
}
