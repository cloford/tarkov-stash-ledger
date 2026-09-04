export function createStartupRequestCache() {
  let savedMapsRequest, refreshedMapsRequest, savedKeysRequest, refreshedKeysRequest;
  const once = (get, set, operation) => {
    const current = get();
    if (current) return current;
    const request = Promise.resolve().then(operation);
    set(request);
    request.catch(() => set(undefined));
    return request;
  };
  return {
    savedMaps(api) { return once(() => savedMapsRequest, value => {savedMapsRequest = value;}, () => api.maps()); },
    refreshMaps(api) { return once(() => refreshedMapsRequest, value => {refreshedMapsRequest = value;}, () => api.refreshMaps()); },
    savedKeys(api) { return once(() => savedKeysRequest, value => {savedKeysRequest = value;}, () => api.keys()); },
    refreshKeys(api) { return once(() => refreshedKeysRequest, value => {refreshedKeysRequest = value;}, () => api.refreshKeys()); }
  };
}

// モジュールはレンダラープロセス内で一度だけ評価されるため、画面の再表示も同一更新に合流する。
export const startupRequests = createStartupRequestCache();
