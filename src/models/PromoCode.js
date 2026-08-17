const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, enum: ["fixed", "percent"], required: true },
  value: { type: Number, required: true, min: 0 },
  minOrder: { type: Number, default: 0 },
  maxDiscount: { type: Number, default: null },
  usageLimit: { type: Number, default: null },
  usedCount: { type: Number, default: 0 },
  expiresAt: Date,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("PromoCode", schema);
