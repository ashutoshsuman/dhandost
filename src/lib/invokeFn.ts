import { supabase } from "@/lib/supabase";
import { TIMEOUT_FAST, TimeoutError, withTimeout } from "@/lib/withTimeout";

export class FunctionInvokeError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
    this.name = "FunctionInvokeError";
  }
}

export type InvokeOptions = {
  /** Timeout in ms. Defaults to 10s (fast DB-backed edge functions).
   *  Pass 60_000 for AI/LLM-backed functions. */
  timeoutMs?: number;
};

/**
 * Invoke a Supabase Edge Function with the authenticated client.
 * The user's access token is attached automatically by supabase.functions.invoke
 * when a session exists.
 *
 * - If no session exists: signs out (AuthGate will show the login screen).
 * - On 401 / "Not authenticated": signs out (treat as expired session).
 * - Enforces a per-call timeout so the UI never hangs on a stuck request.
 * - Logs the real error message + status for debugging.
 */
export async function invokeFn<T = unknown>(
  name: string,
  body?: unknown,
  options: InvokeOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? TIMEOUT_FAST;

  const { data: sessionData } = await withTimeout(
    supabase.auth.getSession(),
    TIMEOUT_FAST,
    "session lookup",
  ).catch((err) => {
    console.error(`[edge:${name}] session lookup failed`, err);
    throw new FunctionInvokeError(
      err instanceof TimeoutError ? "Session check timed out" : "Session check failed",
    );
  });

  if (!sessionData.session) {
    await supabase.auth.signOut().catch(() => {});
    throw new FunctionInvokeError("No active session", 401);
  }

  let result: { data: T | null; error: unknown };
  try {
    result = (await withTimeout(
      supabase.functions.invoke<T>(name, { body: body ?? {} }),
      timeoutMs,
      `edge function ${name}`,
    )) as { data: T | null; error: unknown };
  } catch (err) {
    if (err instanceof TimeoutError) {
      console.error(`[edge:${name}] ${err.message}`);
      throw new FunctionInvokeError(
        "This is taking longer than expected — please try again.",
      );
    }
    throw err;
  }

  const { data, error } = result;
  if (error) {
    const e = error as { message?: string; status?: number; context?: { status?: number } };
    const status = e.status ?? e.context?.status;
    const message = e.message || "Function invocation failed";
    console.error(`[edge:${name}] ${status ?? ""} ${message}`, error);

    const isAuthError =
      status === 401 || /not authenticated|unauthorized|jwt/i.test(message);
    if (isAuthError) {
      await supabase.auth.signOut().catch(() => {});
    }
    throw new FunctionInvokeError(message, status);
  }

  return data as T;
}
