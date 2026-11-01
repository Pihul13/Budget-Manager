import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { tenantPlugin, withTenantScope } from "./tenantScope.js";

const schema = new mongoose.Schema(
  { name: String },
  { bufferCommands: false },
);
schema.plugin(tenantPlugin);
const ScopedDocument = mongoose.model("TenantScopeTestDocument", schema);

test("documents always receive the authenticated owner", async () => {
  const document = new ScopedDocument({
    name: "private",
    userId: "another-user",
  });

  await withTenantScope("user-a", () => document.validate());

  assert.equal(document.userId, "user-a");
});

test("reads are restricted to the authenticated owner", async () => {
  const query = ScopedDocument.findOne({ name: "private" });

  await assert.rejects(withTenantScope("user-a", () => query.exec()));

  assert.deepEqual(query.getFilter(), {
    $and: [{ name: "private" }, { userId: "user-a" }],
  });
});

test("updates cannot change ownership and upserts retain the owner", async () => {
  const query = ScopedDocument.findOneAndUpdate(
    { name: "before" },
    { $set: { name: "after", userId: "another-user" } },
    { upsert: true },
  );

  await assert.rejects(withTenantScope("user-a", () => query.exec()));

  assert.deepEqual(query.getFilter(), {
    $and: [{ name: "before" }, { userId: "user-a" }],
  });
  assert.equal(query.getUpdate().$set.userId, undefined);
  assert.equal(query.getUpdate().$setOnInsert.userId, "user-a");
});

test("bulk inserts cannot assign records to a different owner", async () => {
  const originalInsertMany = ScopedDocument.collection.insertMany;
  ScopedDocument.collection.insertMany = async (documents) => ({ documents });

  try {
    const [document] = await withTenantScope("user-a", () =>
      ScopedDocument.insertMany([
        { name: "private", userId: "another-user" },
      ]),
    );
    assert.equal(document.userId, "user-a");
  } finally {
    ScopedDocument.collection.insertMany = originalInsertMany;
  }
});

test("database queries fail closed without an authenticated owner", async () => {
  const query = ScopedDocument.findOne({ name: "private" });

  await assert.rejects(
    query.exec(),
    /Database access requires an authenticated user scope/,
  );
});
