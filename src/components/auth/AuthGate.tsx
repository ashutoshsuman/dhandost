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

    async function checkProfile(userId: string, email: string | undefined) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, has_completed_tour")
        .eq("user_id", userId)
        .single();
      if (!mounted) return;
      if (profileError) {
        console.error("profile check failed:", profileError);
        setNeedsName(true);
        return;
      }
      const hasName = !!profile?.full_name;
      setNeedsName(!hasName);
      if (hasName) {
        pendo.identify({
          visitor: {
            id: userId,
            email: email ?? '',
            full_name: profile.full_name,
            has_completed_tour: profile.has_completed_tour ?? false,
          },
        });
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user?.id) {
        checkProfile(data.session.user.id, data.session.user.email).then(() => setReady(true));
      } else {
        setNeedsName(false);
        setReady(true);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user?.id) {
        await checkProfile(s.user.id, s.user.email);
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
      .select("full_name, has_completed_tour")
      .eq("user_id", session.user.id)
      .single();
    if (profileError) {
      console.error("refresh profile failed:", profileError);
      setNeedsName(false);
      return;
    }
    const hasName = !!profile?.full_name;
    setNeedsName(!hasName);
    if (hasName) {
      pendo.identify({
        visitor: {
          id: session.user.id,
          email: session.user.email ?? '',
          full_name: profile.full_name,
          has_completed_tour: profile.has_completed_tour ?? false,
        },
      });
    }
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
