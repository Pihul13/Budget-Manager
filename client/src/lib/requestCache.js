const cache = new Map();
const inFlight = new Map();
let generation = 0;

export function getCached(key, load, ttlMs = 30_000) {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.value);
  }

  const pending = inFlight.get(key);
  if (pending) return pending;

  const requestGeneration = generation;
  const promise = Promise.resolve()
    .then(load)
    .then((value) => {
      if (requestGeneration === generation) {
        cache.set(key, { value, expiresAt: Date.now() + ttlMs });
      }
      return value;
    })
    .finally(() => {
      if (inFlight.get(key) === promise) inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

export function clearRequestCache() {
  generation++;
  cache.clear();
  inFlight.clear();
}
