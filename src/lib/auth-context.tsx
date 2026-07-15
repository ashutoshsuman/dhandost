import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type Profile = {
  full_name: string | null;
  has_completed_tour: boolean | null;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  userId: string | null;
  profile: Profile | null;
  /** True once the initial session lookup has resolved. */
  isAuthReady: boolean;
  /** True while we're checking the profile for a freshly-loaded session. */
  isProfileLoading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const lastUserIdRef = useRef<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    setIsProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, has_completed_tour")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        console.error("profile fetch failed:", error);
        setProfile({ full_name: null, has_completed_tour: null });
        return;
      }
      const next: Profile = {
        full_name: data?.full_name ?? null,
        has_completed_tour: data?.has_completed_tour ?? null,
      };
      setProfile(next);
      if (next.full_name) {
        try {
          pendo.identify({
            visitor: {
              id: userId,
              full_name: next.full_name,
              has_completed_tour: next.has_completed_tour ?? false,
            },
          });
        } catch {
          /* ignore */
        }
      }
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const s = data.session;
      setSession(s);
      lastUserIdRef.current = s?.user?.id ?? null;
      if (s?.user?.id) {
        await loadProfile(s.user.id);
      } else {
        setProfile(null);
      }
      if (mounted) setIsAuthReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      const prevUserId = lastUserIdRef.current;
      const nextUserId = s?.user?.id ?? null;

      setSession(s);
      lastUserIdRef.current = nextUserId;

      if (event === "SIGNED_OUT" || (!nextUserId && prevUserId)) {
        setProfile(null);
        // Drop every cached query so no protected data leaks across sessions.
        queryClient.cancelQueries().catch(() => {});
        queryClient.clear();
        return;
      }

      if (event === "SIGNED_IN" || (nextUserId && nextUserId !== prevUserId)) {
        // Fresh session — refetch every active query, and load profile.
        void loadProfile(nextUserId!);
        queryClient.invalidateQueries();
        return;
      }

      if (event === "USER_UPDATED" && nextUserId) {
        void loadProfile(nextUserId);
      }
      // TOKEN_REFRESHED / INITIAL_SESSION: no cache churn.
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile, queryClient]);

  const refreshProfile = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) return;
    await loadProfile(uid);
  }, [session, loadProfile]);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    userId: session?.user?.id ?? null,
    profile,
    isAuthReady,
    isProfileLoading,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
