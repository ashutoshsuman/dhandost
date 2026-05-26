import { Link, Outlet, useRouterState } from "@tanstack/react-router";

const nav = [
  { to: "/", label: "Live Plan" },
  { to: "/transactions", label: "Transactions" },
  { to: "/goals", label: "Goals" },
  { to: "/fixed", label: "Fixed Expenses" },
  { to: "/debts", label: "Debts" },
  { to: "/chat", label: "Chat" },
];

export function Layout({ children }: { children?: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between flex-wrap gap-3">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            Dhan Dost
          </Link>
          <nav className="flex gap-1 text-sm flex-wrap">
            {nav.map((n) => {
              const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {n.label}
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
