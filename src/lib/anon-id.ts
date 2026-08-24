const STORAGE_KEY = "qanoon-anon-id";

/** Persists the browser's anonymous session id across visits. Client-only. */
export function getOrCreateAnonId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
