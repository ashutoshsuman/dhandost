import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { LoginScreen } from "./LoginScreen";

export function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthReady, isProfileLoading, session, user, profile, refreshProfile } =
    useAuth();

  // Block rendering until the initial session lookup (and, if signed in,
  // the profile fetch) has resolved. This prevents user-dependent queries
  // from mounting before auth state is available.
  if (!isAuthReady || (session && isProfileLoading && profile === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!session || !user) return <LoginScreen mode="send-link" />;

  if (!profile?.full_name) {
    return (
      <LoginScreen
        mode="name-capture"
        user={user}
        onProfileUpdated={() => {
          void refreshProfile();
        }}
      />
    );
  }

  return <>{children}</>;
}
