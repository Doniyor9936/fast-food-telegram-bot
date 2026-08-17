const { Telegraf, Markup } = require("telegraf");
const { botToken } = require("../config/env");

/* =========================================================
   PROXY (ixtiyoriy)
   =========================================================
   Agar api.telegram.org'ga to'g'ridan-to'g'ri ulanish
   ECONNRESET/timeout bilan tugasa (odatda ISP darajasida
   Telegram cheklangan bo'lganda yuz beradi), .env ichiga
   PROXY_URL qo'shing:
     PROXY_URL=http://127.0.0.1:8080        (HTTP proxy)
     PROXY_URL=socks5://127.0.0.1:1080      (SOCKS5 proxy)
   va kerakli paketni o'rnating:
     npm install https-proxy-agent socks-proxy-agent
========================================================= */

function buildTelegramAgent() {
  const proxyUrl = process.env.PROXY_URL;
  if (!proxyUrl) return undefined;

  try {
    if (proxyUrl.startsWith("socks")) {
      const { SocksProxyAgent } = require("socks-proxy-agent");
      console.log("🌐 Bot SOCKS proxy orqali ulanmoqda:", proxyUrl);
      return new SocksProxyAgent(proxyUrl);
    }
    const { HttpsProxyAgent } = require("https-proxy-agent");
    console.log("🌐 Bot HTTP(S) proxy orqali ulanmoqda:", proxyUrl);
    return new HttpsProxyAgent(proxyUrl);
  } catch (err) {
    console.error(
      "⚠️ Proxy paketi topilmadi. `npm install https-proxy-agent socks-proxy-agent` ni bajaring.",
      err.message
    );
    return undefined;
  }
}

const {
  myOrders,
  adminOrders,
  viewOrderAdmin,
  changeOrderStatusAdmin
} = require("./handlers/order.handler");


const { ensureUser } = require("./handlers/start.handler");
const {
  showMenu,
  showCategory,
  showProduct
} = require("./handlers/menu.handler");

const {
  renderCart,
  clearUserCart
} = require("./handlers/cart.handler");

const {
  startCheckout,
  handleContact,
  handleLocation,
  handleTextAddress,
  chooseDelivery,
  choosePayment,
  confirmOrder,
  cancelCheckout
} = require("./handlers/checkout.handler");

const {
  openProductAdmin,
  startAddProduct,
  selectProductCategory,
  cancelAddProduct,
  showProductsAdmin,
  startDeleteProduct,
  startEditProduct,

  handleAdminText,
  handleDeleteCategory,
  selectEditCategory,
  cancelEditProduct,

  showStatistics,
  productKeyboard,
  adminKeyboard,
  showCategoriesAdmin,
  startAddCategory,
  startDeleteCategory,
  categoryKeyboard
} = require("./handlers/admin.handler");

// const { myOrders } = require("./handlers/order.handler");
const { addToCart } = require("../services/cart.service");

const Product = require("../models/Product");

const bot = new Telegraf(botToken, {
  telegram: {
    agent: buildTelegramAgent(),
    // Standart timeout ba'zan tarmoq sekin bo'lganda juda qisqa
    // keladi — biroz oshiramiz.
    webhookReply: false
  }
});

/* =========================================================
   KEYBOARDS
========================================================= */

function customerKeyboard() {
  return Markup.keyboard([
    ["🍕 Menyu"],
    ["🛒 Savat", "📦 Buyurtmalarim"],
    ["❤️ Sevimlilar", "🔍 Qidirish"],
    ["📞 Aloqa", "ℹ️ Biz haqimizda"]
  ]).resize();
}


function operatorKeyboard() {
  return Markup.keyboard([
    ["📦 Buyurtmalar", "👥 Mijozlar"],
    ["📊 Statistika"],
    ["🛒 Mijozlar menyusi"]
  ]).resize();
}

function courierKeyboard() {
  return Markup.keyboard([
    ["📦 Mening buyurtmalarim"],
    ["🚚 Yetkazilganlar"],
    ["🛒 Mijozlar menyusi"]
  ]).resize();
}

/* =========================================================
   ROLE CHECK
========================================================= */

function isAdmin(ctx) {
  return ctx.state.user?.role === "admin";
}

function isOperator(ctx) {
  return ctx.state.user?.role === "operator";
}

function isCourier(ctx) {
  return ctx.state.user?.role === "courier";
}

function isStaff(ctx) {
  return ["admin", "operator", "courier"].includes(
    ctx.state.user?.role
  );
}

/* =========================================================
   USER MIDDLEWARE
========================================================= */

// lastActivityAt har bir xabarda emas, faqat shu oraliqdan
// keyin yangilanadi — har bosilgan tugma/xabar uchun DB'ga
// yozish bazani keraksiz yuklaydi (TZ bo'lim 56: performance).
const ACTIVITY_UPDATE_INTERVAL_MS = 60 * 1000;

async function userMiddleware(ctx, next) {
  try {
    if (!ctx.from) {
      console.log("❌ ctx.from mavjud emas");
      return;
    }

    const user = await ensureUser(ctx);

    if (!user) {
      console.error("❌ ensureUser user qaytarmadi");
      return ctx.reply(
        "❌ Foydalanuvchini aniqlashda xatolik yuz berdi."
      );
    }

    ctx.state.user = user;

    console.log("👤 USER:", {
      telegramId: user.telegramId,
      username: user.username,
      role: user.role
    });

    if (user.isBlocked) {
      return ctx.reply(
        "❌ Siz bloklangansiz.\n\nOperator bilan bog‘laning."
      );
    }

    const lastActivity = user.lastActivityAt
      ? new Date(user.lastActivityAt).getTime()
      : 0;

    if (Date.now() - lastActivity > ACTIVITY_UPDATE_INTERVAL_MS) {
      user.lastActivityAt = new Date();

      try {
        await user.save();
      } catch (saveError) {
        console.error(
          "⚠️ lastActivityAt saqlanmadi:",
          saveError.message
        );
      }
    }

    return next();

  } catch (error) {
    console.error("❌ USER MIDDLEWARE ERROR:", error);

    return ctx.reply(
      "❌ Serverda xatolik yuz berdi.\n\nIltimos, keyinroq qayta urinib ko‘ring."
    );
  }
}

bot.use(userMiddleware);

/* =========================================================
   /START
========================================================= */

bot.command("start", async ctx => {
  try {
    const user = ctx.state.user;

    console.log("🚀 /start:", {
      telegramId: user.telegramId,
      role: user.role
    });

    /* ADMIN */
    if (user.role === "admin") {
      return ctx.reply(
        `👋 Assalomu alaykum, ${user.firstName || "Admin"
        }!\n\n` +
        `🔐 Admin panelga xush kelibsiz.`,
        adminKeyboard()
      );
    }

    /* OPERATOR */
    if (user.role === "operator") {
      return ctx.reply(
        `👋 Assalomu alaykum, ${user.firstName || "Operator"
        }!\n\n` +
        `👨‍💼 Operator panel`,
        operatorKeyboard()
      );
    }

    /* COURIER */
    if (user.role === "courier") {
      return ctx.reply(
        `👋 Assalomu alaykum, ${user.firstName || "Kuryer"
        }!\n\n` +
        `🚴 Kuryer panel`,
        courierKeyboard()
      );
    }

    /* CUSTOMER */
    return ctx.reply(
      `Assalomu alaykum, ${user.firstName || "mehmon"
      }! 👋\n\n` +
      `🍕 Fast-food botiga xush kelibsiz!`,
      customerKeyboard()
    );

  } catch (error) {
    console.error("❌ /start ERROR:", error);

    await ctx.reply(
      "❌ Botda xatolik yuz berdi."
    );
  }
});

/* =========================================================
   /ADMIN
========================================================= */

bot.command("admin", async ctx => {
  try {
    const user = ctx.state.user;

    console.log("🔐 /admin:", {
      telegramId: user.telegramId,
      role: user.role
    });

    if (!isAdmin(ctx)) {
      return ctx.reply(
        "❌ Sizda admin huquqi yo‘q."
      );
    }

    return ctx.reply(
      `🔐 ADMIN PANEL\n\n` +
      `👤 ${user.firstName || "Admin"}\n` +
      `🆔 ${user.telegramId}`,
      adminKeyboard()
    );

  } catch (error) {
    console.error("❌ /admin ERROR:", error);

    return ctx.reply(
      "❌ Admin panelni ochishda xatolik."
    );
  }
});

/* =========================================================
   /OPERATOR
========================================================= */

bot.command("operator", async ctx => {
  try {
    if (!isOperator(ctx) && !isAdmin(ctx)) {
      return ctx.reply(
        "❌ Sizda operator huquqi yo‘q."
      );
    }

    return ctx.reply(
      "👨‍💼 OPERATOR PANEL",
      operatorKeyboard()
    );

  } catch (error) {
    console.error("❌ /operator ERROR:", error);
  }
});

/* =========================================================
   /COURIER
========================================================= */

bot.command("courier", async ctx => {
  try {
    if (!isCourier(ctx) && !isAdmin(ctx)) {
      return ctx.reply(
        "❌ Sizda kuryer huquqi yo‘q."
      );
    }

    return ctx.reply(
      "🚴 KURYER PANEL",
      courierKeyboard()
    );

  } catch (error) {
    console.error("❌ /courier ERROR:", error);
  }
});

/* =========================================================
   /MENU
========================================================= */

bot.command("menu", async ctx => {
  return showMenu(ctx);
});

/* =========================================================
   /CANCEL
========================================================= */

bot.command("cancel", async ctx => {
  return cancelCheckout(ctx);
});

/* =========================================================
   CUSTOMER MENU
========================================================= */

bot.hears("🍕 Menyu", async ctx => {
  return showMenu(ctx);
});

bot.hears("🛒 Savat", async ctx => {
  return renderCart(
    ctx,
    ctx.state.user
  );
});

bot.hears("📦 Buyurtmalarim", async ctx => {
  return myOrders(
    ctx,
    ctx.state.user
  );
});

bot.hears("📞 Aloqa", async ctx => {
  return ctx.reply(
    "📞 Operator: +998 XX XXX XX XX\n" +
    "🕐 Ish vaqti: 10:00–23:00"
  );
});

bot.hears("ℹ️ Biz haqimizda", async ctx => {
  return ctx.reply(
    "🍕 Fast-food restoran\n\n" +
    "Mazali taomlar va tezkor yetkazib berish."
  );
});

bot.hears("❤️ Sevimlilar", async ctx => {
  return ctx.reply(
    "❤️ Sevimlilar funksiyasi tez orada qo‘shiladi."
  );
});

bot.hears("🔍 Qidirish", async ctx => {
  return ctx.reply(
    "🔍 Qidirish uchun mahsulot nomini yuboring."
  );
});

/* =========================================================
   CUSTOMER MENU FROM ADMIN
========================================================= */

bot.hears("🛒 Mijozlar menyusi", async ctx => {
  return ctx.reply(
    "🛒 Mijozlar menyusi",
    customerKeyboard()
  );
});

/* =========================================================
   ADMIN - ORDERS
========================================================= */

bot.hears("📦 Buyurtmalar", async ctx => {
  if (!isAdmin(ctx) && !isOperator(ctx)) {
    return ctx.reply(
      "❌ Sizda bu bo‘limga ruxsat yo‘q."
    );
  }

  return adminOrders(ctx, "ACTIVE", 1);
});
/* =========================================================
   ADMIN - BUYURTMALAR RO'YXATI (filtr + sahifalash)
========================================================= */

bot.action(/^admorders:(\w+):(\d+)$/, async ctx => {
  const [, filter, page] = ctx.match;
  return adminOrders(ctx, filter, Number(page));
});

/* =========================================================
   ADMIN - BITTA BUYURTMANI BATAFSIL KO'RISH
========================================================= */

bot.action(/^admorder:(.+)$/, async ctx => {
  return viewOrderAdmin(ctx, ctx.match[1]);
});

/* =========================================================
   ADMIN - BUYURTMA STATUSINI O'ZGARTIRISH
========================================================= */

bot.action(/^admstatus:(.+):(\w+)$/, async ctx => {
  const [, orderId, newStatus] = ctx.match;
  return changeOrderStatusAdmin(ctx, orderId, newStatus, bot);
});


bot.hears("📂 Kategoriyalar", async ctx => {
  return showCategoriesAdmin(ctx);
});
bot.hears("➕ Kategoriya qo‘shish", async ctx => {
  return startAddCategory(ctx);
});

// Quyidagi ikkita tugma categoryKeyboard() ichida mavjud edi,
// lekin bot.js hech qachon ularni "eshitmagan" — bosilganda
// hech narsa bo'lmas edi. Endi to'g'ri ulandi.
bot.hears("📋 Kategoriyalar ro‘yxati", async ctx => {
  return showCategoriesAdmin(ctx);
});
bot.hears("🗑 Kategoriyani o‘chirish", async ctx => {
  return startDeleteCategory(ctx);
});
bot.hears("⬅️ Mahsulotlar", async ctx => {
  return openProductAdmin(ctx);
});

/* =========================================================
   ADMIN - PRODUCTS
========================================================= */

bot.hears("🍕 Mahsulotlar", async ctx => {
  return openProductAdmin(ctx);
});
bot.hears("➕ Mahsulot qo‘shish", async ctx => {
  return startAddProduct(ctx);
});
bot.hears("📋 Mahsulotlar ro‘yxati", async ctx => {
  return showProductsAdmin(ctx);
});
bot.hears("✏️ Mahsulotni tahrirlash", async ctx => {
  return startEditProduct(ctx);
});
bot.hears("🗑 Mahsulotni o‘chirish", async ctx => {
  return startDeleteProduct(ctx);
});

/* =========================================================
   ADMIN - STATISTICS
========================================================= */

bot.hears("📊 Statistika", async ctx => {
  return showStatistics(ctx);
});

bot.hears("⬅️ Admin panel", async ctx => {
  if (ctx.state.user.role !== "admin") {
    return ctx.reply("❌ Ruxsat yo‘q.");
  }

  return ctx.reply(
    "🔐 Admin panel",
    adminKeyboard()
  );
});

/* =========================================================
   ADMIN - CUSTOMERS
========================================================= */

bot.hears("👥 Mijozlar", async ctx => {
  if (!isAdmin(ctx) && !isOperator(ctx)) {
    return ctx.reply(
      "❌ Sizda mijozlarni ko‘rish huquqi yo‘q."
    );
  }

  try {
    const User = require("../models/User");

    const [
      total,
      customers,
      operators,
      couriers,
      admins
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({
        role: "customer"
      }),
      User.countDocuments({
        role: "operator"
      }),
      User.countDocuments({
        role: "courier"
      }),
      User.countDocuments({
        role: "admin"
      })
    ]);

    return ctx.reply(
      "👥 FOYDALANUVCHILAR\n\n" +
      `👥 Jami: ${total}\n` +
      `🛒 Customer: ${customers}\n` +
      `👨‍💼 Operator: ${operators}\n` +
      `🚴 Courier: ${couriers}\n` +
      `🔐 Admin: ${admins}`
    );

  } catch (error) {
    console.error(
      "❌ Customers error:",
      error
    );

    return ctx.reply(
      "❌ Mijozlarni olishda xatolik."
    );
  }
});

/* =========================================================
   ADMIN - SETTINGS
========================================================= */

bot.hears("⚙️ Sozlamalar", async ctx => {
  if (!isAdmin(ctx)) {
    return ctx.reply(
      "❌ Faqat adminlar uchun."
    );
  }

  return ctx.reply(
    "⚙️ SOZLAMALAR\n\n" +
    "Bot sozlamalari bo‘limi."
  );
});

/* =========================================================
   COURIER ORDERS
========================================================= */

bot.hears("📦 Mening buyurtmalarim", async ctx => {
  if (!isCourier(ctx) && !isAdmin(ctx)) {
    return ctx.reply(
      "❌ Siz kuryer emassiz."
    );
  }

  return ctx.reply(
    "📦 Mening buyurtmalarim\n\n" +
    "Sizga biriktirilgan buyurtmalar shu yerda chiqadi."
  );
});

bot.hears("🚚 Yetkazilganlar", async ctx => {
  if (!isCourier(ctx) && !isAdmin(ctx)) {
    return ctx.reply(
      "❌ Sizda ruxsat yo‘q."
    );
  }

  return ctx.reply(
    "🚚 Yetkazilgan buyurtmalar"
  );
});

/* =========================================================
   CONTACT
========================================================= */

bot.on("contact", async ctx => {
  try {
    return handleContact(
      ctx,
      ctx.state.user
    );
  } catch (error) {
    console.error(
      "❌ Contact error:",
      error
    );

    return ctx.reply(
      "❌ Telefon raqamini qabul qilishda xatolik."
    );
  }
});

/* =========================================================
   LOCATION
========================================================= */

bot.on("location", async ctx => {
  try {
    return handleLocation(
      ctx,
      ctx.state.user
    );
  } catch (error) {
    console.error(
      "❌ Location error:",
      error
    );

    return ctx.reply(
      "❌ Lokatsiyani qabul qilishda xatolik."
    );
  }
});

/* =========================================================
   TEXT ADDRESS / SEARCH / ADMIN STATE / UNKNOWN COMMAND
   (bitta handlerga birlashtirildi — ilgari ikkita alohida
   bot.on("text", ...) bor edi va birinchisi hech qachon
   next() chaqirmagani uchun ikkinchisi umuman ishlamas edi,
   ya'ni "❓ Noma'lum buyruq" xabari hech qachon chiqmasdi)
========================================================= */
bot.on("text", async ctx => {
  try {
    const text = ctx.message.text.trim();

    if (text.startsWith("/")) {
      return ctx.reply(
        "❓ Noma’lum buyruq.\n\n" +
        "/start — Bosh menyu\n" +
        "/menu — Menyu\n" +
        "/admin — Admin panel\n" +
        "/cancel — Bekor qilish"
      );
    }

    /*
     * ADMIN STATE
     *
     * Mahsulot/kategoriya qo‘shish, tahrirlash, o‘chirish
     * jarayoni davom etayotgan bo‘lsa, shu handlerlar ishlaydi.
     */

    if (ctx.state.user?.role === "admin") {
      const handledAddEdit =
        await handleAdminText(ctx);

      if (handledAddEdit) {
        return;
      }

      // "delete_category" holati handleAdminText ICHIDA emas,
      // alohida funksiyada — shuning uchun bu yerda ham
      // chaqirilishi shart edi (ilgari umuman chaqirilmasdi).
      const handledDeleteCategory =
        await handleDeleteCategory(ctx);

      if (handledDeleteCategory) {
        return;
      }
    }

    /*
     * CHECKOUT ADDRESS
     */

    const handledAddress =
      await handleTextAddress(ctx);

    if (handledAddress) {
      return;
    }

    /*
     * PRODUCT SEARCH
     */

    const results = await Product.find({
      isActive: true,
      isAvailable: true,
      $or: [
        {
          name: {
            $regex: text,
            $options: "i"
          }
        },
        {
          description: {
            $regex: text,
            $options: "i"
          }
        }
      ]
    })
      .limit(10)
      .lean();

    if (!results.length) {
      return;
    }

    return ctx.reply(
      "🔍 Qidiruv natijalari:\n\n" +
      results
        .map(p => {
          const price = Number(
            p.discountPrice ?? p.price
          ).toLocaleString("uz-UZ");

          return `• ${p.name} — ${price} so'm`;
        })
        .join("\n")
    );

  } catch (error) {
    console.error(
      "❌ TEXT HANDLER ERROR:",
      error
    );

    return ctx.reply(
      "❌ Xatolik yuz berdi."
    );
  }
});

/* =========================================================
   INLINE BUTTONS
========================================================= */

bot.action("main", async ctx => {
  await ctx.answerCbQuery();

  const user = ctx.state.user;

  if (user.role === "admin") {
    return ctx.reply(
      "🔐 Admin panel",
      adminKeyboard()
    );
  }

  if (user.role === "operator") {
    return ctx.reply(
      "👨‍💼 Operator panel",
      operatorKeyboard()
    );
  }

  if (user.role === "courier") {
    return ctx.reply(
      "🚴 Kuryer panel",
      courierKeyboard()
    );
  }

  return ctx.reply(
    "🏠 Bosh menyu",
    customerKeyboard()
  );
});

/* =========================================================
   MENU
========================================================= */

bot.action("menu", async ctx => {
  await ctx.answerCbQuery();

  return showMenu(ctx);
});

/* =========================================================
   CATEGORY
========================================================= */

bot.action(
  /^cat:(.+)$/,
  async ctx => {
    await ctx.answerCbQuery();

    return showCategory(
      ctx,
      ctx.match[1]
    );
  }
);

/* =========================================================
   PRODUCT
========================================================= */

bot.action(
  /^product:(.+)$/,
  async ctx => {
    await ctx.answerCbQuery();

    return showProduct(
      ctx,
      ctx.match[1]
    );
  }
);

/* =========================================================
   ADD TO CART
========================================================= */

bot.action(
  /^add:(.+):(\d+)$/,
  async ctx => {
    const [
      ,
      productId,
      quantity
    ] = ctx.match;

    // CALLBACK QUERY'GA DARHOL JAVOB
    await ctx.answerCbQuery("🛒 Savatga qo‘shilmoqda...");

    try {
      await addToCart(
        ctx.state.user._id,
        productId,
        Number(quantity)
      );

      // Bu yerda yana answerCbQuery QILMAYMIZ
      // Faqat keyingi UI ishlarini qilamiz

    } catch (error) {
      console.error(
        "❌ Add cart error:",
        error
      );
    }
  }
);

/* =========================================================
   QUANTITY (mahsulot sahifasida, savatga qo'shishdan oldin)
========================================================= */

const { productActions } = require("./keyboards/menu.keyboard"); // fayl yuqorida import qilinadi

bot.action(/^qty:(.+):(\d+):inc$/, async ctx => {
  const [, productId, currentQty] = ctx.match;
  const newQty = Math.min(99, Number(currentQty) + 1);

  try {
    await ctx.editMessageReplyMarkup(
      productActions(productId, newQty).reply_markup
    );
  } catch (error) {
    console.error("❌ Qty inc error:", error.message);
  }

  return ctx.answerCbQuery();
});

bot.action(/^qty:(.+):(\d+):dec$/, async ctx => {
  const [, productId, currentQty] = ctx.match;
  const newQty = Math.max(1, Number(currentQty) - 1);

  try {
    await ctx.editMessageReplyMarkup(
      productActions(productId, newQty).reply_markup
    );
  } catch (error) {
    console.error("❌ Qty dec error:", error.message);
  }

  return ctx.answerCbQuery();
});

bot.action(/^qty:(.+):(\d+):show$/, async ctx => {
  return ctx.answerCbQuery(`${ctx.match[2]} dona`);
});



/* =========================================================
   CART
========================================================= */

bot.action("cart", async ctx => {
  await ctx.answerCbQuery();

  return renderCart(
    ctx,
    ctx.state.user
  );
});

/* =========================================================
   CLEAR CART
========================================================= */

bot.action(
  "cart:clear",
  async ctx => {
    try {
      await clearUserCart(
        ctx,
        ctx.state.user
      );

      await ctx.answerCbQuery(
        "Savat tozalandi"
      );

    } catch (error) {
      console.error(
        "❌ Clear cart error:",
        error
      );

      await ctx.answerCbQuery(
        "❌ Savatni tozalashda xatolik"
      );
    }
  }
);

/* =========================================================
   CHECKOUT
========================================================= */

bot.action(
  "checkout",
  async ctx => {
    await ctx.answerCbQuery();

    return startCheckout(
      ctx,
      ctx.state.user
    );
  }
);

/* =========================================================
   DELIVERY
========================================================= */

bot.action(
  /^delivery:(delivery|pickup)$/,
  async ctx => {
    await ctx.answerCbQuery();

    return chooseDelivery(
      ctx,
      ctx.match[1]
    );
  }
);

/* =========================================================
   PAYMENT
========================================================= */

bot.action(
  /^payment:(cash|card|online)$/,
  async ctx => {
    await ctx.answerCbQuery();

    return choosePayment(
      ctx,
      ctx.match[1],
      ctx.state.user
    );
  }
);

/* =========================================================
   CONFIRM ORDER
========================================================= */

bot.action(
  "checkout:confirm",
  async ctx => {
    try {
      await ctx.answerCbQuery(
        "Buyurtma yaratilmoqda..."
      );

      return confirmOrder(
        ctx,
        ctx.state.user,
        bot
      );

    } catch (error) {
      console.error(
        "❌ Confirm order error:",
        error
      );

      return ctx.reply(
        "❌ Buyurtmani tasdiqlashda xatolik."
      );
    }
  }
);

/* =========================================================
   CANCEL CHECKOUT
========================================================= */

bot.action(
  "checkout:cancel",
  async ctx => {
    await ctx.answerCbQuery();

    return cancelCheckout(ctx);
  }
);

/* =========================================================
   ADMIN - ADD PRODUCT: CATEGORY SELECT / CANCEL
   (admin.handler.js bu callback_data'larni chiqarar edi,
   lekin bot.js'da ularga mos bot.action() umuman yo'q edi —
   tugma bosilganda hech narsa bo'lmasdi. Endi qo'shildi.)
========================================================= */

bot.action(
  /^admin:add-product-category:(.+)$/,
  async ctx => {
    return selectProductCategory(
      ctx,
      ctx.match[1]
    );
  }
);

bot.action(
  "admin:add-product-cancel",
  async ctx => {
    return cancelAddProduct(ctx);
  }
);

/* =========================================================
   ADMIN - EDIT PRODUCT: CATEGORY SELECT / CANCEL
   (xuddi shu muammo "kategoriya tahrirlash" oqimida ham
   bor edi — endi selectEditCategory/cancelEditProduct
   admin.handler.js'ga qo'shildi va shu yerda ulandi.)
========================================================= */

bot.action(
  /^admin:edit-category:(.+):(.+)$/,
  async ctx => {
    return selectEditCategory(
      ctx,
      ctx.match[1],
      ctx.match[2]
    );
  }
);

bot.action(
  "admin:edit-cancel",
  async ctx => {
    return cancelEditProduct(ctx);
  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

bot.catch((error, ctx) => {
  console.error(
    "❌ TELEGRAM BOT ERROR:",
    error
  );

  if (ctx) {
    ctx.reply(
      "❌ Kutilmagan xatolik yuz berdi.\n\n" +
      "Iltimos, qayta urinib ko‘ring."
    ).catch(() => { });
  }
});

/* =========================================================
   START BOT
========================================================= */

// Tarmoq vaqtincha uzilib qolsa (ECONNRESET, ETIMEDOUT va h.k.)
// ilova butunlay yiqilmasin — bir necha marta, oraliqni
// kattalashtirib qayta urinamiz.
const MAX_LAUNCH_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isNetworkError(error) {
  const networkCodes = [
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "EAI_AGAIN",
    "ECONNREFUSED"
  ];
  return (
    networkCodes.includes(error?.code) ||
    networkCodes.includes(error?.errno) ||
    /ECONNRESET|ETIMEDOUT|ENOTFOUND|network/i.test(
      error?.message || ""
    )
  );
}

async function launchWithRetry(attempt = 1) {
  try {
    await bot.launch();
    console.log("🤖 Telegram bot started successfully");
  } catch (error) {
    const network = isNetworkError(error);

    console.error(
      `❌ Bot ishga tushishida xato (urinish ${attempt}/${MAX_LAUNCH_RETRIES}):`,
      error.message || error
    );

    if (network && attempt < MAX_LAUNCH_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * attempt;
      console.log(
        `⏳ Tarmoq xatosi aniqlandi. ${delay / 1000} soniyadan so‘ng qayta urinamiz...`
      );
      await sleep(delay);
      return launchWithRetry(attempt + 1);
    }

    if (network) {
      console.error(
        "\n🛑 Telegram serveriga ulanib bo‘lmadi.\n" +
        "Tekshiring:\n" +
        "  1) Internet ulanishi (curl -v https://api.telegram.org)\n" +
        "  2) VPN kerak bo‘lishi mumkin (Telegram ba'zi provayderlarda cheklangan)\n" +
        "  3) Antivirus/firewall SSL skanerini o‘chirib ko‘ring\n" +
        "  4) .env ichida PROXY_URL orqali proxy sozlang\n"
      );
    }

    throw error;
  }
}

async function startBot() {
  if (!botToken) {
    throw new Error(
      "BOT_TOKEN topilmadi. .env faylni tekshiring."
    );
  }

  console.log("🚀 Telegram bot ishga tushmoqda...");

  await launchWithRetry();

  process.once(
    "SIGINT",
    () => bot.stop("SIGINT")
  );

  process.once(
    "SIGTERM",
    () => bot.stop("SIGTERM")
  );
}

module.exports = {
  bot,
  startBot
};