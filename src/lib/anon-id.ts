const STORAGE_KEY = "qanoon-anon-id";

/** Reads a persisted id from localStorage, or creates and persists one. Client-only. */
export function getOrCreateLocalId(key: string): { id: string; isNew: boolean } {
  try {
    const existing = localStorage.getItem(key);
    if (existing) return { id: existing, isNew: false };
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through to a fresh, unpersisted id.
  }
  const id = crypto.randomUUID();
  try {
    localStorage.setItem(key, id);
  } catch {
    // Nothing to persist to.
  }
  return { id, isNew: true };
}

/** Persists the browser's anonymous session id across visits. Client-only. */
export function getOrCreateAnonId(): string {
  return getOrCreateLocalId(STORAGE_KEY).id;
}
