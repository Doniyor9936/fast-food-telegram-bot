const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: "UZS" },
  provider: { type: String, default: "cash" },
  transactionId: String,
  status: { type: String, enum: ["pending", "paid", "failed", "refunded", "cancelled"], default: "pending" },
  paidAt: Date
}, { timestamps: true });

module.exports = mongoose.model("Payment", schema);
