const { safeSend } = require("../utils/telegram");
const { money } = require("../utils/price");
const { adminChatId } = require("../config/env");

const statusText = {
  NEW: "🆕 Yangi buyurtma",
  ACCEPTED: "✅ Buyurtma qabul qilindi",
  PREPARING: "👨‍🍳 Buyurtma tayyorlanmoqda",
  READY: "📦 Buyurtma tayyor",
  COURIER_ASSIGNED: "🛵 Kuryer biriktirildi",
  ON_THE_WAY: "🛵 Buyurtma yo‘lda",
  DELIVERED: "🎉 Buyurtma yetkazildi",
  COMPLETED: "✅ Buyurtma yakunlandi",
  CANCELLED: "❌ Buyurtma bekor qilindi"
};

function orderText(order, user) {
  const lines = [`📦 ${order.orderNumber}`, "", `👤 ${user?.firstName || ""} ${user?.lastName || ""}`.trim()];
  if (user?.phone) lines.push(`📱 ${user.phone}`);
  lines.push("");
  for (const item of order.items) {
    lines.push(`• ${item.name} x${item.quantity} — ${money(item.totalPrice)}`);
  }
  lines.push("", `Mahsulotlar: ${money(order.subtotal)}`);
  lines.push(`Yetkazib berish: ${money(order.deliveryFee)}`);
  if (order.discount) lines.push(`Chegirma: -${money(order.discount)}`);
  lines.push(`💰 Jami: ${money(order.total)}`);
  lines.push(`💳 To‘lov: ${order.paymentMethod}`);
  if (order.deliveryType === "delivery" && order.address?.address) lines.push(`📍 ${order.address.address}`);
  return lines.join("\n");
}

async function notifyAdmin(bot, order, user) {
  if (!adminChatId) return;
  await safeSend(bot, adminChatId, `🔔 YANGI BUYURTMA\n\n${orderText(order, user)}`);
}

async function notifyCustomer(bot, telegramId, order) {
  await safeSend(bot, telegramId, `${statusText[order.status]}\n\nBuyurtma: ${order.orderNumber}\n💰 ${money(order.total)}`);
}

module.exports = { orderText, notifyAdmin, notifyCustomer };
