export const RAID_PREP_STORAGE_KEY: string;
export function sanitizeRaidTaskIds(value: unknown, options?: {limit?: number}): string[];
export function parseRaidTaskIds(raw: unknown): string[];
export function updateRaidTaskIds(ids: unknown, taskId: unknown, included: boolean): string[];
export function resolveRaidTasks(ids: unknown, tasks: unknown): Array<{id: string; task: any | null}>;
export function taskMapReferences(task: any): any[];
export function buildRaidPrepSummary(entries: unknown, requirementStates?: Record<string, {status?: string; keys?: any[]}>): any;
export function loadRaidKeyRequirements(entries: unknown, options: {request?: ((id: string) => Promise<any>) | undefined; cache: any; onState: (id: string, state: {status: "loading" | "ready" | "failed"; keys: any[]}) => void;}): Promise<any[]>;
