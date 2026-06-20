import { useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import logoAsset from "@/assets/dhandost-logo.png.asset.json";

type LoginScreenMode = "send-link" | "name-capture";

export function LoginScreen({
  mode = "send-link",
  user,
  onProfileUpdated,
}: {
  mode?: LoginScreenMode;
  user?: User;
  onProfileUpdated?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "error" | "updating"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin,
      },
    });
    if (err) {
      setStatus("error");
      setError("Couldn't send the link — please check the address and try again.");
      return;
    }
    setStatus("sent");
    if (typeof pendo !== 'undefined') {
      pendo.track("login_link_sent", {
        email_domain: email.trim().split("@")[1] || "",
      });
    }
  }

  async function onNameSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !user) return;
    setStatus("updating");
    setError(null);
    const combinedName = `${firstName.trim()} ${lastName.trim()}`;
    const { error: err } = await supabase
      .from("profiles")
      .update({ full_name: combinedName })
      .eq("user_id", user.id);
    if (err) {
      setStatus("error");
      setError("Couldn't save your name — please try again.");
      return;
    }
    if (typeof pendo !== 'undefined') {
      pendo.track("onboarding_name_submitted", {
        has_first_name: !!firstName.trim(),
        has_last_name: !!lastName.trim(),
      });
    }
    onProfileUpdated?.();
  }

  function reset() {
    setStatus("idle");
    setError(null);
    setEmail("");
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center px-6 font-sans">
      <div className="w-full max-w-sm space-y-1">
        <div className="text-center">
          <img
            src={logoAsset.url}
            alt="DhanDost logo"
            className="mx-auto h-auto max-w-[220px]"
          />
        </div>

        {mode === "name-capture" ? (
          <form
            onSubmit={onNameSubmit}
            className="space-y-4 rounded-lg border border-border bg-card p-6"
          >
            <p className="text-sm text-foreground text-center">
              Welcome back! Please tell us your name to continue.
            </p>
            <div className="space-y-2">
              <label
                htmlFor="firstName"
                className="text-sm font-medium text-foreground"
              >
                First Name
              </label>
              <input
                id="firstName"
                type="text"
                required
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                disabled={status === "updating"}
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="lastName"
                className="text-sm font-medium text-foreground"
              >
                Last Name
              </label>
              <input
                id="lastName"
                type="text"
                required
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                disabled={status === "updating"}
              />
            </div>
            <button
              type="submit"
              disabled={
                status === "updating" || !firstName.trim() || !lastName.trim()
              }
              className="w-full h-10 rounded-md text-sm font-medium text-white transition-opacity disabled:opacity-70"
              style={{ backgroundColor: "#1a9c6e" }}
            >
              {status === "updating" ? "Saving…" : "Continue"}
            </button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        ) : status === "sent" ? (
          <div className="space-y-4 rounded-lg border border-border bg-card p-6 text-center">
            <p className="text-sm text-foreground">
              Check your email — we sent a login link to{" "}
              <span className="font-medium">{email}</span>.
            </p>
            <button
              type="button"
              onClick={reset}
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="space-y-4 rounded-lg border border-border bg-card p-6"
          >
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-foreground"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                disabled={status === "sending"}
              />
            </div>
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full h-10 rounded-md text-sm font-medium text-white transition-opacity disabled:opacity-70 cursor-pointer"
              style={{ backgroundColor: "#1a9c6e" }}
            >
              {status === "sending" ? "Sending…" : "Send login link"}
            </button>
            <p className="text-xs text-center text-muted-foreground">
              🔒 Private & Secure — your data is safe with us
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
