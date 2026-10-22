// Rejects if `promise` hasn't settled within `ms`. A server action whose
// response is lost (the phone drops or switches network mid-request) never
// settles at all -- no error, no result -- so without this a "Saving…" button
// stays disabled until the page is reloaded. The underlying request isn't
// cancelled; callers should only wrap actions that are safe to retry.
export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Timed out after ${ms} ms`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
