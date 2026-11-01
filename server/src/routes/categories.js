import express from "express";
import Category from "../models/Category.js";
import Transaction from "../models/Transaction.js";

const router = express.Router();

const normalizeCategoryInput = (body) => ({
  ...body,
  ...(body.parentId === "" ? { parentId: null } : {}),
});

router.get("/", async (req, res) => {
  try {
    const categories = await Category.find({ archived: false })
      .sort({ type: 1, createdAt: 1 })
      .lean();
    res.json(categories);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/", async (req, res) => {
  try {
    res
      .status(201)
      .json(await Category.create(normalizeCategoryInput(req.body)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    res.json(
      await Category.findByIdAndUpdate(
        req.params.id,
        normalizeCategoryInput(req.body),
        {
          new: true,
          runValidators: true,
        },
      ),
    );
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const count = await Transaction.countDocuments({
      $or: [{ categoryId: req.params.id }, { subcategoryId: req.params.id }],
    });
    if (count > 0)
      return res
        .status(409)
        .json({
          error: "Category is used by transactions. Archive it instead.",
        });
    await Category.findByIdAndDelete(req.params.id);
    await Category.deleteMany({ parentId: req.params.id });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
