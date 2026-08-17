const { getCartDetailed, clearCart, changeQuantity } = require("../../services/cart.service");
const { cartKeyboard } = require("../keyboards/cart.keyboard");
const { money } = require("../../utils/price");

async function renderCart(ctx, user) {
  const cart = await getCartDetailed(user._id);
  if (!cart.items.length) return ctx.reply("🛒 Savatingiz bo‘sh.", cartKeyboard());

  const lines = ["🛒 SAVAT", ""];
  cart.items.forEach((i, index) => {
    lines.push(`${index + 1}. ${i.product.name} x${i.quantity} — ${money(i.totalPrice)}`);
  });
  lines.push("", `💰 Jami: ${money(cart.subtotal)}`);

  return ctx.reply(lines.join("\n"), cartKeyboard());
}

async function clearUserCart(ctx, user) {
  await clearCart(user._id);
  return ctx.reply("🗑 Savat tozalandi.");
}

module.exports = { renderCart, clearUserCart };
