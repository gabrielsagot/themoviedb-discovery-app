type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

// A single process-wide store shared by every cached endpoint. Entries are
// keyed by the caller (endpoint + sorted query params) and are never deleted
// on expiry, only replaced by a later successful fetch — that's what lets
// getOrFetch keep serving a stale value indefinitely if TMDB stays down.
const store = new Map<string, CacheEntry<unknown>>();

/**
 * Returns a cached value for `key` if it's still fresh, otherwise calls
 * `fetcher` to get a new one and caches it for `ttlMs`. If `fetcher` throws
 * (TMDB down, rate-limited, ...) and a previous value exists for `key` —
 * fresh or stale — that value is served instead of propagating the error, so
 * the app keeps working through a TMDB outage. The error is only rethrown
 * when there is nothing cached yet to fall back on.
 * @param key A unique identifier for this request (endpoint + query params).
 * @param ttlMs How long a freshly fetched value should be considered fresh.
 * @param fetcher Performs the actual request when the cache can't serve it.
 * @returns The cached, freshly fetched, or stale-fallback value.
 */
export async function getOrFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = store.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const fresh = await fetcher();
    store.set(key, { value: fresh, expiresAt: Date.now() + ttlMs });
    return fresh;
  } catch (error) {
    if (cached) return cached.value;
    throw error;
  }
}
