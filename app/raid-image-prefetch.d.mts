export function buildRaidImageTargets(entries: any[], options?: any): any;
export function summarizeRaidImageTargets(targets: any[]): any;
export function inspectRaidImageTargets(targets: any[], cache: (...args: any[]) => Promise<any>, options?: any): Promise<any[]>;
export function saveRaidImageTargets(targets: any[], cache: (...args: any[]) => Promise<any>, options?: any): Promise<any[]>;
export function resolveCachedImage(result: any, remoteUrl: string): {url: string; source: string;};
export function taskMediaCacheId(taskId: string, image: any): string;
