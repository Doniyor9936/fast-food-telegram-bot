const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Payment = require("../models/Payment");
const Cart = require("../models/Cart");
const PromoCode = require("../models/PromoCode");
const { generateOrderNumber } = require("../utils/order-number");
const { getCartDetailed } = require("./cart.service");

const DELIVERY_FEE = 15000;
const FREE_DELIVERY_FROM = 300000;

function calculateDiscount(promo, subtotal) {
  if (!promo) return 0;
  if (subtotal < promo.minOrder) return 0;

  let discount = promo.type === "percent"
    ? subtotal * (promo.value / 100)
    : promo.value;

  if (promo.maxDiscount != null) discount = Math.min(discount, promo.maxDiscount);
  return Math.min(Math.max(0, discount), subtotal);
}

async function createOrder({ user, checkout }) {
  const session = await mongoose.startSession();
  try {
    let createdOrder;

    await session.withTransaction(async () => {
      const cartData = await getCartDetailed(user._id);
      if (!cartData.items.length) throw new Error("Savat bo‘sh");

      const deliveryType = checkout.deliveryType;
      if (deliveryType === "delivery" && !checkout.address?.address && !checkout.location?.latitude) {
        throw new Error("Yetkazib berish manzili kerak");
      }

      const subtotal = cartData.subtotal;

      let promo = null;
      if (checkout.promoCode) {
        promo = await PromoCode.findOne({
          code: checkout.promoCode.toUpperCase(),
          isActive: true,
          $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
        }).session(session);

        if (!promo) throw new Error("Promokod yaroqsiz");
        if (promo.usageLimit != null && promo.usedCount >= promo.usageLimit) throw new Error("Promokod limiti tugagan");
      }

      const discount = calculateDiscount(promo, subtotal);
      const deliveryFee = deliveryType === "pickup" ? 0 : (subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_FEE);
      const total = subtotal - discount + deliveryFee;

      const items = cartData.items.map(i => ({
        productId: i.product._id,
        name: i.product.name,
        image: i.product.image,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        totalPrice: i.totalPrice,
        variant: i.variant ? { name: i.variant.name, price: i.variant.price } : undefined,
        addons: i.addons.map(a => ({ id: a.addonId, name: a.name, price: a.price }))
      }));

      const [order] = await Order.create([{
        orderNumber: generateOrderNumber(),
        userId: user._id,
        items,
        subtotal,
        deliveryFee,
        discount,
        total,
        paymentMethod: checkout.paymentMethod,
        paymentStatus: checkout.paymentMethod === "cash" ? "pending" : "pending",
        deliveryType,
        address: checkout.address,
        location: checkout.location,
        comment: checkout.comment,
        status: "NEW",
        statusHistory: [{ status: "NEW", note: "Order created" }]
      }], { session });

      await Payment.create([{
        orderId: order._id,
        amount: total,
        currency: "UZS",
        provider: checkout.paymentMethod,
        status: "pending"
      }], { session });

      for (const item of items) {
        await Product.updateOne(
          { _id: item.productId },
          { $inc: { soldCount: item.quantity } },
          { session }
        );
      }

      await Cart.updateOne({ userId: user._id }, { $set: { items: [] } }, { session });

      if (promo) await PromoCode.updateOne({ _id: promo._id }, { $inc: { usedCount: 1 } }, { session });

      createdOrder = order;
    });

    return createdOrder;
  } finally {
    await session.endSession();
  }
}

async function changeOrderStatus(orderId, status, actorId, note = "") {
  const allowed = {
    NEW: ["ACCEPTED", "CANCELLED"],
    ACCEPTED: ["PREPARING", "CANCELLED"],
    PREPARING: ["READY", "CANCELLED"],
    READY: ["COURIER_ASSIGNED", "ON_THE_WAY", "COMPLETED"],
    COURIER_ASSIGNED: ["ON_THE_WAY"],
    ON_THE_WAY: ["DELIVERED"],
    DELIVERED: ["COMPLETED"],
    COMPLETED: [],
    CANCELLED: []
  };

  const order = await Order.findById(orderId);
  if (!order) throw new Error("Buyurtma topilmadi");
  if (!allowed[order.status]?.includes(status)) {
    throw new Error(`Status ${order.status} -> ${status} ga o‘zgartirilmaydi`);
  }

  order.status = status;
  order.statusHistory.push({ status, byUserId: actorId || undefined, note });

  if (status === "ACCEPTED") order.acceptedAt = new Date();
  if (status === "COMPLETED" || status === "DELIVERED") order.completedAt = new Date();
  if (status === "CANCELLED") order.cancelledAt = new Date();

  await order.save();
  return order;
}

module.exports = { createOrder, changeOrderStatus, calculateDiscount, DELIVERY_FEE, FREE_DELIVERY_FROM };
