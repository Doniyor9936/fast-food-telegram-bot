const { Markup } = require("telegraf");

function categoryKeyboard(categories) {
  const rows = [];
  for (let i = 0; i < categories.length; i += 2) {
    rows.push(categories.slice(i, i + 2).map(c => Markup.button.callback(`📂 ${c.name}`, `cat:${c._id}`)));
  }
  rows.push([Markup.button.callback("🔙 Bosh menyu", "main")]);
  return Markup.inlineKeyboard(rows);
}

function productKeyboard(products) {
  const rows = products.map(p => [
    Markup.button.callback(`${p.name} — ${Math.round(p.discountPrice ?? p.price).toLocaleString("uz-UZ")} so'm`, `product:${p._id}`)
  ]);
  rows.push([Markup.button.callback("🔙 Kategoriyalar", "menu")]);
  return Markup.inlineKeyboard(rows);
}

function productActions(productId, qty = 1) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("➖", `qty:${productId}:${qty}:dec`),
      Markup.button.callback(`${qty}`, `qty:${productId}:${qty}:show`),
      Markup.button.callback("➕", `qty:${productId}:${qty}:inc`)
    ],
    [Markup.button.callback("🛒 Savatga qo‘shish", `add:${productId}:${qty}`)],
    [Markup.button.callback("🔙 Orqaga", "menu")]
  ]);
}

module.exports = { categoryKeyboard, productKeyboard, productActions };
