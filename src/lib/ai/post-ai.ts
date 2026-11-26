export type AIPostOutcome<T> =
  | { status: "ok"; data: T }
  | { status: "daily-limit" }
  | { status: "failed"; message: string };

const MAX_ATTEMPTS = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Counts down out loud so the UI can say "continuing in 12s" while we wait. */
async function waitWithCountdown(ms: number, onWait: (secondsLeft: number | null) => void) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    onWait(Math.ceil((end - Date.now()) / 1000));
    await sleep(Math.min(1000, end - Date.now()));
  }
  onWait(null);
}

/**
 * POSTs JSON to one of our AI routes. Rate limits and "busy" responses are waited out
 * automatically, so callers never have to tell the user to "try again".
 */
export async function postAI<T>(
  url: string,
  body: unknown,
  onWait: (secondsLeft: number | null) => void
): Promise<AIPostOutcome<T>> {
  let lastError = "Something went wrong";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Network error";
      await waitWithCountdown(2000 * attempt, onWait);
      continue;
    }

    const data = await res.json().catch(() => null);
    if (res.ok) return { status: "ok", data: data as T };

    const retryAfter = Number(data?.retryAfterSeconds) || Number(res.headers.get("retry-after")) || 8;
    if (res.status === 429) {
      if (data?.scope === "day") return { status: "daily-limit" };
      await waitWithCountdown(Math.min(retryAfter * 1000 * 2 ** (attempt - 1), 40_000), onWait);
      continue;
    }
    if (res.status === 503) {
      await waitWithCountdown(Math.min(retryAfter * 1000 * 2 ** (attempt - 1), 20_000), onWait);
      continue;
    }

    lastError = data?.error ?? `HTTP ${res.status}`;
    if (res.status === 400 || res.status === 413) break;
    await waitWithCountdown(2000 * attempt, onWait);
  }

  return { status: "failed", message: lastError };
}
