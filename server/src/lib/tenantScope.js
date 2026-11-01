import { AsyncLocalStorage } from "node:async_hooks";
import { getAuth } from "@clerk/express";

const tenantStorage = new AsyncLocalStorage();

export function withTenantScope(userId, callback) {
  if (typeof userId !== "string" || !userId) {
    throw new Error("A valid user scope is required.");
  }
  return tenantStorage.run(userId, callback);
}

export function currentUserId() {
  const userId = tenantStorage.getStore();
  if (!userId) {
    throw new Error("Database access requires an authenticated user scope.");
  }
  return userId;
}

function removeUserIdFromUpdate(update) {
  if (!update || typeof update !== "object") return;
  if (Array.isArray(update)) {
    throw new Error("Aggregation-pipeline updates are not supported.");
  }
  for (const [path, value] of Object.entries(update)) {
    if (
      path === "userId" ||
      path.startsWith("userId.") ||
      (path === "$rename" &&
        value &&
        typeof value === "object" &&
        Object.values(value).includes("userId"))
    ) {
      delete update[path];
      continue;
    }
    if (path.startsWith("$") && value && typeof value === "object") {
      for (const updatePath of Object.keys(value)) {
        if (updatePath === "userId" || updatePath.startsWith("userId.")) {
          delete value[updatePath];
        }
      }
    }
  }
}

export function tenantPlugin(schema) {
  schema.add({
    userId: {
      type: String,
      required: true,
      select: false,
    },
  });

  schema.pre("validate", function setTenantOnDocument() {
    this.userId = currentUserId();
  });

  schema.pre("insertMany", function setTenantOnInsertedDocuments(next, documents) {
    try {
      const userId = currentUserId();
      for (const document of documents) document.userId = userId;
      next();
    } catch (error) {
      next(error);
    }
  });

  for (const operation of [
    "countDocuments",
    "deleteMany",
    "deleteOne",
    "find",
    "findOne",
    "findOneAndDelete",
    "findOneAndReplace",
    "findOneAndUpdate",
    "replaceOne",
    "updateMany",
    "updateOne",
  ]) {
    schema.pre(operation, function scopeQuery() {
      const userId = currentUserId();
      this.setQuery({ $and: [this.getQuery(), { userId }] });
      const update = this.getUpdate();
      if (
        operation.includes("Update") ||
        operation.includes("Replace") ||
        operation.startsWith("update")
      ) {
        removeUserIdFromUpdate(update);
        if (this.getOptions().upsert) {
          this.setUpdate(
            operation.includes("Replace")
              ? { ...update, userId }
              : {
                  ...update,
                  $setOnInsert: {
                    ...(update?.$setOnInsert || {}),
                    userId,
                  },
                },
          );
        }
      }
    });
  }
}

export function tenantScopeMiddleware(req, res, next) {
  const userId = getAuth(req).userId;
  if (!userId) {
    return res.status(401).json({ error: "Authentication is required." });
  }
  return withTenantScope(userId, next);
}
