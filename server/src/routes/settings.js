import express from "express";
import Settings from "../models/Settings.js";

const router = express.Router();

function settingsUpdates(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Settings must be an object.");
  }
  const updates = {};
  if (Object.hasOwn(body, "theme")) {
    if (!["light", "dark", "system"].includes(body.theme)) {
      throw new Error("Theme must be light, dark, or system.");
    }
    updates.theme = body.theme;
  }
  if (Object.hasOwn(body, "displayName")) {
    if (typeof body.displayName !== "string") {
      throw new Error("Display name must be text.");
    }
    const displayName = body.displayName.trim();
    if (!displayName || displayName.length > 40) {
      throw new Error("Display name must be between 1 and 40 characters.");
    }
    updates.displayName = displayName;
  }
  if (!Object.keys(updates).length) {
    throw new Error("No supported settings were provided.");
  }
  return updates;
}

router.get("/", async (req, res) => {
  try {
    res.json(
      await Settings.findOneAndUpdate(
        {},
        {},
        { new: true, upsert: true, setDefaultsOnInsert: true },
      ),
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/", async (req, res) => {
  try {
    res.json(
      await Settings.findOneAndUpdate(
        {},
        settingsUpdates(req.body),
        { new: true, upsert: true, runValidators: true },
      ),
    );
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
