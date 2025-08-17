const express = require("express")
const router = express.Router()
const { authenticateApiKey } = require("../middleware/apiAuth")
const db = require("../config/database")
const webhookService = require("../services/webhookService")

// Get API client dashboard data
router.get("/dashboard", authenticateApiKey, async (req, res) => {
  try {
    const clientId = req.apiClient.id

    // Get usage statistics
    const monthlyUsage = await db.query(
      `SELECT COUNT(*) as requests FROM api_usage_logs 
       WHERE client_id = $1 AND created_at >= date_trunc('month', CURRENT_DATE)`,
      [clientId],
    )

    const dailyTransactions = await db.query(
      `SELECT COUNT(*) as transactions FROM api_usage_logs 
       WHERE client_id = $1 AND action = 'send_transaction' 
       AND created_at >= CURRENT_DATE`,
      [clientId],
    )

    const totalWallets = await db.query(`SELECT COUNT(*) as wallets FROM wallets WHERE api_client_id = $1`, [clientId])

    const totalVolume = await db.query(
      `SELECT COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as volume 
       FROM transactions 
       WHERE api_client_id = $1 AND status = 'confirmed' 
       AND created_at >= date_trunc('month', CURRENT_DATE)`,
      [clientId],
    )

    // Get recent activity
    const recentActivity = await db.query(
      `SELECT action, COUNT(*) as count, DATE(created_at) as date
       FROM api_usage_logs 
       WHERE client_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY action, DATE(created_at)
       ORDER BY date DESC, count DESC
       LIMIT 20`,
      [clientId],
    )

    res.json({
      success: true,
      data: {
        usage: {
          monthly_requests: Number.parseInt(monthlyUsage.rows[0].requests),
          daily_transactions: Number.parseInt(dailyTransactions.rows[0].transactions),
          total_wallets: Number.parseInt(totalWallets.rows[0].wallets),
          monthly_volume: Number.parseFloat(totalVolume.rows[0].volume),
        },
        limits: req.apiClient.rate_limits,
        transaction_limits: req.apiClient.transaction_limits,
        recent_activity: recentActivity.rows,
      },
    })
  } catch (error) {
    console.error("Dashboard Error:", error)
    res.status(500).json({ error: "Failed to load dashboard data" })
  }
})

// Get API documentation
router.get("/docs", (req, res) => {
  const documentation = {
    base_url: process.env.API_BASE_URL || "https://api.usdcwallet.com",
    authentication: {
      method: "API Key",
      header: "X-API-Key",
      example: "X-API-Key: your_api_key_here",
    },
    endpoints: {
      wallets: {
        create: {
          method: "POST",
          path: "/api/v1/wallets",
          description: "Create a new wallet for a user",
          parameters: {
            user_id: "string (required) - Your internal user ID",
            name: "string (optional) - Wallet name",
          },
        },
        balance: {
          method: "GET",
          path: "/api/v1/wallets/{wallet_id}/balance",
          description: "Get wallet USDC balance",
        },
        send: {
          method: "POST",
          path: "/api/v1/wallets/{wallet_id}/send",
          description: "Send USDC to another address",
          parameters: {
            to_address: "string (required) - Recipient address",
            amount: "number (required) - Amount in USDC",
            user_pin: "string (optional) - User PIN for verification",
          },
        },
        transactions: {
          method: "GET",
          path: "/api/v1/wallets/{wallet_id}/transactions",
          description: "Get wallet transaction history",
          parameters: {
            page: "number (optional) - Page number (default: 1)",
            limit: "number (optional) - Results per page (default: 20)",
          },
        },
      },
      webhooks: {
        create: {
          method: "POST",
          path: "/api/v1/webhooks",
          description: "Create webhook endpoint",
          parameters: {
            url: "string (required) - Your webhook URL",
            events: "array (required) - Events to listen to",
            secret: "string (optional) - Secret for signature verification",
          },
        },
      },
    },
    webhook_events: ["wallet.created", "transaction.created", "transaction.confirmed", "transaction.failed"],
    rate_limits: {
      requests: "1000 per 15 minutes",
      monthly: "Based on your plan",
      transactions: "Based on your plan",
    },
  }

  res.json({ success: true, data: documentation })
})

module.exports = router
