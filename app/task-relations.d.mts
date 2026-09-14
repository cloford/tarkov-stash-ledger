export type TaskRequirement = {id: string; name?: string; nameJa?: string; status?: Array<string | number>;};
export type TaskRelationSource = {id: string; name?: string; nameJa?: string; trader?: string; gameMode?: string; mode?: string; relationsAvailable?: boolean; prerequisites?: TaskRequirement[];};
export type TaskRelationEntry = TaskRequirement & {task: TaskRelationSource | null; missing: boolean; cycle?: boolean; duplicate?: boolean; truncated?: boolean; limit?: boolean; children?: TaskRelationEntry[];};
export type TaskRelationIndex = {defaultGameMode: string; byKey: Map<string, TaskRelationSource>; successorsByKey: Map<string, Map<string, {task: TaskRelationSource; status: Array<string | number>;}>>; completeByMode: Map<string, boolean>;};
export function taskStatusLabels(values: unknown): string[];
export function buildTaskRelationIndex(tasks: unknown, options?: {defaultGameMode?: string;}): TaskRelationIndex;
export function directTaskRelations(index: TaskRelationIndex, task: TaskRelationSource): {mode: string; prerequisites: TaskRelationEntry[]; successors: Array<{task: TaskRelationSource; status: Array<string | number>; missing: boolean;}>; prerequisitesAvailable: boolean; successorsAvailable: boolean;};
export function expandTaskPrerequisites(index: TaskRelationIndex, task: TaskRelationSource, options?: {maxDepth?: number; maxNodes?: number;}): {nodes: TaskRelationEntry[]; nodeCount: number; limitReached: boolean;};
