type CacheEntry<T> = { v: T; exp: number };
const store = new Map<string, CacheEntry<any>>();
const DEFAULT_TTL = 30_000; // 30 detik

export function cacheGet<T>(key: string): T | undefined {
  const it = store.get(key);
  if (!it) return;
  if (it.exp < Date.now()) {
    store.delete(key);
    return;
  }
  return it.v as T;
}

export function cacheSet<T>(key: string, v: T, ttl = DEFAULT_TTL) {
  store.set(key, { v, exp: Date.now() + ttl });
}
