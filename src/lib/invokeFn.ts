import { supabase } from "@/lib/supabase";

export class FunctionInvokeError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
    this.name = "FunctionInvokeError";
  }
}

/**
 * Invoke a Supabase Edge Function with the authenticated client.
 * The user's access token is attached automatically by supabase.functions.invoke
 * when a session exists.
 *
 * - If no session exists: signs out (AuthGate will show the login screen).
 * - On 401 / "Not authenticated": signs out (treat as expired session).
 * - Logs the real error message + status for debugging.
 */
export async function invokeFn<T = unknown>(
  name: string,
  body?: unknown,
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    await supabase.auth.signOut();
    throw new FunctionInvokeError("No active session", 401);
  }

  const { data, error } = await supabase.functions.invoke<T>(name, {
    body: body ?? {},
  });

  if (error) {
    const status = (error as { status?: number; context?: { status?: number } })
      .status ?? (error as { context?: { status?: number } }).context?.status;
    const message = error.message || "Function invocation failed";
    console.error(`[edge:${name}] ${status ?? ""} ${message}`, error);

    const isAuthError =
      status === 401 ||
      /not authenticated|unauthorized|jwt/i.test(message);
    if (isAuthError) {
      await supabase.auth.signOut();
    }
    throw new FunctionInvokeError(message, status);
  }

  return data as T;
}
