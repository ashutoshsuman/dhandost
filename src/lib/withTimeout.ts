/**
 * Race a promise against a timeout. Rejects with a TimeoutError when
 * `ms` elapses before the promise settles.
 *
 * Timeout tiers used in this app:
 *   - 10s: fast DB reads/writes (goals, fixed expenses, debts, page data).
 *   - 60s: AI/LLM operations (Live Plan compute, Three Paths, chat).
 *   - 5s : sign-out (short so the UI never hangs; local session is cleared
 *          even if the network call errors).
 */
export class TimeoutError extends Error {
  constructor(message = "Request timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  label?: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new TimeoutError(
          label ? `${label} timed out after ${ms}ms` : `Timed out after ${ms}ms`,
        ),
      );
    }, ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

export const TIMEOUT_FAST = 10_000;
export const TIMEOUT_AI = 60_000;
export const TIMEOUT_SIGNOUT = 5_000;
