const mongoose = require("mongoose");
const { mongoUri } = require("./env");

async function connectDatabase() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000
  });
  console.log("✅ MongoDB connected");
}

module.exports = { connectDatabase };
