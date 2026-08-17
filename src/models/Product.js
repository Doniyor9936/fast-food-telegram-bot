const mongoose = require("mongoose");

const addonSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 }
}, { _id: true });

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 }
}, { _id: true });

const schema = new mongoose.Schema({
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: String,
  image: String,
  price: { type: Number, required: true, min: 0 },
  discountPrice: { type: Number, min: 0, default: null },
  variants: [variantSchema],
  addons: [addonSchema],
  isAvailable: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  soldCount: { type: Number, default: 0 }
}, { timestamps: true });

schema.index({ categoryId: 1, isActive: 1, isAvailable: 1 });
schema.index({ name: "text", description: "text" });

schema.virtual("currentPrice").get(function () {
  return this.discountPrice ?? this.price;
});

module.exports = mongoose.model("Product", schema);
