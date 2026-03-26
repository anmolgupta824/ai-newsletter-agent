export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout + retry.
 * - Timeout: 30s (digest sources can be slower than ATS APIs)
 * - Retry: up to 2 retries on 5xx or network errors, exponential backoff
 * - Rate limit (429): wait 60s before retry
 * - Non-retryable: 4xx (bad token, not found)
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit & { maxRetries?: number; timeoutMs?: number } = {}
): Promise<Response> {
  const { maxRetries = 2, timeoutMs = 30000, ...fetchOptions } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
      clearTimeout(timeout);

      // Rate limited — wait 60s and retry
      if (response.status === 429 && attempt < maxRetries) {
        await sleep(60_000);
        continue;
      }

      // Don't retry 4xx (permanent failures)
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      // Retry on 5xx
      if (response.status >= 500 && attempt < maxRetries) {
        const backoff = 1000 * Math.pow(2, attempt); // 2s, 4s
        await sleep(backoff);
        continue;
      }

      return response;
    } catch (err) {
      if (attempt < maxRetries) {
        const backoff = 1000 * Math.pow(2, attempt);
        await sleep(backoff);
        continue;
      }

      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
      }
      throw err;
    }
  }

  throw new Error(`Exhausted retries for ${url}`);
}

/**
 * Run async tasks with a concurrency limit.
 */
export async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const queue = [...tasks];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const task = queue.shift();
      if (task) results.push(await task());
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}
