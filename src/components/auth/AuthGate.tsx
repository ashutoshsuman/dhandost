import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { LoginScreen } from "./LoginScreen";

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [needsName, setNeedsName] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkProfile(userId: string) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", userId)
        .single();
      if (!mounted) return;
      if (profileError) {
        console.error("profile check failed:", profileError);
        setNeedsName(true);
        return;
      }
      setNeedsName(profile?.full_name ? false : true);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user?.id) {
        checkProfile(data.session.user.id).then(() => setReady(true));
      } else {
        setNeedsName(false);
        setReady(true);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user?.id) {
        await checkProfile(s.user.id);
      } else {
        setNeedsName(false);
      }
      setReady(true);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function refreshProfile() {
    if (!session?.user?.id) return;
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", session.user.id)
      .single();
    if (profileError) {
      console.error("refresh profile failed:", profileError);
      setNeedsName(false);
      return;
    }
    setNeedsName(profile?.full_name ? false : true);
  }

  if (!ready || needsName === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (session && needsName) {
    return (
      <LoginScreen
        mode="name-capture"
        user={session.user}
        onProfileUpdated={refreshProfile}
      />
    );
  }

  if (!session) return <LoginScreen mode="send-link" />;
  return <>{children}</>;
}
