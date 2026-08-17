const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  quantity: { type: Number, required: true, min: 1, max: 99 },
  variantId: mongoose.Schema.Types.ObjectId,
  variantName: String,
  variantPrice: { type: Number, default: 0 },
  addons: [{
    addonId: mongoose.Schema.Types.ObjectId,
    name: String,
    price: Number
  }]
}, { _id: true });

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, index: true },
  items: [cartItemSchema]
}, { timestamps: true });

module.exports = mongoose.model("Cart", schema);
