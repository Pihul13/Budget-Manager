import assert from "node:assert/strict";
import test from "node:test";
import { clearRequestCache, getCached } from "./requestCache.js";

function makeIndexedDb(records) {
  const database = {
    createObjectStore() {},
    transaction() {
      const transaction = {
        objectStore() {
          return {
            get(key) {
              const request = {};
              queueMicrotask(() => {
                request.result = records.get(key);
                request.onsuccess?.();
              });
              return request;
            },
            put(entry) {
              records.set(entry.key, entry);
            },
            clear() {
              records.clear();
            },
          };
        },
      };
      queueMicrotask(() => transaction.oncomplete?.());
      return transaction;
    },
  };
  return {
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = database;
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
}

test("reuses successful GET results until their cache expires", async () => {
  clearRequestCache();
  let loads = 0;
  const load = async () => ({ count: ++loads });

  assert.deepEqual(await getCached("accounts", load), { count: 1 });
  assert.deepEqual(await getCached("accounts", load), { count: 1 });
  assert.equal(loads, 1);
});

test("deduplicates concurrent requests for the same key", async () => {
  clearRequestCache();
  let loads = 0;
  let finish;
  const load = () => {
    loads++;
    return new Promise((resolve) => {
      finish = resolve;
    });
  };

  const first = getCached("categories", load);
  const second = getCached("categories", load);
  await Promise.resolve();
  finish(["expense"]);

  assert.deepEqual(await Promise.all([first, second]), [
    ["expense"],
    ["expense"],
  ]);
  assert.equal(loads, 1);
});

test("clearing prevents older in-flight requests repopulating the cache", async () => {
  clearRequestCache();
  let finish;
  let loads = 0;
  const load = () => {
    loads++;
    return new Promise((resolve) => {
      finish = resolve;
    });
  };

  const oldRequest = getCached("funds", load);
  await Promise.resolve();
  clearRequestCache();
  finish(["stale"]);
  await oldRequest;

  assert.deepEqual(await getCached("funds", async () => ["fresh"]), ["fresh"]);
  assert.equal(loads, 1);
});

test("expires cached values", async () => {
  clearRequestCache();
  let loads = 0;
  const load = async () => ++loads;

  assert.equal(await getCached("stats", load, 0), 1);
  assert.equal(await getCached("stats", load, 0), 1);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(await getCached("stats", load, 0), 2);
});

test("reuses IndexedDB data after a page reload and revalidates stale data", async (t) => {
  const previousIndexedDb = globalThis.indexedDB;
  const records = new Map();
  globalThis.indexedDB = makeIndexedDb(records);
  t.after(() => {
    if (previousIndexedDb) globalThis.indexedDB = previousIndexedDb;
    else delete globalThis.indexedDB;
  });

  const firstModule = await import(`./requestCache.js?initial=${Date.now()}`);
  await firstModule.getCached("user-1:/api/accounts", async () => ["saved"]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  records.get("user-1:/api/accounts").expiresAt = 0;

  const reloadedModule = await import(`./requestCache.js?reload=${Date.now()}`);
  let finishRefresh;
  const result = await reloadedModule.getCached(
    "user-1:/api/accounts",
    () =>
      new Promise((resolve) => {
        finishRefresh = resolve;
      }),
    0,
  );
  assert.deepEqual(result, ["saved"]);

  finishRefresh(["updated"]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(
    await reloadedModule.getCached("user-1:/api/accounts", async () => ["miss"]),
    ["updated"],
  );
});

test("clears persisted data when the user cache is cleared", async (t) => {
  const previousIndexedDb = globalThis.indexedDB;
  const records = new Map();
  globalThis.indexedDB = makeIndexedDb(records);
  t.after(() => {
    if (previousIndexedDb) globalThis.indexedDB = previousIndexedDb;
    else delete globalThis.indexedDB;
  });

  const cacheModule = await import(`./requestCache.js?clear=${Date.now()}`);
  await cacheModule.getCached("user-1:/api/accounts", async () => ["private"]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(records.size, 1);

  cacheModule.clearRequestCache();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(records.size, 0);
});
