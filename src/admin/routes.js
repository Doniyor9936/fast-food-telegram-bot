const express = require("express");
const Category = require("../models/Category");
const Product = require("../models/Product");
const User = require("../models/User");
const Order = require("../models/Order");
const PromoCode = require("../models/PromoCode");
const { adminAuth } = require("./auth.middleware");
const { changeOrderStatus } = require("../services/order.service");

const router = express.Router();
router.use(adminAuth);

router.get("/dashboard", async (req, res, next) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [orders, revenue, customers, newOrders] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: start } }),
      Order.aggregate([{ $match: { createdAt: { $gte: start }, status: { $nin: ["CANCELLED"] } } }, { $group: { _id: null, total: { $sum: "$total" } } }]),
      User.countDocuments({ role: "customer" }),
      Order.countDocuments({ status: "NEW" })
    ]);
    res.json({
      ordersToday: orders,
      revenueToday: revenue[0]?.total || 0,
      customers,
      newOrders
    });
  } catch (e) { next(e); }
});

router.get("/orders", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      filter.$or = [
        { orderNumber: { $regex: req.query.search, $options: "i" } }
      ];
    }
    const [data, total] = await Promise.all([
      Order.find(filter).populate("userId", "firstName lastName phone username").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Order.countDocuments(filter)
    ]);
    res.json({ data, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (e) { next(e); }
});

router.get("/orders/:id", async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate("userId").populate("courierId");
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (e) { next(e); }
});

router.patch("/orders/:id/status", async (req, res, next) => {
  try {
    const order = await changeOrderStatus(req.params.id, req.body.status, null, req.body.note || "");
    res.json(order);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

router.get("/categories", async (req, res, next) => {
  try { res.json(await Category.find().sort({ sortOrder: 1, name: 1 })); } catch (e) { next(e); }
});

router.post("/categories", async (req, res, next) => {
  try { res.status(201).json(await Category.create(req.body)); } catch (e) { next(e); }
});

router.patch("/categories/:id", async (req, res, next) => {
  try { res.json(await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })); } catch (e) { next(e); }
});

router.delete("/categories/:id", async (req, res, next) => {
  try { res.json(await Category.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true })); } catch (e) { next(e); }
});

router.get("/products", async (req, res, next) => {
  try { res.json(await Product.find().populate("categoryId").sort({ sortOrder: 1, name: 1 })); } catch (e) { next(e); }
});

router.post("/products", async (req, res, next) => {
  try { res.status(201).json(await Product.create(req.body)); } catch (e) { next(e); }
});

router.patch("/products/:id", async (req, res, next) => {
  try { res.json(await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })); } catch (e) { next(e); }
});

router.delete("/products/:id", async (req, res, next) => {
  try { res.json(await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true })); } catch (e) { next(e); }
});

router.get("/users", async (req, res, next) => {
  try { res.json(await User.find().sort({ createdAt: -1 }).limit(1000)); } catch (e) { next(e); }
});

router.get("/promocodes", async (req, res, next) => {
  try { res.json(await PromoCode.find().sort({ createdAt: -1 })); } catch (e) { next(e); }
});

router.post("/promocodes", async (req, res, next) => {
  try { res.status(201).json(await PromoCode.create(req.body)); } catch (e) { next(e); }
});

router.patch("/promocodes/:id", async (req, res, next) => {
  try { res.json(await PromoCode.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })); } catch (e) { next(e); }
});

module.exports = router;
