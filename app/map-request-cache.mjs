export function createRequestCache({maxEntries = 32, retain = () => true} = {}) {
  const requests = new Map();
  const remove = (key, request) => {if (requests.get(key) === request) requests.delete(key);};
  const trim = () => {while (requests.size > maxEntries) requests.delete(requests.keys().next().value);};
  return {
    get(key, load) {
      const cached = requests.get(key);
      if (cached) return cached;
      let request;
      try {request = Promise.resolve(load());} catch (error) {return Promise.reject(error);}
      requests.set(key, request);
      trim();
      request.then(value => {if (!retain(value)) remove(key, request);}, () => remove(key, request));
      return request;
    },
    delete(key) {requests.delete(key);},
    clear() {requests.clear();},
    get size() {return requests.size;}
  };
}

export const mapVariantRequests = createRequestCache();

// The resolved value is only a short stash-map URL; the image bytes remain on
// disk. Retain successful lookups for instant reuse, but discard failures so a
// later visit can retry after the connection recovers.
export const mapImageCacheChecks = createRequestCache({retain: result => Boolean(result?.cached)});
