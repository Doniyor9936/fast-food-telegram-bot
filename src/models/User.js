const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  label: { type: String, default: "Asosiy" },
  address: { type: String, required: true },
  latitude: Number,
  longitude: Number,
  apartment: String,
  entrance: String,
  floor: String,
  comment: String
}, { _id: true });

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true, index: true },
  username: String,
  firstName: String,
  lastName: String,
  phone: String,
  role: { type: String, enum: ["customer", "admin", "operator", "courier"], default: "customer" },
  addresses: [addressSchema],
  isBlocked: { type: Boolean, default: false },
  lastActivityAt: Date
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
