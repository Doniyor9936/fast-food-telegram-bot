const Category = require("../../models/Category");
const Product = require("../../models/Product");
const { categoryKeyboard, productKeyboard, productActions } = require("../keyboards/menu.keyboard");
const { money } = require("../../utils/price");

async function showMenu(ctx) {
  const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
  if (!categories.length) return ctx.reply("📂 Hozircha menyu mavjud emas.");
  return ctx.reply("🍕 Kategoriyani tanlang:", categoryKeyboard(categories));
}

async function showCategory(ctx, categoryId) {
  const products = await Product.find({
    categoryId,
    isActive: true,
    isAvailable: true
  }).sort({ sortOrder: 1, name: 1 }).lean();

  if (!products.length) return ctx.answerCbQuery("Bu kategoriyada mahsulot yo‘q.");
  return ctx.editMessageText("🍕 Mahsulotni tanlang:", productKeyboard(products));
}

async function showProduct(ctx, productId) {
  const product = await Product.findOne({ _id: productId, isActive: true }).lean();
  if (!product) return ctx.answerCbQuery("Mahsulot topilmadi.");

  const price = product.discountPrice ?? product.price;
  const text = [
    `${product.name}`,
    "",
    product.description || "Mazali fast-food mahsuloti.",
    "",
    `💰 Narx: ${money(price)}`,
    product.discountPrice ? `🔥 Chegirma: ${money(product.price - product.discountPrice)}` : "",
    product.isAvailable ? "🟢 Mavjud" : "🔴 Hozircha mavjud emas"
  ].filter(Boolean).join("\n");

  const extra = product.image
    ? { ...productActions(product._id), caption: text }
    : productActions(product._id);

  if (product.image) {
    try {
      return ctx.editMessageMedia({ type: "photo", media: product.image, caption: text }, productActions(product._id));
    } catch {
      return ctx.editMessageText(text, productActions(product._id));
    }
  }
  return ctx.editMessageText(text, extra);
}

module.exports = {
  showMenu,
  showCategory,
  showProduct,
};

