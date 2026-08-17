const dotenv = require("dotenv");
dotenv.config();

const required = ["BOT_TOKEN", "MONGODB_URI"];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing environment variable: ${key}`);
  }
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  botToken: process.env.BOT_TOKEN,
  mongoUri: process.env.MONGODB_URI,
  adminChatId: process.env.ADMIN_CHAT_ID || "",
  adminApiKey: process.env.ADMIN_API_KEY || "",
  webhookDomain: process.env.WEBHOOK_DOMAIN || "",
  webhookSecret: process.env.WEBHOOK_SECRET || "",
  jwtSecret: process.env.JWT_SECRET || "change-me"
};
