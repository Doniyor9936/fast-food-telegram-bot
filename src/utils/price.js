function money(value) {
  return `${new Intl.NumberFormat("uz-UZ").format(Math.round(value))} so'm`;
}

function calculateLineTotal(unitPrice, quantity, addons = []) {
  const addonTotal = addons.reduce((sum, addon) => sum + Number(addon.price || 0), 0);
  return (Number(unitPrice) + addonTotal) * quantity;
}

module.exports = { money, calculateLineTotal };
