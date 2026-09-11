export type MapDataResult = {maps: any[]; source: string; updatedAt?: string | null; error?: string;};
export type TaskMedia = {url: string; caption: string; width?: number; height?: number;};
export type MapVariant = {id: string; url: string; title: string; kind: string; width?: number; height?: number; source?: string; primary?: boolean;};
export type KeyMapFocus = {keyId: string; keyName: string; mapId: string; positions: Array<{x: number; y?: number; z: number; type?: string;}>;};

declare global {
  interface Window {
    stashAI?: {
      media: (url: string) => Promise<TaskMedia[]>;
      requirements: (id: string) => Promise<{keys: any[]; verified: boolean;}>;
      weaponBuild: (id: string) => Promise<{builds: any[]; verified: boolean;}>;
      translate: (texts: string[]) => Promise<Record<string, string>>;
      traderPortraits: (names: string[]) => Promise<Record<string, string>>;
      maps: () => Promise<MapDataResult | any[]>;
      refreshMaps: () => Promise<MapDataResult | any[]>;
      cacheMapImage: (url: string, mapId: string, refresh?: boolean) => Promise<{url: string; cached: boolean; updatedAt?: string; sha256?: string; error?: string;}>;
      mapVariants: (map: string) => Promise<{variants: MapVariant[]; sourceUrl: string; error?: string;}>;
      keys: () => Promise<any>;
      refreshKeys: () => Promise<any>;
      extractImage: (map: string, extract: string) => Promise<string>;
      extractGuide: (map: string, extract: string) => Promise<{images: TaskMedia[]; detail: string; sourceUrl: string; searchUrl: string; verified: boolean;}>;
    };
  }
}


