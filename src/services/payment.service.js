async function createOnlinePayment({ order }) {
  // Real payment provider integration should be implemented here.
  // The bot deliberately does not fake a successful payment.
  return {
    status: "pending",
    paymentUrl: null,
    message: "Online to‘lov provayderi hali ulanmagan."
  };
}

module.exports = { createOnlinePayment };
