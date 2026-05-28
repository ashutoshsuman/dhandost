import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui-primitives";
import { formatINR } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import {
  readPathsResponse,
  type PathOption,
  type ThreePathsResponse,
} from "@/lib/three-paths";

export const Route = createFileRoute("/paths")({
  component: () => (
    <Layout>
      <PathsPage />
    </Layout>
  ),
});

const statusStyles: Record<string, string> = {
  on_track: "bg-emerald-50 text-emerald-700 border-emerald-200",
  at_risk: "bg-amber-50 text-amber-700 border-amber-200",
  behind: "bg-red-50 text-red-700 border-red-200",
};
const statusLabel: Record<string, string> = {
  on_track: "On track",
  at_risk: "At risk",
  behind: "Behind",
};

function PathsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<ThreePathsResponse | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const d = readPathsResponse();
    if (!d) navigate({ to: "/transactions" });
    else setData(d);
  }, [navigate]);

  const choose = async (label: string | null) => {
    setSaving(label ?? "__none__");
    const { error } = await supabase.from("path_selections").insert({
      path_chosen: label,
    });
    if (error) {
      // Don't block the redirect on persistence issues — surface and continue.
      console.error("path_selections insert failed:", error);
      toast.error("Couldn't save selection, but updating your plan anyway.");
    } else {
      toast("New plan has been saved. We'll check back in 30 days to see how it went.");
    }
    navigate({ to: "/" });
  };

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Three paths to consider</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Based on {data.trigger_type === "surprise_income" ? "a surprise income" : "a surprise expense"} of{" "}
          {formatINR(data.trigger_amount)}
          {data.trigger_description ? ` — ${data.trigger_description}` : ""}.
        </p>
      </div>

      <div className="space-y-4">
        {data.paths.map((p, i) => (
          <PathCard
            key={i}
            path={p}
            saving={saving === p.label}
            disabled={saving !== null}
            onChoose={() => choose(p.label)}
          />
        ))}
      </div>

      <div className="rounded-lg border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
        This is general guidance, not investment advice. Specific products are intentionally not named.
      </div>

      <div className="flex justify-center">
        <Button
          variant="outline"
          disabled={saving !== null}
          onClick={() => choose(null)}
        >
          {saving === "__none__" ? "Saving…" : "None of these — keep my plan unchanged"}
        </Button>
      </div>
    </div>
  );
}

function PathCard({
  path, saving, disabled, onChoose,
}: { path: PathOption; saving: boolean; disabled: boolean; onChoose: () => void }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{path.label}</h2>
        <p className="text-sm text-muted-foreground mt-1">{path.description}</p>
      </div>

      {path.allocation?.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Allocation</div>
          <ul className="space-y-1 text-sm">
            {path.allocation.map((a, i) => (
              <li key={i} className="tabular-nums">
                → {formatINR(a.amount)} to {a.target} <span className="text-muted-foreground">({a.action})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {path.goal_impacts?.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Goal impact</div>
          <ul className="space-y-1.5 text-sm">
            {path.goal_impacts.map((g, i) => (
              <li key={i} className="flex items-center gap-2 flex-wrap">
                <span>{g.goal_name}: {g.delta_text}</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs border ${statusStyles[g.new_status] ?? "bg-secondary text-muted-foreground border-border"}`}
                >
                  {statusLabel[g.new_status] ?? g.new_status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {path.discretionary_impact && path.discretionary_impact.amount_per_month !== 0 && (
        <div className="text-sm text-muted-foreground">
          Discretionary spending: {formatINR(Math.abs(path.discretionary_impact.amount_per_month))} less per month for{" "}
          {path.discretionary_impact.months} months
        </div>
      )}

      <div className="pt-2">
        <Button onClick={onChoose} disabled={disabled} className="w-full sm:w-auto">
          {saving ? "Saving…" : "Choose this path"}
        </Button>
      </div>
    </div>
  );
}
