import type {MapVariant} from "./app-types";
export type MapVisual = {image: string; source: "annotated" | "raster"; size?: readonly [number, number]; revision: string;};
export const MAP_IMAGE_SELECTIONS_KEY: string;
export function mapVisualFor(map: any): MapVisual | undefined;
export function mapImageFor(map: any): string;
export function mapImageCacheId(map: any, variantId?: string): string;
export function primaryMapVariant(map: any): MapVariant;
export function parseMapImageSelections(raw: unknown): Record<string, MapVariant>;
export function mapSelectionKey(map: any): string;
