const User = require("../../models/User");

async function ensureUser(ctx) {
  const from = ctx.from;

  if (!from) {
    throw new Error("Telegram user topilmadi");
  }

  const telegramId = String(from.id);

  let user = await User.findOne({
    telegramId
  });

  if (!user) {
    user = await User.create({
      telegramId,
      username: from.username || "",
      firstName: from.first_name || "",
      lastName: from.last_name || "",
      role: "customer",
      lastActivityAt: new Date()
    });

    console.log("👤 Yangi user yaratildi:", {
      telegramId,
      role: user.role
    });
  } else {
    /*
     * MUHIM:
     * Bu yerda role'ga tegmaymiz.
     *
     * Agar MongoDB'da role = admin bo'lsa,
     * admin bo'lib qoladi.
     */

    user.username = from.username || "";
    user.firstName = from.first_name || "";
    user.lastName = from.last_name || "";
    user.lastActivityAt = new Date();

    await user.save();

    console.log("👤 Mavjud user:", {
      telegramId: user.telegramId,
      role: user.role
    });
  }

  return user;
}

module.exports = {
  ensureUser
};