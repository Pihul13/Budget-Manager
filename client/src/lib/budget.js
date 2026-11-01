export function budgetedCategorySpend(transactions, categories, categoryLimits) {
  const budgetedCategories = new Set(
    (categoryLimits || [])
      .filter((limit) => Number(limit.amount) > 0)
      .map((limit) => String(limit.categoryId?._id || limit.categoryId)),
  );
  const categoriesById = new Map(
    categories.map((category) => [String(category._id), category]),
  );
  const spend = {};

  for (const transaction of transactions) {
    if (transaction.type !== "expense") continue;
    const categoryId =
      transaction.subcategoryId?._id ||
      transaction.subcategoryId ||
      transaction.categoryId?._id ||
      transaction.categoryId;
    if (!categoryId) continue;

    const category = categoriesById.get(String(categoryId));
    if (!category) continue;
    const parentId = category.parentId?._id || category.parentId || category._id;
    if (!budgetedCategories.has(String(parentId))) continue;

    const key = String(categoryId);
    spend[key] = (spend[key] || 0) + transaction.amount;
  }

  return spend;
}
