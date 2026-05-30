import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import logo from "@/assets/dhandost-logo.png";
import { supabase } from "@/lib/supabase";

const nav = [
  { to: "/", label: "Live Plan" },
  { to: "/transactions", label: "Transactions" },
  { to: "/review", label: "Review" },
  { to: "/goals", label: "Goals" },
  { to: "/fixed", label: "Fixed Expenses" },
  { to: "/debts", label: "Debts" },
  { to: "/chat", label: "Chat" },
];

export function Layout({ children }: { children?: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: reviewCount = 0 } = useQuery({
    queryKey: ["review-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .or("category_source.eq.ai,needs_ai_categorization.eq.true");
      return count ?? 0;
    },
    refetchInterval: 60000,
  });

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <Link to="/" className="flex items-center">
            <img
              src={logo}
              alt="DhanDost"
              className="h-[120px] w-[120px] rounded-2xl object-contain"
            />
          </Link>
          <nav className="flex gap-1 text-sm flex-wrap">
            {nav.map((n) => {
              const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
              const showBadge = n.to === "/review" && reviewCount > 0;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`relative px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {n.label}
                  {showBadge && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tabular-nums">
                      {reviewCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
