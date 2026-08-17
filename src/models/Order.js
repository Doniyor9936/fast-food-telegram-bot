const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  name: String,
  image: String,
  quantity: Number,
  unitPrice: Number,
  totalPrice: Number,
  variant: {
    id: mongoose.Schema.Types.ObjectId,
    name: String,
    price: Number
  },
  addons: [{
    id: mongoose.Schema.Types.ObjectId,
    name: String,
    price: Number
  }]
}, { _id: true });

const addressSchema = new mongoose.Schema({
  address: String,
  latitude: Number,
  longitude: Number,
  apartment: String,
  entrance: String,
  floor: String,
  comment: String
}, { _id: false });

const schema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  items: [orderItemSchema],
  subtotal: { type: Number, required: true },
  deliveryFee: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  paymentMethod: { type: String, enum: ["cash", "card", "online"], required: true },
  paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded", "cancelled"], default: "pending" },
  deliveryType: { type: String, enum: ["delivery", "pickup"], required: true },
  address: addressSchema,
  location: {
    latitude: Number,
    longitude: Number
  },
  status: {
    type: String,
    enum: ["NEW", "ACCEPTED", "PREPARING", "READY", "COURIER_ASSIGNED", "ON_THE_WAY", "DELIVERED", "COMPLETED", "CANCELLED"],
    default: "NEW",
    index: true
  },
  courierId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  operatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  comment: String,
  statusHistory: [{
    status: String,
    byUserId: mongoose.Schema.Types.ObjectId,
    note: String,
    createdAt: { type: Date, default: Date.now }
  }],
  acceptedAt: Date,
  completedAt: Date,
  cancelledAt: Date
}, { timestamps: true });

schema.index({ createdAt: -1 });
schema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Order", schema);
