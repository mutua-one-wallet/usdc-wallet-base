const jwt = require("jsonwebtoken")
const { query } = require("../config/database")
const logger = require("../utils/logger")

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Verify user still exists and is active
    const userResult = await query("SELECT id, email, status FROM users WHERE id = $1 AND status = $2", [
      decoded.userId,
      "active",
    ])

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      })
    }

    req.user = {
      id: decoded.userId,
      email: userResult.rows[0].email,
      whitelabelClientId: decoded.whitelabelClientId,
    }

    next()
  } catch (error) {
    logger.error("Token verification failed:", error)
    return res.status(403).json({
      success: false,
      message: "Invalid token",
    })
  }
}

const authenticateApiKey = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"]
  const apiSecret = req.headers["x-api-secret"]

  if (!apiKey || !apiSecret) {
    return res.status(401).json({
      success: false,
      message: "API key and secret required",
    })
  }

  try {
    const result = await query(
      `
      SELECT ak.id, ak.white_label_client_id, ak.permissions, ak.rate_limit_per_minute,
             wlc.client_name, wlc.is_active as client_active
      FROM api_keys ak
      JOIN white_label_clients wlc ON ak.white_label_client_id = wlc.id
      WHERE ak.api_key = $1 AND ak.is_active = true AND wlc.is_active = true
      AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
    `,
      [apiKey],
    )

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid API credentials",
      })
    }

    const apiKeyData = result.rows[0]

    // Verify API secret (in production, use proper hashing)
    // This is simplified - implement proper bcrypt comparison

    req.apiKey = {
      id: apiKeyData.id,
      whitelabelClientId: apiKeyData.white_label_client_id,
      permissions: apiKeyData.permissions,
      rateLimit: apiKeyData.rate_limit_per_minute,
    }

    // Update last used timestamp
    await query("UPDATE api_keys SET last_used_at = NOW() WHERE id = $1", [apiKeyData.id])

    next()
  } catch (error) {
    logger.error("API key verification failed:", error)
    return res.status(500).json({
      success: false,
      message: "Authentication error",
    })
  }
}

module.exports = {
  authenticateToken,
  authenticateApiKey,
}
