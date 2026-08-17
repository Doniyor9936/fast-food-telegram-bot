const { Markup } = require("telegraf");

function mainKeyboard() {
  return Markup.keyboard([
    ["🍕 Menyu"],
    ["🛒 Savat", "📦 Buyurtmalarim"],
    ["❤️ Sevimlilar", "🔍 Qidirish"],
    ["📞 Aloqa", "ℹ️ Biz haqimizda"]
  ]).resize();
}

module.exports = { mainKeyboard };
