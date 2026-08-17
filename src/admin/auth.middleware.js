const { adminApiKey } = require("../config/env");

function adminAuth(req, res, next) {
  if (!adminApiKey) {
    return res.status(503).json({ message: "ADMIN_API_KEY sozlanmagan" });
  }
  if (req.headers["x-admin-key"] !== adminApiKey) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

module.exports = { adminAuth };
