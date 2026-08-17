async function safeSend(bot, chatId, text, extra = {}) {
  if (!chatId) return null;
  try {
    return await bot.telegram.sendMessage(chatId, text, extra);
  } catch (error) {
    console.error("Telegram send error:", error.message);
    return null;
  }
}

module.exports = { safeSend };
