const jwt = require("jsonwebtoken")
const db = require("../config/database")
const logger = require("../utils/logger")

// Authenticate API key
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "")

    if (!apiKey) {
      return res.status(401).json({ error: "API key required" })
    }

    // Get client by API key
    const result = await db.query("SELECT * FROM api_clients WHERE api_key = $1 AND status = $2", [apiKey, "active"])

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid API key" })
    }

    const client = result.rows[0]

    // Check if client is active
    if (client.status !== "active") {
      return res.status(401).json({ error: "API key is inactive" })
    }

    // Update last used timestamp
    await db.query("UPDATE api_clients SET last_used_at = NOW() WHERE id = $1", [client.id])

    req.apiClient = client
    next()
  } catch (error) {
    logger.error("API Authentication Error:", error)
    res.status(500).json({ error: "Authentication failed" })
  }
}

// Check API limits and usage
const checkApiLimits = async (req, res, next) => {
  try {
    const clientId = req.apiClient.id
    const limits = req.apiClient.rate_limits

    // Check monthly request limit
    const monthlyUsage = await db.query(
      `SELECT COUNT(*) as count FROM api_usage_logs 
       WHERE client_id = $1 AND created_at >= date_trunc('month', CURRENT_DATE)`,
      [clientId],
    )

    if (Number.parseInt(monthlyUsage.rows[0].count) >= limits.monthly_requests) {
      return res.status(429).json({
        error: "Monthly request limit exceeded",
        limit: limits.monthly_requests,
        used: monthlyUsage.rows[0].count,
      })
    }

    // Check daily transaction limit
    const dailyTransactions = await db.query(
      `SELECT COUNT(*) as count FROM api_usage_logs 
       WHERE client_id = $1 AND action = 'send_transaction' 
       AND created_at >= CURRENT_DATE`,
      [clientId],
    )

    if (Number.parseInt(dailyTransactions.rows[0].count) >= limits.daily_transactions) {
      return res.status(429).json({
        error: "Daily transaction limit exceeded",
        limit: limits.daily_transactions,
        used: dailyTransactions.rows[0].count,
      })
    }

    next()
  } catch (error) {
    logger.error("API Limits Check Error:", error)
    res.status(500).json({ error: "Limits check failed" })
  }
}

module.exports = {
  authenticateApiKey,
  checkApiLimits,
}
