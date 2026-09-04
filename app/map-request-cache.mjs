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

// Cached images are base64 data URLs and can be tens of megabytes. Keep only
// negative cache checks; successful checks are shared while in flight and then
// released so navigating across maps does not retain every high-resolution image.
export const mapImageCacheChecks = createRequestCache({retain: result => !result?.cached});
