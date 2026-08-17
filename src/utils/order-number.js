function generateOrderNumber() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(10000 + Math.random() * 90000);
  return `LAVA-${date}-${random}`;
}

module.exports = { generateOrderNumber };
