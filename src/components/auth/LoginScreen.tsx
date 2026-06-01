import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

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
  }

  function reset() {
    setStatus("idle");
    setError(null);
    setEmail("");
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center px-6 font-sans">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: "#1a9c6e" }}>
            DhanDost
          </h1>
          <p className="text-sm text-muted-foreground">Your Personal Finance Friend</p>
        </div>

        {status === "sent" ? (
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
          <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
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
              className="w-full h-10 rounded-md text-sm font-medium text-white transition-opacity disabled:opacity-70"
              style={{ backgroundColor: "#1a9c6e" }}
            >
              {status === "sending" ? "Sending…" : "Send login link"}
            </button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
