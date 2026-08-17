const { Markup } = require("telegraf");

function cartKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("➕ Mahsulot qo‘shish", "menu")],
    [Markup.button.callback("🗑 Savatni tozalash", "cart:clear")],
    [Markup.button.callback("✅ Buyurtma berish", "checkout")],
    [Markup.button.callback("🔙 Bosh menyu", "main")]
  ]);
}

function confirmKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("✅ Buyurtmani tasdiqlash", "checkout:confirm")],
    [Markup.button.callback("✏️ O‘zgartirish", "cart")],
    [Markup.button.callback("❌ Bekor qilish", "checkout:cancel")]
  ]);
}

function paymentKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("💵 Naqd", "payment:cash")],
    [Markup.button.callback("💳 Karta", "payment:card")],
    [Markup.button.callback("💳 Online to‘lov", "payment:online")]
  ]);
}

function deliveryKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🛵 Yetkazib berish", "delivery:delivery")],
    [Markup.button.callback("🏪 O‘zim olib ketaman", "delivery:pickup")]
  ]);
}

module.exports = { cartKeyboard, confirmKeyboard, paymentKeyboard, deliveryKeyboard };
