/**
 * Shares detail requests between mounts of the same task.  Failed requests are
 * deliberately forgotten so returning to a task can try the IPC request again.
 */
export function createRetryableRequestCache({ttlMs = 120000, now = Date.now} = {}) {
  const requests = new Map();

  return {
    get(key, load, isUsable = () => true) {
      const existing = requests.get(key);
      if (existing && existing.expiresAt > now()) return existing.request;
      if (existing) requests.delete(key);
      const request = Promise.resolve()
        .then(load)
        .then(value => {
          if (!isUsable(value)) throw new Error(`Unusable cached response: ${key}`);
          return value;
        });
      const entry = {request, expiresAt: now() + ttlMs};
      requests.set(key, entry);
      request.catch(() => {
        if (requests.get(key) === entry) requests.delete(key);
      });
      return request;
    },
    clear() {
      requests.clear();
    }
  };
}

export const taskDetailRequestCache = createRetryableRequestCache();

export function translationRequestKey(texts) {
  return [...new Set((texts || []).map(text => String(text || "").trim()).filter(Boolean))]
    .sort()
    .join("\u0001");
}
