export type RetryableRequestCache = {
  get<T>(
    key: string,
    load: () => Promise<T> | T,
    isUsable?: (value: T) => boolean,
  ): Promise<T>;
  clear(): void;
};

export function createRetryableRequestCache(options?: {
  ttlMs?: number;
  now?: () => number;
}): RetryableRequestCache;

export const taskDetailRequestCache: RetryableRequestCache;

export function translationRequestKey(texts?: readonly unknown[]): string;
