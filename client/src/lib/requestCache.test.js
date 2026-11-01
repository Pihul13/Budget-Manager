import assert from "node:assert/strict";
import test from "node:test";
import { clearRequestCache, getCached } from "./requestCache.js";

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
  assert.equal(await getCached("stats", load, 0), 2);
});
