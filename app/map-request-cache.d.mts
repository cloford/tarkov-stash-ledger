export type RequestCache<T> = {
  get(key: string, load: () => Promise<T> | T): Promise<T>;
  delete(key: string): void;
  clear(): void;
  readonly size: number;
};

export function createRequestCache<T = unknown>(options?: {
  maxEntries?: number;
  retain?: (value: T) => boolean;
}): RequestCache<T>;

export const mapVariantRequests: RequestCache<any>;
export const mapImageCacheChecks: RequestCache<any>;
