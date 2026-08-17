const Cart = require("../models/Cart");
const Product = require("../models/Product");

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ userId });
  if (!cart) cart = await Cart.create({ userId, items: [] });
  return cart;
}

async function addToCart(userId, productId, quantity = 1) {
  const product = await Product.findOne({ _id: productId, isActive: true, isAvailable: true });
  if (!product) throw new Error("Mahsulot mavjud emas");

  const cart = await getOrCreateCart(userId);
  const item = cart.items.find(i => String(i.productId) === String(productId) && !i.variantId && i.addons.length === 0);

  if (item) item.quantity = Math.min(99, item.quantity + quantity);
  else cart.items.push({ productId, quantity });

  await cart.save();
  return cart;
}

async function clearCart(userId) {
  return Cart.findOneAndUpdate({ userId }, { $set: { items: [] } }, { new: true });
}

async function removeItem(userId, itemId) {
  const cart = await getOrCreateCart(userId);
  cart.items = cart.items.filter(i => String(i._id) !== String(itemId));
  await cart.save();
  return cart;
}

async function changeQuantity(userId, itemId, delta) {
  const cart = await getOrCreateCart(userId);
  const item = cart.items.id(itemId);
  if (!item) throw new Error("Savat mahsuloti topilmadi");
  item.quantity += delta;
  if (item.quantity <= 0) item.deleteOne();
  if (item.quantity > 99) item.quantity = 99;
  await cart.save();
  return cart;
}

async function getCartDetailed(userId) {
  const cart = await Cart.findOne({ userId }).lean();
  if (!cart) return { items: [], subtotal: 0 };

  const result = [];
  let subtotal = 0;

  for (const item of cart.items) {
    const product = await Product.findById(item.productId).lean();
    if (!product || !product.isActive || !product.isAvailable) continue;

    const base = product.discountPrice ?? product.price;
    const variantPrice = item.variantPrice || 0;
    const addons = (item.addons || []).reduce((s, a) => s + Number(a.price || 0), 0);
    const unit = base + variantPrice + addons;
    const total = unit * item.quantity;
    subtotal += total;

    result.push({
      cartItemId: item._id,
      product,
      quantity: item.quantity,
      variant: item.variantName ? { name: item.variantName, price: variantPrice } : null,
      addons: item.addons || [],
      unitPrice: unit,
      totalPrice: total
    });
  }

  return { items: result, subtotal };
}

module.exports = { getOrCreateCart, addToCart, clearCart, removeItem, changeQuantity, getCartDetailed };
