const { bot } = require("../../src/bot/bot");
const { connectDatabase } = require("../../src/config/database");

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({
            ok: false,
            message: "Method Not Allowed"
        });
    }

    try {
        await connectDatabase();

        await bot.handleUpdate(req.body);

        return res.status(200).json({
            ok: true
        });
    } catch (error) {
        console.error("❌ Telegram webhook error:", error);

        return res.status(500).json({
            ok: false,
            message: "Webhook error"
        });
    }
};