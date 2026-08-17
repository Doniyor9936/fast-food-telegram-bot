const { Markup } = require("telegraf");
const Order = require("../../models/Order");
const { money } = require("../../utils/price");
const { changeOrderStatus } = require("../../services/order.service");

/* =========================================================
   MIJOZ — "Buyurtmalarim"  (o'zgarmagan)
========================================================= */

async function myOrders(ctx, user) {
  const orders = await Order.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20).lean();
  if (!orders.length) return ctx.reply("📦 Sizda hali buyurtmalar yo‘q.");

  const status = {
    NEW: "🆕 Yangi",
    ACCEPTED: "✅ Qabul qilindi",
    PREPARING: "👨‍🍳 Tayyorlanmoqda",
    READY: "📦 Tayyor",
    COURIER_ASSIGNED: "🛵 Kuryer biriktirilgan",
    ON_THE_WAY: "🛵 Yo‘lda",
    DELIVERED: "🎉 Yetkazildi",
    COMPLETED: "✅ Yakunlandi",
    CANCELLED: "❌ Bekor qilindi"
  };

  const text = orders.map(o =>
    `${o.orderNumber}\n${status[o.status]}\n💰 ${money(o.total)}\n📅 ${new Date(o.createdAt).toLocaleString("uz-UZ")}`
  ).join("\n\n");

  return ctx.reply(`📦 BUYURTMALARIM\n\n${text}`);
}

/* =========================================================
   ADMIN / OPERATOR — buyurtmalarni boshqarish
   (TZ bo'lim 24-25: ro'yxat, filtr, batafsil ko'rish,
   statusni o'zgartirish)
========================================================= */

const STATUS_LABELS = {
  NEW: "🆕 Yangi",
  ACCEPTED: "✅ Qabul qilindi",
  PREPARING: "👨‍🍳 Tayyorlanmoqda",
  READY: "📦 Tayyor",
  COURIER_ASSIGNED: "🛵 Kuryer biriktirilgan",
  ON_THE_WAY: "🛵 Yo‘lda",
  DELIVERED: "🎉 Yetkazildi",
  COMPLETED: "✅ Yakunlandi",
  CANCELLED: "❌ Bekor qilindi"
};

// order.service.js'dagi changeOrderStatus ICHIDAGI "allowed"
// jadvali bilan bir xil bo'lishi SHART — aks holda admin
// tugma bosadi-yu, servis "status o'zgartirilmaydi" deb
// xato qaytaradi.
//
// COURIER_ASSIGNED va ON_THE_WAY ga CANCELLED qo'shildi —
// kuryer manzilga borib, mijoz qabul qilmasa yoki buyurtma
// qaytib kelsa, adminda "Bekor qilish" tugmasi chiqishi uchun.
const STATUS_TRANSITIONS = {
  NEW: [["ACCEPTED", "✅ Qabul qilish"], ["CANCELLED", "❌ Bekor qilish"]],
  ACCEPTED: [["PREPARING", "👨‍🍳 Tayyorlashni boshlash"], ["CANCELLED", "❌ Bekor qilish"]],
  PREPARING: [["READY", "📦 Tayyor bo‘ldi"], ["CANCELLED", "❌ Bekor qilish"]],
  READY: [
    ["COURIER_ASSIGNED", "🛵 Kuryerga berish"],
    ["ON_THE_WAY", "🛵 Yo‘lga chiqdi"],
    ["COMPLETED", "🏪 Olib ketildi (yakunlash)"]
  ],
  COURIER_ASSIGNED: [
    ["ON_THE_WAY", "🛵 Yo‘lga chiqdi"],
    ["CANCELLED", "❌ Bekor qilish"]
  ],
  ON_THE_WAY: [
    ["DELIVERED", "🎉 Yetkazildi"],
    ["CANCELLED", "🔄 Qaytdi / Bekor qilish"]
  ],
  DELIVERED: [["COMPLETED", "✅ Yakunlash"]],
  COMPLETED: [],
  CANCELLED: []
};

// Statusni o'zgartirganda mijozga yuboriladigan xabar
const CUSTOMER_STATUS_MESSAGES = {
  ACCEPTED: orderNumber => `✅ Buyurtmangiz qabul qilindi!\n\n📦 #${orderNumber}\n\nTez orada tayyorlashni boshlaymiz.`,
  PREPARING: orderNumber => `👨‍🍳 Buyurtmangiz tayyorlanmoqda!\n\n📦 #${orderNumber}`,
  READY: orderNumber => `📦 Buyurtmangiz tayyor bo‘ldi!\n\n📦 #${orderNumber}`,
  COURIER_ASSIGNED: orderNumber => `🛵 Kuryer biriktirildi.\n\n📦 #${orderNumber}\n\nTez orada yo‘lga chiqadi.`,
  ON_THE_WAY: orderNumber => `🛵 Buyurtmangiz yo‘lga chiqdi!\n\n📦 #${orderNumber}`,
  DELIVERED: () => `🎉 Buyurtmangiz yetkazildi!\n\nBizni tanlaganingiz uchun rahmat ❤️`,
  COMPLETED: () => `✅ Buyurtmangiz yakunlandi!\n\nRahmat!`,
  CANCELLED: orderNumber => `❌ Buyurtmangiz bekor qilindi.\n\n📦 #${orderNumber}\n\nSavol bo‘lsa operator bilan bog‘laning.`
};

const PAGE_SIZE = 8;

function isStaff(ctx) {
  return ["admin", "operator"].includes(ctx.state.user?.role);
}

function buildFilterQuery(filter) {
  if (!filter || filter === "ALL") return {};
  if (filter === "ACTIVE") {
    return { status: { $nin: ["COMPLETED", "CANCELLED", "DELIVERED"] } };
  }
  return { status: filter };
}

const FILTERS = [
  ["ACTIVE", "🔥 Jarayonda"],
  ["NEW", "🆕 Yangi"],
  ["DELIVERED", "🎉 Yetkazilgan"],
  ["CANCELLED", "❌ Bekor"],
  ["ALL", "📋 Barchasi"]
];

// Filtr tugmalarini 2 tadan qatorga bo'lib qaytaradi —
// 4-5 tasi bitta qatorga sig'may, matn kesilib qolar edi.
// Natija: massivlar massivi (bir nechta qator).
function filterRows(activeFilter) {
  const buttons = FILTERS
    .filter(([key]) => key !== activeFilter)
    .map(([key, label]) => Markup.button.callback(label, `admorders:${key}:1`));

  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  return rows;
}

// Buyurtma raqamini qisqartiradi (masalan "LAVA-20260815-0042"
// dan faqat oxirgi qismini "0042" ko'rsatadi) — tugma matni
// ekran kengligiga sig'ishi uchun.
function shortOrderNumber(orderNumber) {
  const parts = String(orderNumber).split("-");
  return parts[parts.length - 1];
}

// Mijoz ismini qisqartiradi — tugma matni uzun bo'lib
// ketmasligi va "..." bilan kesilmasligi uchun.
function shortName(name, max = 10) {
  if (!name) return "Mijoz";
  return name.length > max ? name.slice(0, max) + "…" : name;
}

/**
 * Buyurtmalar ro'yxati — filtr va sahifalash bilan.
 * bot.js: bot.hears("📦 Buyurtmalar", ...) va
 * bot.action(/^admorders:(\w+):(\d+)$/, ...) shu funksiyani chaqiradi.
 */
async function adminOrders(ctx, filter = "ACTIVE", page = 1) {
  if (!isStaff(ctx)) {
    return ctx.answerCbQuery
      ? ctx.answerCbQuery("❌ Sizda bu bo‘limga ruxsat yo‘q.", { show_alert: true })
      : ctx.reply("❌ Sizda bu bo‘limga ruxsat yo‘q.");
  }

  const query = buildFilterQuery(filter);
  const skip = (page - 1) * PAGE_SIZE;

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate("userId", "firstName lastName username phone telegramId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(PAGE_SIZE)
      .lean(),
    Order.countDocuments(query)
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filterLabel = (FILTERS.find(([key]) => key === filter) || [null, "Barchasi"])[1];

  if (!orders.length) {
    const emptyText = `📦 BUYURTMALAR — ${filterLabel}\n\nBu bo‘limda buyurtmalar topilmadi.`;
    const emptyKeyboard = Markup.inlineKeyboard(filterRows(filter));
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
      return ctx.editMessageText(emptyText, emptyKeyboard).catch(() => ctx.reply(emptyText, emptyKeyboard));
    }
    return ctx.reply(emptyText, emptyKeyboard);
  }

  const rows = orders.map(o => {
    const customerName = shortName(o.userId?.firstName || o.userId?.username);
    const amount = Number(o.total).toLocaleString("uz-UZ");
    return [
      Markup.button.callback(
        `${STATUS_LABELS[o.status] || o.status} #${shortOrderNumber(o.orderNumber)} · ${customerName} · ${amount}`,
        `admorder:${o._id}`
      )
    ];
  });

  const navRow = [];
  if (page > 1) navRow.push(Markup.button.callback("⬅️ Oldingi", `admorders:${filter}:${page - 1}`));
  if (page < totalPages) navRow.push(Markup.button.callback("Keyingi ➡️", `admorders:${filter}:${page + 1}`));
  if (navRow.length) rows.push(navRow);

  rows.push(...filterRows(filter));

  const text = `📦 BUYURTMALAR — ${filterLabel}\n\nJami: ${total} ta · Sahifa ${page}/${totalPages}\n\nKo‘rish uchun buyurtmani tanlang:`;
  const keyboard = Markup.inlineKeyboard(rows);

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
    return ctx.editMessageText(text, keyboard).catch(() => ctx.reply(text, keyboard));
  }
  return ctx.reply(text, keyboard);
}

/**
 * Bitta buyurtmani batafsil ko'rsatish + status o'zgartirish
 * tugmalari.
 * bot.js: bot.action(/^admorder:(.+)$/, ...) shu funksiyani chaqiradi.
 */
async function viewOrderAdmin(ctx, orderId) {
  if (!isStaff(ctx)) {
    return ctx.answerCbQuery("❌ Sizda bu bo‘limga ruxsat yo‘q.", { show_alert: true });
  }

  const order = await Order.findById(orderId)
    .populate("userId", "firstName lastName username phone telegramId")
    .lean();

  if (!order) {
    return ctx.answerCbQuery("❌ Buyurtma topilmadi.", { show_alert: true });
  }

  const user = order.userId;
  const customerName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "Noma'lum mijoz";

  const itemsText = order.items
    .map(i => `• ${i.name}${i.variant ? ` (${i.variant.name})` : ""} x${i.quantity} — ${money(i.totalPrice)}`)
    .join("\n");

  const addressText =
    order.deliveryType === "pickup"
      ? "🏪 Olib ketish"
      : `🛵 Yetkazib berish\n📍 ${order.address?.address ||
      (order.location?.latitude ? `${order.location.latitude}, ${order.location.longitude}` : "manzil ko‘rsatilmagan")
      }`;

  const lines = [
    `📦 #${order.orderNumber}`,
    "",
    `👤 ${customerName}`,
    `📱 ${user?.phone || "—"}`,
    "",
    itemsText,
    "",
    `Mahsulotlar: ${money(order.subtotal)}`,
    `Yetkazib berish: ${money(order.deliveryFee)}`
  ];

  if (order.discount) lines.push(`Chegirma: -${money(order.discount)}`);

  lines.push(
    `💰 Jami: ${money(order.total)}`,
    "",
    `💳 To‘lov: ${order.paymentMethod} (${order.paymentStatus})`,
    addressText
  );

  if (order.comment) lines.push(`📝 Izoh: ${order.comment}`);

  lines.push(
    "",
    `📌 Status: ${STATUS_LABELS[order.status] || order.status}`,
    `📅 ${new Date(order.createdAt).toLocaleString("uz-UZ")}`
  );

  const text = lines.join("\n");

  const statusButtons = (STATUS_TRANSITIONS[order.status] || []).map(([status, label]) => [
    Markup.button.callback(label, `admstatus:${order._id}:${status}`)
  ]);
  statusButtons.push([Markup.button.callback("🔙 Ro‘yxatga qaytish", "admorders:ACTIVE:1")]);

  const keyboard = Markup.inlineKeyboard(statusButtons);

  await ctx.answerCbQuery();
  return ctx.editMessageText(text, keyboard).catch(() => ctx.reply(text, keyboard));
}

/**
 * Buyurtma statusini o'zgartirish + mijozga avtomatik xabar.
 * bot.js: bot.action(/^admstatus:(.+):(\w+)$/, ...) shu
 * funksiyani chaqiradi va `bot` instansini uzatadi (mijozga
 * xabar yuborish uchun kerak).
 */
async function changeOrderStatusAdmin(ctx, orderId, newStatus, bot) {
  if (!isStaff(ctx)) {
    return ctx.answerCbQuery("❌ Sizda bu bo‘limga ruxsat yo‘q.", { show_alert: true });
  }

  try {
    const updatedOrder = await changeOrderStatus(
      orderId,
      newStatus,
      ctx.state.user._id,
      `${ctx.state.user.role} (${ctx.state.user.firstName || ctx.state.user.telegramId}) tomonidan`
    );

    await ctx.answerCbQuery("✅ Status yangilandi");

    // Mijozga xabar yuborish — bu ichki admin oqimini
    // to'xtatmasligi kerak, shuning uchun alohida try/catch.
    try {
      const withUser = await Order.findById(orderId).populate("userId", "telegramId").lean();
      const customerTelegramId = withUser?.userId?.telegramId;
      const buildMessage = CUSTOMER_STATUS_MESSAGES[newStatus];

      if (customerTelegramId && buildMessage) {
        await bot.telegram.sendMessage(customerTelegramId, buildMessage(updatedOrder.orderNumber));
      }
    } catch (notifyError) {
      console.error("❌ Mijozga status xabari yuborilmadi:", notifyError.message);
    }

    return viewOrderAdmin(ctx, orderId);
  } catch (error) {
    console.error("❌ Status change error:", error);
    return ctx.answerCbQuery(error.message || "❌ Statusni o‘zgartirib bo‘lmadi.", { show_alert: true });
  }
}

module.exports = {
  myOrders,
  adminOrders,
  viewOrderAdmin,
  changeOrderStatusAdmin
};