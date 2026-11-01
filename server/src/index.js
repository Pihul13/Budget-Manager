import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { clerkMiddleware, requireAuth } from "@clerk/express";
import accounts from "./routes/accounts.js";
import categories from "./routes/categories.js";
import transactions from "./routes/transactions.js";
import budgets from "./routes/budgets.js";
import goals from "./routes/goals.js";
import recurring from "./routes/recurring.js";
import stats from "./routes/stats.js";
import backup from "./routes/backup.js";
import settings from "./routes/settings.js";
import funds from "./routes/funds.js";
import Account from "./models/Account.js";
import Budget from "./models/Budget.js";
import Category from "./models/Category.js";
import Fund from "./models/Fund.js";
import RecurringRule from "./models/RecurringRule.js";
import SavingGoal from "./models/SavingGoal.js";
import Settings from "./models/Settings.js";
import Transaction from "./models/Transaction.js";
import { tenantScopeMiddleware } from "./lib/tenantScope.js";
import { processDuePaymentsForAllUsers } from "./services/creditCardAutoPay.js";

const app = express();
app.set("trust proxy", 1);
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
  }),
);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "https://*.clerk.accounts.dev",
          "https://*.clerk.com",
          "https://*.clerk.services",
          "https://challenges.cloudflare.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://*.clerk.accounts.dev",
          "https://*.clerk.com",
          "https://*.clerk.services",
          "wss://*.clerk.services",
          "https://challenges.cloudflare.com",
        ],
        frameSrc: [
          "'self'",
          "https://*.clerk.accounts.dev",
          "https://*.clerk.com",
          "https://*.clerk.services",
          "https://challenges.cloudflare.com",
        ],
        fontSrc: [
          "'self'",
          "data:",
          "https://*.clerk.accounts.dev",
          "https://*.clerk.com",
          "https://*.clerk.services",
        ],
        upgradeInsecureRequests: null,
      },
    },
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(clerkMiddleware());
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  requireAuth(),
  tenantScopeMiddleware,
);
app.use("/api/accounts", accounts);
app.use("/api/categories", categories);
app.use("/api/transactions", transactions);
app.use("/api/budgets", budgets);
app.use("/api/goals", goals);
app.use("/api/funds", funds);
app.use("/api/recurring", recurring);
app.use("/api/stats", stats);
app.use("/api/backup", backup);
app.use("/api/settings", settings);
app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

const port = Number(process.env.PORT || 5001);
const uri = process.env.MONGODB_URI;
const models = [
  Account,
  Budget,
  Category,
  Fund,
  RecurringRule,
  SavingGoal,
  Settings,
  Transaction,
];

async function dropLegacyIndexes() {
  for (const [Model, indexName] of [
    [Budget, "month_1"],
    [Settings, "key_1"],
    [Transaction, "autoPaymentKey_1"],
  ]) {
    try {
      await Model.collection.dropIndex(indexName);
    } catch (error) {
      if (![26, 27].includes(error.code)) throw error;
    }
  }
}

async function start() {
  if (!process.env.CLERK_SECRET_KEY || !process.env.CLERK_PUBLISHABLE_KEY) {
    throw new Error(
      "CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY must be configured.",
    );
  }
  if (!uri) {
    throw new Error("MONGODB_URI must be configured.");
  }

  await mongoose.connect(uri);
  await dropLegacyIndexes();
  await Promise.all(models.map((Model) => Model.init()));

  const clientDist = fileURLToPath(
    new URL("../../client/dist", import.meta.url),
  );
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    res.sendFile(resolve(clientDist, "index.html"), (error) => {
      if (error) next(error);
    });
  });
  app.use((error, req, res, next) => {
    console.error("Request failed:", error);
    if (res.headersSent) return next(error);
    return res
      .status(500)
      .json({ error: "An unexpected server error occurred." });
  });

  app.listen(port, () => {
    console.log(`Application running on port ${port}`);
  });
  processDuePaymentsForAllUsers().catch((error) =>
    console.error("Automatic credit-card payment failed:", error),
  );
  setInterval(
    () =>
      processDuePaymentsForAllUsers().catch((error) =>
        console.error("Automatic credit-card payment failed:", error),
      ),
    60 * 1000,
  );
}

start().catch((error) => {
  console.error("Application startup failed:", error);
  process.exit(1);
});
