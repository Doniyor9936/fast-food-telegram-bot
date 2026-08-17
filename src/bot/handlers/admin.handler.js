const Product = require("../../models/Product");
const User = require("../../models/User");
const Category = require("../../models/Category");
const { Markup } = require("telegraf");

// =====================================================
// ADMIN STATE
// =====================================================

const adminStates = new Map();

function getAdminState(userId) {
    return adminStates.get(String(userId)) || {};
}

function setAdminState(userId, state) {
    adminStates.set(String(userId), state);
}

function clearAdminState(userId) {
    adminStates.delete(String(userId));
}

// =====================================================
// ADMIN KEYBOARD
// =====================================================

function adminKeyboard() {
    return Markup.keyboard([
        ["📦 Buyurtmalar", "🍕 Mahsulotlar"],
        ["📊 Statistika", "👥 Mijozlar"],
        ["⚙️ Sozlamalar"],
        ["🛒 Mijozlar menyusi"]
    ]).resize();
}

// =====================================================
// PRODUCT KEYBOARD
// =====================================================

function productKeyboard() {
    return Markup.keyboard([
        ["➕ Mahsulot qo‘shish"],
        ["📋 Mahsulotlar ro‘yxati"],
        ["✏️ Mahsulotni tahrirlash"],
        ["🗑 Mahsulotni o‘chirish"],
        ["📂 Kategoriyalar"],
        ["⬅️ Admin panel"]
    ]).resize();
}

// =====================================================
// CATEGORY KEYBOARD
// =====================================================

function categoryKeyboard() {
    return Markup.keyboard([
        ["➕ Kategoriya qo‘shish"],
        ["📋 Kategoriyalar ro‘yxati"],
        ["🗑 Kategoriyani o‘chirish"],
        ["⬅️ Mahsulotlar"]
    ]).resize();
}

// =====================================================
// SHOW CATEGORIES
// =====================================================

async function showCategoriesAdmin(ctx) {
    if (ctx.state.user.role !== "admin") {
        return ctx.reply("❌ Faqat adminlar uchun.");
    }

    try {
        const categories = await Category.find({})
            .sort({
                sortOrder: 1,
                name: 1
            })
            .lean();

        if (!categories.length) {
            return ctx.reply(
                "📂 KATEGORIYALAR\n\n" +
                "❌ Hozircha kategoriyalar mavjud emas.\n\n" +
                "➕ Kategoriya qo‘shish tugmasini bosing.",
                categoryKeyboard()
            );
        }

        let text = "📂 KATEGORIYALAR\n\n";

        categories.forEach((category, index) => {
            text +=
                `${index + 1}. ${category.name}\n` +
                `   ${category.isActive ? "✅ Faol" : "❌ Nofaol"}\n`;

            if (category.description) {
                text += `   📝 ${category.description}\n`;
            }

            text += "\n";
        });

        return ctx.reply(
            text,
            categoryKeyboard()
        );

    } catch (error) {
        console.error(
            "❌ Show categories error:",
            error
        );

        return ctx.reply(
            "❌ Kategoriyalarni olishda xatolik."
        );
    }
}

// =====================================================
// START ADD CATEGORY
// =====================================================

async function startAddCategory(ctx) {
    if (ctx.state.user.role !== "admin") {
        return ctx.reply("❌ Faqat adminlar uchun.");
    }

    clearAdminState(ctx.state.user._id);

    setAdminState(ctx.state.user._id, {
        action: "add_category",
        step: "name",
        data: {}
    });

    return ctx.reply(
        "➕ YANGI KATEGORIYA\n\n" +
        "Kategoriya nomini yuboring.\n\n" +
        "Masalan:\n" +
        "🍕 Pitsalar"
    );
}

// =====================================================
// CATEGORY DELETE START
// =====================================================

async function startDeleteCategory(ctx) {
    if (ctx.state.user.role !== "admin") {
        return ctx.reply("❌ Faqat adminlar uchun.");
    }

    const categories = await Category.find({
        isActive: true
    })
        .sort({ name: 1 })
        .lean();

    if (!categories.length) {
        return ctx.reply(
            "❌ O‘chirish uchun kategoriya mavjud emas.",
            categoryKeyboard()
        );
    }

    let text =
        "🗑 KATEGORIYA O‘CHIRISH\n\n" +
        "Kategoriya raqamini yuboring:\n\n";

    categories.forEach((category, index) => {
        text += `${index + 1}. ${category.name}\n`;
    });

    setAdminState(ctx.state.user._id, {
        action: "delete_category",
        categories: categories.map(category => ({
            id: category._id.toString(),
            name: category.name
        }))
    });

    return ctx.reply(text);
}

// =====================================================
// CATEGORY DELETE HANDLER
// =====================================================

async function handleDeleteCategory(ctx) {
    const userId = String(ctx.state.user._id);
    const state = getAdminState(userId);

    if (state.action !== "delete_category") {
        return false;
    }

    const text = ctx.message.text.trim();

    const number = Number(text);

    if (
        !Number.isInteger(number) ||
        number < 1 ||
        number > state.categories.length
    ) {
        await ctx.reply(
            "❌ Noto‘g‘ri raqam."
        );

        return true;
    }

    const selected = state.categories[number - 1];

    const category = await Category.findById(
        selected.id
    );

    if (!category) {
        clearAdminState(userId);

        await ctx.reply(
            "❌ Kategoriya topilmadi.",
            categoryKeyboard()
        );

        return true;
    }

    // Shu kategoriyadagi mahsulotlar bormi?
    const productCount = await Product.countDocuments({
        categoryId: category._id,
        isActive: true
    });

    if (productCount > 0) {
        await ctx.reply(
            `❌ "${category.name}" kategoriyasini o‘chirib bo‘lmaydi.\n\n` +
            `Bu kategoriyada ${productCount} ta mahsulot mavjud.\n\n` +
            "Avval mahsulotlarni boshqa kategoriyaga o‘tkazing yoki o‘chiring."
        );

        return true;
    }

    // category.isActive = false;
    // await category.save(); ------> soft delete

    await Category.findByIdAndDelete(category._id); 
    clearAdminState(userId);

    await ctx.reply(
        `✅ "${category.name}" kategoriyasi o‘chirildi.`,
        categoryKeyboard()
    );

    return true;
}

// =====================================================
// ADD PRODUCT - CATEGORY SELECT
// =====================================================

async function startAddProduct(ctx) {
    if (ctx.state.user.role !== "admin") {
        return ctx.reply("❌ Faqat adminlar uchun.");
    }

    clearAdminState(ctx.state.user._id);

    const categories = await Category.find({
        isActive: true
    })
        .sort({ name: 1 })
        .lean();

    if (!categories.length) {
        return ctx.reply(
            "❌ Hozircha kategoriyalar mavjud emas.\n\n" +
            "Avval kategoriya yarating.",
            categoryKeyboard()
        );
    }

    const buttons = categories.map(category => [
        Markup.button.callback(
            `📂 ${category.name}`,
            `admin:add-product-category:${category._id}`
        )
    ]);

    buttons.push([
        Markup.button.callback(
            "❌ Bekor qilish",
            "admin:add-product-cancel"
        )
    ]);

    return ctx.reply(
        "➕ YANGI MAHSULOT\n\n" +
        "📂 Mahsulot kategoriyasini tanlang:",
        Markup.inlineKeyboard(buttons)
    );
}

// =====================================================
// CATEGORY SELECTED FOR PRODUCT
// =====================================================

async function selectProductCategory(ctx, categoryId) {
    if (ctx.state.user.role !== "admin") {
        return ctx.answerCbQuery(
            "❌ Ruxsat yo‘q"
        );
    }

    try {
        const category = await Category.findOne({
            _id: categoryId,
            isActive: true
        });

        if (!category) {
            return ctx.answerCbQuery(
                "❌ Kategoriya topilmadi."
            );
        }

        setAdminState(ctx.state.user._id, {
            action: "add_product",
            step: "name",
            data: {
                categoryId: category._id
            }
        });

        await ctx.answerCbQuery(
            "Kategoriya tanlandi"
        );

        return ctx.reply(
            "➕ YANGI MAHSULOT\n\n" +
            `📂 Kategoriya: ${category.name}\n\n` +
            "🍕 Mahsulot nomini yuboring.\n\n" +
            "Masalan:\n" +
            "Pepperoni Pizza"
        );

    } catch (error) {
        console.error(
            "❌ Select product category error:",
            error
        );

        return ctx.answerCbQuery(
            "❌ Xatolik yuz berdi."
        );
    }
}

// =====================================================
// CANCEL ADD PRODUCT
// =====================================================

async function cancelAddProduct(ctx) {
    clearAdminState(ctx.state.user._id);

    await ctx.answerCbQuery(
        "Bekor qilindi"
    );

    return ctx.reply(
        "❌ Mahsulot qo‘shish bekor qilindi.",
        productKeyboard()
    );
}

// =====================================================
// EDIT PRODUCT - CATEGORY SELECTED (yangi qo'shildi)
// =====================================================
// admin.handler.js oldingi versiyasida "📂 Kategoriya"
// tahrirlash tugmasi bosilganda inline tugmalar
// `admin:edit-category:<categoryId>:<productId>` callback_data
// bilan chiqarilar edi, lekin bu callback'ni ushlab
// oluvchi funksiya umuman yo'q edi va bot.js'da ham
// unga mos bot.action() ro'yxatdan o'tkazilmagan edi —
// natijada tugma bosilganda hech narsa bo'lmasdi.

async function selectEditCategory(ctx, categoryId, productId) {
    if (ctx.state.user.role !== "admin") {
        return ctx.answerCbQuery("❌ Ruxsat yo‘q");
    }

    try {
        const category = await Category.findOne({
            _id: categoryId,
            isActive: true
        });

        if (!category) {
            return ctx.answerCbQuery("❌ Kategoriya topilmadi.");
        }

        const product = await Product.findById(productId);

        if (!product) {
            clearAdminState(ctx.state.user._id);
            await ctx.answerCbQuery("❌ Mahsulot topilmadi.");
            return ctx.reply("❌ Mahsulot topilmadi.", productKeyboard());
        }

        product.categoryId = category._id;
        await product.save();

        clearAdminState(ctx.state.user._id);

        await ctx.answerCbQuery("Kategoriya yangilandi");

        return ctx.reply(
            `✅ "${product.name}" mahsulotining kategoriyasi ` +
            `"${category.name}" ga o‘zgartirildi.`,
            productKeyboard()
        );

    } catch (error) {
        console.error(
            "❌ Select edit category error:",
            error
        );

        return ctx.answerCbQuery("❌ Xatolik yuz berdi.");
    }
}

async function cancelEditProduct(ctx) {
    clearAdminState(ctx.state.user._id);

    await ctx.answerCbQuery("Bekor qilindi");

    return ctx.reply(
        "❌ Tahrirlash bekor qilindi.",
        productKeyboard()
    );
}

// =====================================================
// ADMIN TEXT HANDLER
// =====================================================

async function handleAdminText(ctx) {
    if (
        !ctx.state.user ||
        ctx.state.user.role !== "admin"
    ) {
        return false;
    }

    const userId = String(
        ctx.state.user._id
    );

    const state = getAdminState(userId);

    if (!state.action) {
        return false;
    }

    const text = ctx.message.text.trim();

    // =================================================
    // ADD CATEGORY
    // =================================================

    if (state.action === "add_category") {

        // NAME
        if (state.step === "name") {

            if (text.length < 2) {
                await ctx.reply(
                    "❌ Kategoriya nomi juda qisqa."
                );

                return true;
            }

            const existing =
                await Category.findOne({
                    name: {
                        $regex: `^${text}$`,
                        $options: "i"
                    }
                });

            if (existing) {
                await ctx.reply(
                    "❌ Bu kategoriya allaqachon mavjud."
                );

                return true;
            }

            state.data.name = text;
            state.step = "description";

            setAdminState(
                userId,
                state
            );

            await ctx.reply(
                "📝 Kategoriya tavsifini yuboring.\n\n" +
                "Agar tavsif kerak bo‘lmasa:\n" +
                "— yuboring."
            );

            return true;
        }

        // DESCRIPTION
        if (state.step === "description") {

            state.data.description =
                text === "—"
                    ? ""
                    : text;

            state.step = "confirm";

            setAdminState(
                userId,
                state
            );

            await ctx.reply(
                "📋 KATEGORIYANI TEKSHIRING\n\n" +
                `📂 Nomi: ${state.data.name}\n` +
                `📝 Tavsif: ${state.data.description || "Yo‘q"}\n\n` +
                "Saqlaymizmi?",

                Markup.keyboard([
                    ["✅ Kategoriya saqlash"],
                    ["❌ Bekor qilish"]
                ]).resize()
            );

            return true;
        }

        // CONFIRM
        if (state.step === "confirm") {

            if (text === "❌ Bekor qilish") {

                clearAdminState(userId);

                return ctx.reply(
                    "❌ Kategoriya yaratish bekor qilindi.",
                    categoryKeyboard()
                );
            }

            if (
                text !==
                "✅ Kategoriya saqlash"
            ) {
                await ctx.reply(
                    "Iltimos, tugmalardan birini tanlang."
                );

                return true;
            }

            try {

                const category =
                    await Category.create({
                        name: state.data.name,
                        description:
                            state.data.description || "",
                        isActive: true
                    });

                clearAdminState(
                    userId
                );

                await ctx.reply(
                    "✅ KATEGORIYA YARATILDI!\n\n" +
                    `📂 ${category.name}`,
                    categoryKeyboard()
                );

            } catch (error) {

                console.error(
                    "❌ Category create error:",
                    error
                );

                await ctx.reply(
                    "❌ Kategoriyani saqlashda xatolik:\n\n" +
                    error.message
                );
            }

            return true;
        }
    }

    // =================================================
    // ADD PRODUCT
    // =================================================

    if (state.action === "add_product") {

        // NAME
        if (state.step === "name") {

            state.data.name = text;
            state.step = "description";

            setAdminState(
                userId,
                state
            );

            await ctx.reply(
                "📝 Mahsulot tavsifini yuboring.\n\n" +
                "Masalan:\n" +
                "Pomidor, pishloq va pepperoni bilan.\n\n" +
                "Tavsif kerak bo‘lmasa:\n" +
                "— yuboring."
            );

            return true;
        }

        // DESCRIPTION
        if (state.step === "description") {

            state.data.description =
                text === "—"
                    ? ""
                    : text;

            state.step = "price";

            setAdminState(
                userId,
                state
            );

            await ctx.reply(
                "💰 Mahsulot narxini yuboring.\n\n" +
                "Faqat raqam yozing.\n\n" +
                "Masalan:\n" +
                "45000"
            );

            return true;
        }

        // PRICE
        if (state.step === "price") {

            const price = Number(
                text.replace(/\s/g, "")
            );

            if (
                !Number.isFinite(price) ||
                price <= 0
            ) {
                await ctx.reply(
                    "❌ Narx noto‘g‘ri.\n\n" +
                    "Masalan: 45000"
                );

                return true;
            }

            state.data.price = price;
            state.step = "discountPrice";

            setAdminState(
                userId,
                state
            );

            await ctx.reply(
                "🔥 Chegirmali narxni yuboring.\n\n" +
                "Chegirma bo‘lmasa 0 yuboring.\n\n" +
                "Masalan:\n" +
                "40000"
            );

            return true;
        }

        // DISCOUNT
        if (
            state.step ===
            "discountPrice"
        ) {

            const discountPrice =
                Number(
                    text.replace(/\s/g, "")
                );

            if (
                !Number.isFinite(
                    discountPrice
                ) ||
                discountPrice < 0
            ) {
                await ctx.reply(
                    "❌ Chegirmali narx noto‘g‘ri."
                );

                return true;
            }

            if (
                discountPrice > 0 &&
                discountPrice >=
                state.data.price
            ) {
                await ctx.reply(
                    "❌ Chegirmali narx oddiy narxdan kichik bo‘lishi kerak."
                );

                return true;
            }

            state.data.discountPrice =
                discountPrice > 0
                    ? discountPrice
                    : null;

            state.step = "confirm";

            setAdminState(
                userId,
                state
            );

            // Kategoriya nomini olib, foydalanuvchiga ID o'rniga
            // tushunarli nom ko'rsatamiz.
            let categoryName = "Noma'lum";
            try {
                const category = await Category.findById(
                    state.data.categoryId
                ).lean();
                if (category) categoryName = category.name;
            } catch (e) {
                // jim o'tkazamiz — faqat ko'rsatish uchun ishlatiladi
            }

            return ctx.reply(
                "📋 MAHSULOTNI TEKSHIRING\n\n" +
                `📂 Kategoriya: ${categoryName}\n` +
                `🍕 Nomi: ${state.data.name}\n` +
                `📝 Tavsif: ${state.data.description || "Yo‘q"}\n` +
                `💰 Narx: ${state.data.price.toLocaleString("uz-UZ")} so‘m\n` +
                `🔥 Chegirma: ${state.data.discountPrice
                    ? state.data.discountPrice.toLocaleString("uz-UZ") +
                    " so‘m"
                    : "Yo‘q"
                }\n\n` +
                "Saqlaymizmi?",

                Markup.keyboard([
                    ["✅ Saqlash"],
                    ["❌ Bekor qilish"]
                ]).resize()
            );
        }

        // CONFIRM PRODUCT
        if (state.step === "confirm") {

            if (
                text ===
                "❌ Bekor qilish"
            ) {
                clearAdminState(
                    userId
                );

                return ctx.reply(
                    "❌ Mahsulot qo‘shish bekor qilindi.",
                    productKeyboard()
                );
            }

            if (
                text !== "✅ Saqlash"
            ) {
                await ctx.reply(
                    "Iltimos, tugmalardan birini tanlang."
                );

                return true;
            }

            try {

                const product =
                    await Product.create({
                        name:
                            state.data.name,

                        description:
                            state.data.description,

                        categoryId:
                            state.data.categoryId,

                        price:
                            state.data.price,

                        discountPrice:
                            state.data.discountPrice,

                        isActive: true,

                        isAvailable: true
                    });

                clearAdminState(
                    userId
                );

                await ctx.reply(
                    "✅ MAHSULOT QO‘SHILDI!\n\n" +
                    `🍕 ${product.name}\n` +
                    `💰 ${Number(
                        product.discountPrice ??
                        product.price
                    ).toLocaleString("uz-UZ")} so‘m`,
                    productKeyboard()
                );

            } catch (error) {

                console.error(
                    "❌ Product create error:",
                    error
                );

                await ctx.reply(
                    "❌ Mahsulotni saqlashda xatolik:\n\n" +
                    error.message
                );
            }

            return true;
        }
    }

    // =================================================
    // DELETE PRODUCT
    // =================================================

    if (
        state.action ===
        "delete_product"
    ) {

        const number =
            Number(text);

        if (
            !Number.isInteger(
                number
            ) ||
            number < 1 ||
            number >
            state.products.length
        ) {
            await ctx.reply(
                "❌ Noto‘g‘ri raqam."
            );

            return true;
        }

        const productId =
            state.products[
            number - 1
            ];

        const product =
            await Product.findById(
                productId
            );

        if (!product) {
            clearAdminState(
                userId
            );

            await ctx.reply(
                "❌ Mahsulot topilmadi.",
                productKeyboard()
            );

            return true;
        }

        product.isActive = false;
        product.isAvailable = false;

        await product.save();

        clearAdminState(
            userId
        );

        await ctx.reply(
            `✅ "${product.name}" o‘chirildi.`,
            productKeyboard()
        );

        return true;
    }

    // =================================================
    // EDIT PRODUCT
    // =================================================

    if (
        state.action ===
        "edit_product"
    ) {

        // SELECT PRODUCT
        if (
            state.step ===
            "select"
        ) {

            const number =
                Number(text);

            if (
                !Number.isInteger(
                    number
                ) ||
                number < 1 ||
                number >
                state.products.length
            ) {
                await ctx.reply(
                    "❌ Noto‘g‘ri raqam."
                );

                return true;
            }

            const selected =
                state.products[
                number - 1
                ];

            state.productId =
                selected.id;

            state.step = "field";

            setAdminState(
                userId,
                state
            );

            await ctx.reply(
                `✏️ "${selected.name}"\n\n` +
                "Nimani o‘zgartirmoqchisiz?",

                Markup.keyboard([
                    ["📝 Nomi", "📄 Tavsifi"],
                    ["💰 Narxi", "🔥 Chegirmasi"],
                    ["🔄 Mavjudligi"],
                    ["📂 Kategoriya"],
                    ["❌ Bekor qilish"]
                ]).resize()
            );

            return true;
        }

        // FIELD
        if (
            state.step ===
            "field"
        ) {

            if (
                text ===
                "❌ Bekor qilish"
            ) {
                clearAdminState(
                    userId
                );

                return ctx.reply(
                    "❌ Tahrirlash bekor qilindi.",
                    productKeyboard()
                );
            }

            const fields = {
                "📝 Nomi": "name",
                "📄 Tavsifi": "description",
                "💰 Narxi": "price",
                "🔥 Chegirmasi":
                    "discountPrice",
                "🔄 Mavjudligi":
                    "availability",
                "📂 Kategoriya":
                    "category"
            };

            if (!fields[text]) {
                await ctx.reply(
                    "❌ Noto‘g‘ri tanlov."
                );

                return true;
            }

            state.field =
                fields[text];

            // KATEGORIYA
            if (
                state.field ===
                "category"
            ) {

                const categories =
                    await Category.find({
                        isActive: true
                    })
                        .sort({
                            name: 1
                        })
                        .lean();

                if (!categories.length) {
                    await ctx.reply(
                        "❌ Kategoriyalar mavjud emas."
                    );

                    return true;
                }

                const buttons =
                    categories.map(
                        category => [
                            Markup.button.callback(
                                `📂 ${category.name}`,
                                `admin:edit-category:${category._id}:${state.productId}`
                            )
                        ]
                    );

                buttons.push([
                    Markup.button.callback(
                        "❌ Bekor qilish",
                        "admin:edit-cancel"
                    )
                ]);

                // Diqqat: bu yerdan keyin javob endi
                // bot.js'dagi bot.action("admin:edit-category:...")
                // va bot.action("admin:edit-cancel") orqali davom etadi
                // (avval bu handlerlar yo'q edi — endi qo'shildi).
                await ctx.reply(
                    "📂 Yangi kategoriyani tanlang:",
                    Markup.inlineKeyboard(
                        buttons
                    )
                );

                return true;
            }

            state.step = "value";

            setAdminState(
                userId,
                state
            );

            if (
                state.field ===
                "availability"
            ) {

                await ctx.reply(
                    "📦 Mahsulot holatini tanlang:",

                    Markup.keyboard([
                        ["✅ Mavjud"],
                        ["❌ Mavjud emas"],
                        ["⬅️ Bekor qilish"]
                    ]).resize()
                );

                return true;
            }

            await ctx.reply(
                "✏️ Yangi qiymatni yuboring:"
            );

            return true;
        }

        // VALUE
        if (
            state.step ===
            "value"
        ) {

            if (
                text ===
                "⬅️ Bekor qilish"
            ) {

                clearAdminState(
                    userId
                );

                return ctx.reply(
                    "❌ Bekor qilindi.",
                    productKeyboard()
                );
            }

            const product =
                await Product.findById(
                    state.productId
                );

            if (!product) {

                clearAdminState(
                    userId
                );

                await ctx.reply(
                    "❌ Mahsulot topilmadi.",
                    productKeyboard()
                );

                return true;
            }

            if (
                state.field ===
                "name"
            ) {
                product.name =
                    text;
            }

            if (
                state.field ===
                "description"
            ) {
                product.description =
                    text === "—"
                        ? ""
                        : text;
            }

            if (
                state.field ===
                "price"
            ) {

                const price =
                    Number(
                        text.replace(
                            /\s/g,
                            ""
                        )
                    );

                if (
                    !Number.isFinite(
                        price
                    ) ||
                    price <= 0
                ) {
                    await ctx.reply(
                        "❌ Narx noto‘g‘ri."
                    );

                    return true;
                }

                product.price =
                    price;
            }

            if (
                state.field ===
                "discountPrice"
            ) {

                const price =
                    Number(
                        text.replace(
                            /\s/g,
                            ""
                        )
                    );

                if (
                    !Number.isFinite(
                        price
                    ) ||
                    price < 0
                ) {
                    await ctx.reply(
                        "❌ Chegirma narxi noto‘g‘ri."
                    );

                    return true;
                }

                if (
                    price > 0 &&
                    price >=
                    product.price
                ) {
                    await ctx.reply(
                        "❌ Chegirma narxi oddiy narxdan kichik bo‘lishi kerak."
                    );

                    return true;
                }

                product.discountPrice =
                    price > 0
                        ? price
                        : null;
            }

            if (
                state.field ===
                "availability"
            ) {

                if (
                    text ===
                    "✅ Mavjud"
                ) {
                    product.isAvailable =
                        true;
                } else if (
                    text ===
                    "❌ Mavjud emas"
                ) {
                    product.isAvailable =
                        false;
                } else {
                    await ctx.reply(
                        "❌ Tugmalardan birini tanlang."
                    );

                    return true;
                }
            }

            await product.save();

            clearAdminState(
                userId
            );

            await ctx.reply(
                `✅ "${product.name}" muvaffaqiyatli yangilandi.`,
                productKeyboard()
            );

            return true;
        }
    }

    return false;
}

// =====================================================
// SHOW PRODUCTS
// =====================================================

async function showProductsAdmin(ctx) {
    if (ctx.state.user.role !== "admin") {
        return ctx.reply(
            "❌ Faqat adminlar uchun."
        );
    }

    const products =
        await Product.find({})
            .populate(
                "categoryId",
                "name"
            )
            .sort({
                createdAt: -1
            })
            .lean();

    if (!products.length) {
        return ctx.reply(
            "🍕 Mahsulotlar mavjud emas.\n\n" +
            "➕ Mahsulot qo‘shish tugmasini bosing.",
            productKeyboard()
        );
    }

    let text =
        "🍕 MAHSULOTLAR RO‘YXATI\n\n";

    products.forEach(
        (product, index) => {

            const price =
                Number(
                    product.discountPrice ??
                    product.price
                ).toLocaleString(
                    "uz-UZ"
                );

            text +=
                `${index + 1}. ${product.name}\n` +
                `📂 ${product.categoryId?.name ??
                "Kategoriya yo‘q"
                }\n` +
                `💰 ${price} so‘m\n` +
                `📌 ${product.isActive
                    ? "Faol"
                    : "Nofaol"
                }\n` +
                `📦 ${product.isAvailable
                    ? "Mavjud"
                    : "Mavjud emas"
                }\n\n`;
        }
    );

    return ctx.reply(
        text,
        productKeyboard()
    );
}

// =====================================================
// OPEN PRODUCT ADMIN
// =====================================================

async function openProductAdmin(ctx) {
    if (ctx.state.user.role !== "admin") {
        return ctx.reply(
            "❌ Faqat adminlar uchun."
        );
    }

    clearAdminState(
        ctx.state.user._id
    );

    return ctx.reply(
        "🍕 MAHSULOTLAR\n\n" +
        "Mahsulotlarni qo‘shish, o‘zgartirish va o‘chirish bo‘limi.",
        productKeyboard()
    );
}

// =====================================================
// DELETE PRODUCT START
// =====================================================

async function startDeleteProduct(ctx) {
    if (ctx.state.user.role !== "admin") {
        return ctx.reply(
            "❌ Faqat adminlar uchun."
        );
    }

    const products =
        await Product.find({
            isActive: true
        })
            .sort({
                name: 1
            })
            .lean();

    if (!products.length) {
        return ctx.reply(
            "❌ O‘chirish uchun mahsulot yo‘q.",
            productKeyboard()
        );
    }

    let text =
        "🗑 MAHSULOT O‘CHIRISH\n\n" +
        "Mahsulot raqamini yuboring:\n\n";

    products.forEach(
        (product, index) => {
            text +=
                `${index + 1}. ${product.name}\n`;
        }
    );

    setAdminState(
        ctx.state.user._id,
        {
            action:
                "delete_product",

            products:
                products.map(
                    product =>
                        product._id.toString()
                )
        }
    );

    return ctx.reply(text);
}

// =====================================================
// EDIT PRODUCT START
// =====================================================

async function startEditProduct(ctx) {
    if (ctx.state.user.role !== "admin") {
        return ctx.reply(
            "❌ Faqat adminlar uchun."
        );
    }

    const products =
        await Product.find({})
            .sort({
                name: 1
            })
            .lean();

    if (!products.length) {
        return ctx.reply(
            "❌ Mahsulotlar mavjud emas.",
            productKeyboard()
        );
    }

    let text =
        "✏️ MAHSULOT TAHRIRLASH\n\n" +
        "Mahsulot raqamini yuboring:\n\n";

    products.forEach(
        (product, index) => {
            text +=
                `${index + 1}. ${product.name}\n`;
        }
    );

    setAdminState(
        ctx.state.user._id,
        {
            action:
                "edit_product",

            step:
                "select",

            products:
                products.map(
                    product => ({
                        id:
                            product._id.toString(),

                        name:
                            product.name
                    })
                )
        }
    );

    return ctx.reply(text);
}

// =====================================================
// STATISTICS
// =====================================================

async function showStatistics(ctx) {
    if (
        ctx.state.user.role !==
        "admin" &&
        ctx.state.user.role !==
        "operator"
    ) {
        return ctx.reply(
            "❌ Sizda statistika ko‘rish huquqi yo‘q."
        );
    }

    const [
        totalProducts,
        activeProducts,
        totalCategories,
        totalUsers,
        customers,
        blockedUsers
    ] = await Promise.all([
        Product.countDocuments({}),

        Product.countDocuments({
            isActive: true,
            isAvailable: true
        }),

        Category.countDocuments({
            isActive: true
        }),

        User.countDocuments({}),

        User.countDocuments({
            role: "customer"
        }),

        User.countDocuments({
            isBlocked: true
        })
    ]);

    return ctx.reply(
        "📊 STATISTIKA\n\n" +
        `🍕 Jami mahsulotlar: ${totalProducts}\n` +
        `✅ Faol mahsulotlar: ${activeProducts}\n` +
        `📂 Kategoriyalar: ${totalCategories}\n\n` +
        `👥 Jami foydalanuvchilar: ${totalUsers}\n` +
        `🛒 Mijozlar: ${customers}\n` +
        `🚫 Bloklanganlar: ${blockedUsers}`
    );
}

// =====================================================
// EXPORT
// =====================================================

module.exports = {
    openProductAdmin,

    startAddProduct,
    selectProductCategory,
    cancelAddProduct,

    showProductsAdmin,

    startDeleteProduct,

    startEditProduct,

    handleAdminText,

    showStatistics,

    productKeyboard,
    adminKeyboard,

    showCategoriesAdmin,
    startAddCategory,

    startDeleteCategory,
    handleDeleteCategory,

    // yangi qo'shilgan — mahsulotni tahrirlashda
    // kategoriya tanlash bosqichini yakunlaydi
    selectEditCategory,
    cancelEditProduct,

    categoryKeyboard,

    getAdminState,
    setAdminState,
    clearAdminState
};