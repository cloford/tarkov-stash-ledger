export function normalizeKeyText(value: unknown): string;
export function filterKeys(keys: any[], filters?: {query?: string; map?: string; usage?: "all" | "task" | "other";}): any[];
export function mergeKeyCatalogWithBundled(runtime: any, bundled: any): any;
export function keyUsesLabel(uses: unknown): string;
export function keyPriceRows(key: any): {kind: string; label: string; value: number;}[];
export function keyTaskEvidence(key: any): {status: "available" | "unavailable"; required: any[]; other: any[]; requiredLabel: string; otherLabel: string;};
export function formatCatalogTime(value: unknown): string;
