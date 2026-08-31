// settings.js
// "⚙️ Sozlamalar" bo'limi: ish vaqti, yetkazib berish narxi/hududi,
// adminlar ro'yxati, do'kon nomi/tavsifi.
//
// TALAB QILINADIGAN PAKETLAR:
//   npm install mongoose
//
// INTEGRATSIYA (bot.js ichida):
//   const { registerSettings } = require('./settings');
//   registerSettings(bot, isAdmin);
//
// Eslatma: `isAdmin(ctx)` funksiyangiz sizda allaqachon bor,
// shuni shu yerga argument sifatida uzatasiz.

const mongoose = require('mongoose');

// ------------------------------------------------------------------
// 1) MODELLAR
// ------------------------------------------------------------------

// Umumiy sozlamalar (ish vaqti, yetkazib berish, do'kon ma'lumoti)
// key-value ko'rinishida saqlanadi, shu bilan kelajakda yangi
// sozlama qo'shish oson bo'ladi.
const settingSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);

// Adminlar ro'yxati (asosiy .env dagi ADMIN_ID dan tashqari,
// botdan qo'shiladigan qo'shimcha adminlar)
const adminSchema = new mongoose.Schema({
    telegramId: { type: Number, required: true, unique: true },
    username: String,
    addedBy: Number,
    addedAt: { type: Date, default: Date.now },
});

const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);

// ------------------------------------------------------------------
// 2) YORDAMCHI FUNKSIYALAR
// ------------------------------------------------------------------

async function getSetting(key, defaultValue = null) {
    const doc = await Setting.findOne({ key });
    return doc ? doc.value : defaultValue;
}

async function setSetting(key, value) {
    return Setting.findOneAndUpdate(
        { key },
        { value },
        { upsert: true, new: true }
    );
}

// Foydalanuvchi keyingi xabari qanday "kutilayotgan amal" ekanini
// vaqtincha xotirada saqlaymiz (soddalik uchun scene ishlatmaymiz).
// Katta/production loyihada buni Redis yoki sessiyaga ko'chirish tavsiya etiladi.
const awaitingInput = new Map(); // key: telegram user id, value: amal nomi

// ------------------------------------------------------------------
// 3) ASOSIY SOZLAMALAR MENYUSI
// ------------------------------------------------------------------

function settingsMenuKeyboard() {
    return {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '⏰ Ish vaqti', callback_data: 'settings_hours' },
                    { text: '🚚 Yetkazib berish', callback_data: 'settings_delivery' },
                ],
                [
                    { text: '👤 Adminlar', callback_data: 'settings_admins' },
                    { text: '🏪 Do\'kon ma\'lumoti', callback_data: 'settings_shop' },
                ],
            ],
        },
    };
}

function registerSettings(bot, isAdmin) {
    // ---- Asosiy menyu ----
    bot.hears('⚙️ Sozlamalar', async (ctx) => {
        if (!isAdmin(ctx)) {
            return ctx.reply('❌ Faqat adminlar uchun.');
        }
        return ctx.reply(
            '⚙️ SOZLAMALAR\n\nKerakli bo\'limni tanlang:',
            settingsMenuKeyboard()
        );
    });

    // =====================================================
    // A) ISH VAQTI
    // =====================================================
    bot.action('settings_hours', async (ctx) => {
        if (!isAdmin(ctx)) return ctx.answerCbQuery('❌ Ruxsat yo\'q');
        await ctx.answerCbQuery();

        const hours = await getSetting('workHours', { open: '09:00', close: '22:00' });

        return ctx.editMessageText(
            `⏰ ISH VAQTI\n\n` +
            `Hozirgi vaqt: ${hours.open} — ${hours.close}\n\n` +
            `Yangi vaqtni "09:00-22:00" formatida yozing:`,
            {
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 Orqaga', callback_data: 'settings_back' }]],
                },
            }
        );
    });

    bot.action('settings_back', async (ctx) => {
        await ctx.answerCbQuery();
        awaitingInput.delete(ctx.from.id);
        return ctx.editMessageText(
            '⚙️ SOZLAMALAR\n\nKerakli bo\'limni tanlang:',
            settingsMenuKeyboard()
        );
    });

    // "09:00-22:00" formatini kutayotgan holatni belgilash uchun
    // yuqoridagi tugmadan keyin foydalanuvchi shu holatga tushadi:
    bot.action('settings_hours', async (ctx, next) => {
        awaitingInput.set(ctx.from.id, 'awaiting_hours');
        return next ? next() : undefined;
    });

    // =====================================================
    // B) YETKAZIB BERISH NARXI / HUDUDI
    // =====================================================
    bot.action('settings_delivery', async (ctx) => {
        if (!isAdmin(ctx)) return ctx.answerCbQuery('❌ Ruxsat yo\'q');
        await ctx.answerCbQuery();

        const delivery = await getSetting('delivery', { price: 15000, zones: 'Butun shahar' });

        awaitingInput.set(ctx.from.id, 'awaiting_delivery');

        return ctx.editMessageText(
            `🚚 YETKAZIB BERISH\n\n` +
            `Narx: ${delivery.price} so'm\n` +
            `Hudud: ${delivery.zones}\n\n` +
            `Yangi qiymatni "narx;hudud" formatida yozing.\n` +
            `Masalan: 15000;Toshkent shahri`,
            {
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 Orqaga', callback_data: 'settings_back' }]],
                },
            }
        );
    });

    // =====================================================
    // C) DO'KON MA'LUMOTI (nomi, tavsifi)
    // =====================================================
    bot.action('settings_shop', async (ctx) => {
        if (!isAdmin(ctx)) return ctx.answerCbQuery('❌ Ruxsat yo\'q');
        await ctx.answerCbQuery();

        const shop = await getSetting('shopInfo', { name: 'Pizza Bot', description: '' });

        awaitingInput.set(ctx.from.id, 'awaiting_shop');

        return ctx.editMessageText(
            `🏪 DO'KON MA'LUMOTI\n\n` +
            `Nomi: ${shop.name}\n` +
            `Tavsifi: ${shop.description || '(kiritilmagan)'}\n\n` +
            `Yangi qiymatni "nomi;tavsifi" formatida yozing.\n` +
            `Masalan: Lazzat Pizza;Eng mazali pitsalar shahringizda`,
            {
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 Orqaga', callback_data: 'settings_back' }]],
                },
            }
        );
    });

    // =====================================================
    // D) ADMINLAR RO'YXATI
    // =====================================================
    bot.action('settings_admins', async (ctx) => {
        if (!isAdmin(ctx)) return ctx.answerCbQuery('❌ Ruxsat yo\'q');
        await ctx.answerCbQuery();

        const admins = await Admin.find().sort({ addedAt: -1 });
        const list = admins.length
            ? admins.map((a, i) => `${i + 1}. ${a.username ? '@' + a.username : a.telegramId}`).join('\n')
            : '(qo\'shimcha adminlar yo\'q)';

        awaitingInput.set(ctx.from.id, 'awaiting_admin_add');

        return ctx.editMessageText(
            `👤 ADMINLAR\n\n${list}\n\n` +
            `Yangi admin qo'shish uchun uning Telegram ID raqamini yuboring.\n` +
            `O'chirish uchun: "o'chir 123456789" deb yozing.`,
            {
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 Orqaga', callback_data: 'settings_back' }]],
                },
            }
        );
    });

    // =====================================================
    // MATNLI JAVOBLARNI QAYTA ISHLASH
    // (yuqoridagi barcha "kiriting" so'rovlariga javob shu yerda tutiladi)
    // =====================================================
    bot.on('text', async (ctx, next) => {
        const state = awaitingInput.get(ctx.from.id);
        if (!state || !isAdmin(ctx)) return next(); // boshqa handlerlarga o'tkazamiz

        const text = ctx.message.text.trim();

        try {
            if (state === 'awaiting_hours') {
                const match = text.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
                if (!match) {
                    return ctx.reply('❌ Format noto\'g\'ri. Masalan: 09:00-22:00');
                }
                await setSetting('workHours', { open: match[1], close: match[2] });
                awaitingInput.delete(ctx.from.id);
                return ctx.reply(`✅ Ish vaqti yangilandi: ${match[1]} — ${match[2]}`);
            }

            if (state === 'awaiting_delivery') {
                const [price, zones] = text.split(';').map(s => s.trim());
                if (!price || isNaN(Number(price))) {
                    return ctx.reply('❌ Format noto\'g\'ri. Masalan: 15000;Toshkent shahri');
                }
                await setSetting('delivery', { price: Number(price), zones: zones || 'Belgilanmagan' });
                awaitingInput.delete(ctx.from.id);
                return ctx.reply(`✅ Yetkazib berish yangilandi: ${price} so'm, ${zones}`);
            }

            if (state === 'awaiting_shop') {
                const [name, description] = text.split(';').map(s => s.trim());
                if (!name) {
                    return ctx.reply('❌ Format noto\'g\'ri. Masalan: Lazzat Pizza;Eng mazali pitsalar');
                }
                await setSetting('shopInfo', { name, description: description || '' });
                awaitingInput.delete(ctx.from.id);
                return ctx.reply(`✅ Do'kon ma'lumoti yangilandi: ${name}`);
            }

            if (state === 'awaiting_admin_add') {
                if (text.toLowerCase().startsWith("o'chir") || text.toLowerCase().startsWith('ochir')) {
                    const id = Number(text.replace(/[^\d]/g, ''));
                    if (!id) return ctx.reply('❌ ID topilmadi. Masalan: o\'chir 123456789');
                    await Admin.deleteOne({ telegramId: id });
                    return ctx.reply(`✅ Admin o'chirildi: ${id}`);
                }

                const id = Number(text);
                if (!id || isNaN(id)) {
                    return ctx.reply('❌ Telegram ID raqam bo\'lishi kerak.');
                }
                await Admin.findOneAndUpdate(
                    { telegramId: id },
                    { telegramId: id, addedBy: ctx.from.id },
                    { upsert: true }
                );
                return ctx.reply(`✅ Admin qo'shildi: ${id}`);
            }
        } catch (err) {
            console.error('Sozlamalarni yangilashda xatolik:', err);
            return ctx.reply('❌ Xatolik yuz berdi, qaytadan urinib ko\'ring.');
        }

        return next();
    });
}

module.exports = { registerSettings, getSetting, setSetting, Admin, Setting };