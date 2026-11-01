const CACHE_TTL_MS = 30_000;
const MAX_STALE_MS = 30 * 24 * 60 * 60 * 1000;
const DATABASE_NAME = "personal-finance-cache";
const STORE_NAME = "responses";
const REFRESH_EVENT = "private-data-cache-refreshed";
const REFRESH_ERROR_EVENT = "private-data-cache-refresh-failed";

const cache = new Map();
const inFlight = new Map();
const revalidating = new Map();
let generation = 0;
let databasePromise;
const refreshTimers = new Map();
let warnedUnavailable = false;

function openDatabase() {
  if (!globalThis.indexedDB) {
    if (!warnedUnavailable) {
      console.warn("IndexedDB is unavailable; finance data will not persist in this browser.");
      warnedUnavailable = true;
    }
    return Promise.resolve(null);
  }
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("The finance cache database is blocked."));
    }).catch((error) => {
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise;
}

async function readPersisted(key) {
  const database = await openDatabase();
  if (!database) return null;
  return new Promise((resolve, reject) => {
    const request = database
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function writePersisted(entry, currentGeneration) {
  const database = await openDatabase();
  if (!database || currentGeneration !== generation) return;
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(entry);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function clearPersisted() {
  const database = await openDatabase();
  if (!database) return;
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function notifyRefresh(eventName, detail) {
  if (typeof window === "undefined") return;
  clearTimeout(refreshTimers.get(eventName));
  const timer = setTimeout(() => {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }, 150);
  refreshTimers.set(eventName, timer);
}

function reportPersistenceError(error) {
  console.error("Could not persist the private finance cache.", error);
}

function storeValue(key, value, ttlMs, currentGeneration) {
  const entry = {
    key,
    value,
    updatedAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  };
  cache.set(key, entry);
  if (currentGeneration === generation) {
    writePersisted(entry, currentGeneration).catch(reportPersistenceError);
  }
}

function revalidate(key, load, ttlMs) {
  if (revalidating.has(key)) return revalidating.get(key);
  const currentGeneration = generation;
  const request = Promise.resolve()
    .then(load)
    .then((value) => {
      if (currentGeneration === generation) {
        storeValue(key, value, ttlMs, currentGeneration);
        notifyRefresh(REFRESH_EVENT);
      }
      return value;
    })
    .catch((error) => {
      console.error("Could not refresh cached finance data.", error);
      notifyRefresh(REFRESH_ERROR_EVENT, {
        message: error?.message || "Could not refresh saved data.",
      });
      throw error;
    })
    .finally(() => {
      if (revalidating.get(key) === request) revalidating.delete(key);
    });
  revalidating.set(key, request);
  return request;
}

export async function getCached(key, load, ttlMs = CACHE_TTL_MS) {
  const memoryEntry = cache.get(key);
  if (memoryEntry) {
    if (memoryEntry.expiresAt > Date.now()) return memoryEntry.value;
    revalidate(key, load, ttlMs).catch(() => {});
    return memoryEntry.value;
  }

  const pendingRequest = inFlight.get(key);
  if (pendingRequest) return pendingRequest;

  const currentGeneration = generation;
  const request = (async () => {
    let persistedEntry;
    if (globalThis.indexedDB) {
      try {
        persistedEntry = await readPersisted(key);
      } catch (error) {
        reportPersistenceError(error);
      }
    }
    if (currentGeneration !== generation) {
      throw new Error("The finance cache was cleared while loading.");
    }

    if (
      persistedEntry &&
      Date.now() - persistedEntry.updatedAt < MAX_STALE_MS
    ) {
      cache.set(key, persistedEntry);
      if (persistedEntry.expiresAt <= Date.now()) {
        revalidate(key, load, ttlMs).catch(() => {});
      }
      return persistedEntry.value;
    }

    try {
      const value = await load();
      if (currentGeneration === generation) {
        storeValue(key, value, ttlMs, currentGeneration);
      }
      return value;
    } catch (error) {
      notifyRefresh(REFRESH_ERROR_EVENT, {
        message: error?.message || "Could not load finance data.",
      });
      throw error;
    }
  })().finally(() => {
    if (inFlight.get(key) === request) inFlight.delete(key);
  });
  inFlight.set(key, request);
  return request;
}

export function clearRequestCache() {
  generation += 1;
  cache.clear();
  inFlight.clear();
  revalidating.clear();
  if (globalThis.indexedDB) {
    clearPersisted().catch(reportPersistenceError);
  }
}

export { REFRESH_EVENT, REFRESH_ERROR_EVENT };
