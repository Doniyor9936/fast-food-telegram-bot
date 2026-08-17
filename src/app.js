const express = require("express");
const helmet = require("helmet");
const { connectDatabase } = require("./config/database");
const { port } = require("./config/env");
const adminRoutes = require("./admin/routes");
const { startBot } = require("./bot/bot");

async function bootstrap() {
  await connectDatabase();

  const app = express();
  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (req, res) => {
    res.json({ name: "Fast Food Telegram Bot", status: "running" });
  });

  app.get("/health", (req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), time: new Date().toISOString() });
  });

  app.use("/api/admin", adminRoutes);

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  });

  app.listen(port, () => {
    console.log(`🚀 HTTP server: http://localhost:${port}`);
  });

  await startBot();
}

bootstrap().catch(error => {
  console.error("❌ Application startup failed:", error);
  process.exit(1);
});
