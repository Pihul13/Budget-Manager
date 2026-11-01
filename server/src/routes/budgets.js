import express from "express";
import Budget from "../models/Budget.js";

const router = express.Router();

router.get("/:month", async (req, res) => {
  try {
    res.json(await Budget.findOne({ month: req.params.month }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/:month", async (req, res) => {
  try {
    const budget = await Budget.findOneAndUpdate(
      { month: req.params.month },
      {
        month: req.params.month,
        totalLimit: Number(req.body.totalLimit || 0),
        categoryLimits: req.body.categoryLimits || [],
        subcategoryLimits: req.body.subcategoryLimits || [],
      },
      { new: true, upsert: true, runValidators: true },
    );
    res.json(budget);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
