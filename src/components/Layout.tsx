import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import logoAsset from "@/assets/dhandost-logo.png.asset.json";
const logo = logoAsset.url;
import { supabase } from "@/lib/supabase";
import { TrustBadge } from "@/components/TrustBadge";
import { CoachLauncher } from "@/components/coach/CoachLauncher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const nav = [
  { to: "/", label: "Live Plan" },
  { to: "/transactions", label: "Transactions" },
  { to: "/review", label: "Review" },
  { to: "/goals", label: "Goals" },
  { to: "/fixed", label: "Fixed Expenses" },
  { to: "/debts", label: "Debts" },
  { to: "/chat", label: "Chat" },
];

function UserMenu() {
  const [firstName, setFirstName] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    async function loadName() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user || !mounted) return;

      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      const fullName = (data?.full_name ?? "").trim();
      const idx = fullName.indexOf(" ");
      setFirstName(idx === -1 ? fullName : fullName.slice(0, idx));
    }

    loadName();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium text-sm text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors data-[state=open]:bg-secondary data-[state=open]:text-foreground"
        >
          Hi, {firstName || "there"}
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        <DropdownMenuItem asChild className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground focus:text-foreground">
          <Link to="/profile">Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground focus:text-foreground">
          <Link to="/data-management">Data</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => supabase.auth.signOut()}
          className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground focus:text-foreground"
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
          <Link to="/" className="flex items-center gap-3">
            <img
              src={logo}
              alt="DhanDost"
              className="h-[140px] w-[140px] rounded-2xl object-contain"
            />
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <TrustBadge />
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
              <UserMenu />
            </nav>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        {children ?? <Outlet />}
      </main>
      <footer className="border-t border-border bg-card/60 mt-12">
        <div className="mx-auto max-w-5xl px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} DhanDost</span>
          <nav className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="/security" className="hover:text-foreground transition-colors">Security</a>
            <a href="/data-policy" className="hover:text-foreground transition-colors">Data Policy</a>
          </nav>
        </div>
      </footer>
      {path !== "/chat" && <CoachLauncher />}
    </div>
  );
}
