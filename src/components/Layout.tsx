import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import logo from "@/assets/dhandost-logo.png";

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
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src={logo}
              alt="DhanDost logo"
              className="h-9 w-9 rounded-lg object-contain"
            />
            <span className="text-lg font-bold tracking-tight">
              <span className="text-gradient-brand">DhanDost</span>
            </span>
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
