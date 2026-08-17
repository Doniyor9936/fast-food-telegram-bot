const User = require("../../models/User");
const { getState, setState, clearState } = require("../state");
const { deliveryKeyboard, paymentKeyboard, confirmKeyboard } = require("../keyboards/cart.keyboard");
const { getCartDetailed } = require("../../services/cart.service");
const { createOrder } = require("../../services/order.service");
const { money } = require("../../utils/price");
const { notifyAdmin } = require("../../services/notification.service");
const { createOnlinePayment } = require("../../services/payment.service");

async function startCheckout(ctx, user) {
  const cart = await getCartDetailed(user._id);
  if (!cart.items.length) return ctx.reply("🛒 Avval savatga mahsulot qo‘shing.");

  if (!user.phone) {
    setState(ctx.from.id, "WAITING_PHONE");
    return ctx.reply("📱 Buyurtma uchun telefon raqamingizni yuboring:", {
      reply_markup: {
        keyboard: [[{ text: "📱 Telefon raqamimni yuborish", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
  }

  setState(ctx.from.id, "WAITING_DELIVERY");
  return ctx.reply("🚚 Yetkazib berish turini tanlang:", deliveryKeyboard());
}

async function handleContact(ctx, user) {
  if (ctx.message?.contact?.user_id && String(ctx.message.contact.user_id) !== String(ctx.from.id)) {
    return ctx.reply("Iltimos, o‘zingizning telefon raqamingizni yuboring.");
  }

  user.phone = ctx.message.contact.phone_number;
  await user.save();

  setState(ctx.from.id, "WAITING_DELIVERY");
  await ctx.reply("✅ Telefon raqami saqlandi.");
  return ctx.reply("🚚 Yetkazib berish turini tanlang:", deliveryKeyboard());
}

async function handleLocation(ctx, user) {
  const state = getState(ctx.from.id);
  if (!state || state.state !== "WAITING_LOCATION") return;

  state.data.location = {
    latitude: ctx.message.location.latitude,
    longitude: ctx.message.location.longitude
  };
  setState(ctx.from.id, "WAITING_ADDRESS", state.data);

  return ctx.reply("✍️ Manzilni matn ko‘rinishida ham yuboring.\nMasalan: Chilonzor 9-mavze, 15-uy, 45-xonadon.");
}

async function handleTextAddress(ctx) {
  const state = getState(ctx.from.id);
  if (!state || state.state !== "WAITING_ADDRESS") return false;

  state.data.address = {
    ...(state.data.address || {}),
    address: ctx.message.text
  };

  setState(ctx.from.id, "WAITING_PAYMENT", state.data);
  await ctx.reply("💳 To‘lov usulini tanlang:", paymentKeyboard());
  return true;
}

async function chooseDelivery(ctx, type) {
  const data = { deliveryType: type };

  if (type === "delivery") {
    setState(ctx.from.id, "WAITING_LOCATION", data);

    // MUHIM: Telegram API'da editMessageText'ga faqat INLINE
    // keyboard biriktirish mumkin. Lokatsiya so'rovchi tugma
    // (request_location) esa oddiy REPLY keyboard bo'lgani
    // uchun uni faqat YANGI xabar (ctx.reply) bilan yuborish
    // kerak — aks holda "400: inline keyboard expected" xatosi
    // chiqadi (aynan shu joyda chiqqan edi).
    //
    // Avval eski inline tugmali xabarni (best-effort) tozalab
    // qo'yamiz, keyin alohida yangi xabar bilan reply keyboard
    // yuboramiz.
    await ctx
      .editMessageText("🛵 Yetkazib berish tanlandi.")
      .catch(() => { });

    return ctx.reply("📍 Lokatsiyangizni Telegram orqali yuboring.", {
      reply_markup: {
        keyboard: [[{ text: "📍 Lokatsiyani yuborish", request_location: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
  }

  setState(ctx.from.id, "WAITING_PAYMENT", data);
  return ctx.editMessageText("💳 To‘lov usulini tanlang:", paymentKeyboard());
}

async function requestManualAddress(ctx) {
  const state = getState(ctx.from.id);
  if (!state || state.state !== "WAITING_LOCATION") return;

  setState(ctx.from.id, "WAITING_ADDRESS", state.data);

  return ctx.reply(
    "✍️ Manzilingizni to‘liq yozing.\nMasalan: Chilonzor tumani, 9-mavze, 15-uy, 45-xonadon.",
    { reply_markup: { remove_keyboard: true } }
  );
}

async function choosePayment(ctx, method, user) {
  const state = getState(ctx.from.id);
  if (!state) return ctx.answerCbQuery("Checkout sessiyasi topilmadi.");

  state.data.paymentMethod = method;
  setState(ctx.from.id, "WAITING_CONFIRMATION", state.data);

  const cart = await getCartDetailed(user._id);
  const deliveryFee = state.data.deliveryType === "delivery" ? (cart.subtotal >= 300000 ? 0 : 15000) : 0;
  const total = cart.subtotal + deliveryFee;

  const text = [
    "📦 BUYURTMA TASDIQLASH",
    "",
    ...cart.items.map(i => `• ${i.product.name} x${i.quantity} — ${money(i.totalPrice)}`),
    "",
    `Mahsulotlar: ${money(cart.subtotal)}`,
    `Yetkazib berish: ${money(deliveryFee)}`,
    `💰 Jami: ${money(total)}`,
    `💳 To‘lov: ${method}`,
    state.data.address?.address ? `📍 ${state.data.address.address}` : "🏪 Olib ketish",
    "",
    "Buyurtmani tasdiqlaysizmi?"
  ].join("\n");

  return ctx.editMessageText(text, confirmKeyboard());
}

async function confirmOrder(ctx, user, bot) {
  const state = getState(ctx.from.id);
  if (!state || state.state !== "WAITING_CONFIRMATION") {
    return ctx.answerCbQuery("Checkout sessiyasi topilmadi.");
  }

  // 1) Avval buyurtmani yaratamiz. Agar shu qadam
  // muvaffaqiyatsiz bo'lsa (masalan mahsulot endi mavjud
  // emas), state hali ham saqlanadi va foydalanuvchi
  // qaytadan urinib ko'rishi mumkin.
  let order;
  try {
    order = await createOrder({
      user,
      checkout: state.data
    });
  } catch (error) {
    console.error("Create order:", error);
    return ctx.answerCbQuery(error.message || "Buyurtma yaratilmadi.", {
      show_alert: true
    });
  }

  // 2) Buyurtma DB'da MUVAFFAQIYATLI yaratildi — endi state'ni
  // tozalaymiz. Bundan keyingi har qanday xatolik (admin'ga
  // xabar yuborish, online to'lov) buyurtmaning o'zini
  // yo'qqa chiqarmasligi kerak — foydalanuvchi baribir
  // buyurtma raqamini ko'rishi shart.
  clearState(ctx.from.id);

  try {
    await notifyAdmin(bot, order, user);
  } catch (error) {
    console.error("Notify admin:", error);
    // Jim o'tkazamiz — bu ichki bildirishnoma, mijoz buyurtmasi
    // baribir yaratilgan va u tasdiq xabarini olishi kerak.
  }

  if (state.data.paymentMethod === "online") {
    try {
      const payment = await createOnlinePayment({ order });
      if (payment.paymentUrl) {
        return ctx.editMessageText(
          `✅ Buyurtma yaratildi: ${order.orderNumber}\n\n💳 To‘lovni yakunlang:\n${payment.paymentUrl}`
        );
      }
      return ctx.editMessageText(
        `✅ Buyurtma yaratildi: ${order.orderNumber}\n\n⚠️ Online to‘lov provayderi hali ulanmagan. Operator siz bilan bog‘lanadi.`
      );
    } catch (error) {
      console.error("Online payment:", error);
      return ctx.editMessageText(
        `✅ Buyurtma yaratildi: ${order.orderNumber}\n💰 ${money(order.total)}\n\n⚠️ Online to‘lovni boshlashda xatolik yuz berdi. Operator siz bilan bog‘lanib, to‘lovni tasdiqlaydi.`
      );
    }
  }

  return ctx.editMessageText(
    `🎉 Buyurtmangiz qabul qilindi!\n\n📦 ${order.orderNumber}\n💰 ${money(order.total)}\n\nStatus: 🆕 Yangi buyurtma`
  );
}

function cancelCheckout(ctx) {
  clearState(ctx.from.id);
  const text = "❌ Buyurtma bekor qilindi.";

  // /cancel buyrug'i orqali chaqirilganda callback_query
  // konteksti yo'q — tahrirlanadigan xabar mavjud emas,
  // shuning uchun editMessageText ishlatib bo'lmaydi (xato
  // beradi). Faqat inline tugma orqali (checkout:cancel)
  // chaqirilganda tahrirlashga urinib ko'ramiz, aks holda
  // yangi xabar yuboramiz.
  if (ctx.callbackQuery) {
    return ctx.editMessageText(text).catch(() => ctx.reply(text));
  }
  return ctx.reply(text);
}

module.exports = {
  startCheckout,
  handleContact,
  handleLocation,
  handleTextAddress,
  chooseDelivery,
  choosePayment,
  confirmOrder,
  cancelCheckout
};