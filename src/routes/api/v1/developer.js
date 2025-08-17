const express = require("express")
const router = express.Router()
const { body, validationResult } = require("express-validator")
const rateLimit = require("express-rate-limit")
const { authenticateApiKey, checkApiLimits } = require("../../../middleware/apiAuth")
const walletService = require("../../../services/walletService")
const transactionService = require("../../../services/transactionService")
const webhookService = require("../../../services/webhookService")
const logger = require("../../../utils/logger")

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each API key to 1000 requests per windowMs
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
})

// Create wallet for end user
router.post(
  "/wallets",
  apiLimiter,
  authenticateApiKey,
  checkApiLimits,
  [
    body("user_id").notEmpty().withMessage("User ID is required"),
    body("name").optional().isLength({ min: 1, max: 50 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: "Validation failed", details: errors.array() })
      }

      const { user_id, name } = req.body
      const clientId = req.apiClient.id

      // Create wallet for the client's end user
      const wallet = await walletService.createWallet({
        userId: user_id,
        name: name || "Default Wallet",
        clientId: clientId,
      })

      // Log API usage
      await logApiUsage(req.apiClient.id, "create_wallet", req.ip)

      // Send webhook notification
      await webhookService.sendWebhook(clientId, "wallet.created", {
        wallet_id: wallet.id,
        user_id: user_id,
        address: wallet.address,
      })

      res.json({
        success: true,
        data: {
          wallet_id: wallet.id,
          address: wallet.address,
          name: wallet.name,
          balance: "0",
          created_at: wallet.created_at,
        },
      })
    } catch (error) {
      logger.error("API Error - Create Wallet:", error)
      res.status(500).json({ error: "Internal server error" })
    }
  },
)

// Get wallet balance
router.get("/wallets/:wallet_id/balance", apiLimiter, authenticateApiKey, checkApiLimits, async (req, res) => {
  try {
    const { wallet_id } = req.params
    const clientId = req.apiClient.id

    const wallet = await walletService.getWalletByIdAndClient(wallet_id, clientId)
    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" })
    }

    const balance = await walletService.getBalance(wallet.address)

    await logApiUsage(clientId, "get_balance", req.ip)

    res.json({
      success: true,
      data: {
        wallet_id: wallet_id,
        address: wallet.address,
        balance: balance,
        currency: "USDC",
      },
    })
  } catch (error) {
    logger.error("API Error - Get Balance:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Send USDC transaction
router.post(
  "/wallets/:wallet_id/send",
  apiLimiter,
  authenticateApiKey,
  checkApiLimits,
  [
    body("to_address").isEthereumAddress().withMessage("Invalid recipient address"),
    body("amount").isFloat({ min: 0.000001 }).withMessage("Invalid amount"),
    body("user_pin").optional().isLength({ min: 4, max: 6 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: "Validation failed", details: errors.array() })
      }

      const { wallet_id } = req.params
      const { to_address, amount, user_pin } = req.body
      const clientId = req.apiClient.id

      const wallet = await walletService.getWalletByIdAndClient(wallet_id, clientId)
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" })
      }

      // Check client transaction limits
      const limits = req.apiClient.transaction_limits
      if (Number.parseFloat(amount) > limits.max_transaction_amount) {
        return res.status(400).json({
          error: "Transaction amount exceeds limit",
          max_allowed: limits.max_transaction_amount,
        })
      }

      const transaction = await transactionService.sendUSDC({
        fromWalletId: wallet_id,
        toAddress: to_address,
        amount: amount,
        userPin: user_pin,
        clientId: clientId,
      })

      await logApiUsage(clientId, "send_transaction", req.ip, { amount })

      // Send webhook notification
      await webhookService.sendWebhook(clientId, "transaction.created", {
        transaction_id: transaction.id,
        wallet_id: wallet_id,
        type: "send",
        amount: amount,
        to_address: to_address,
        status: "pending",
      })

      res.json({
        success: true,
        data: {
          transaction_id: transaction.id,
          hash: transaction.hash,
          status: "pending",
          amount: amount,
          to_address: to_address,
          estimated_confirmation_time: "2-5 minutes",
        },
      })
    } catch (error) {
      logger.error("API Error - Send Transaction:", error)
      res.status(500).json({ error: "Internal server error" })
    }
  },
)

// Get transaction history
router.get("/wallets/:wallet_id/transactions", apiLimiter, authenticateApiKey, checkApiLimits, async (req, res) => {
  try {
    const { wallet_id } = req.params
    const { page = 1, limit = 20 } = req.query
    const clientId = req.apiClient.id

    const wallet = await walletService.getWalletByIdAndClient(wallet_id, clientId)
    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" })
    }

    const transactions = await transactionService.getTransactionHistory(
      wallet_id,
      Number.parseInt(page),
      Number.parseInt(limit),
    )

    await logApiUsage(clientId, "get_transactions", req.ip)

    res.json({
      success: true,
      data: {
        transactions: transactions.data,
        pagination: {
          current_page: Number.parseInt(page),
          total_pages: transactions.totalPages,
          total_transactions: transactions.total,
          per_page: Number.parseInt(limit),
        },
      },
    })
  } catch (error) {
    logger.error("API Error - Get Transactions:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Get transaction status
router.get("/transactions/:transaction_id", apiLimiter, authenticateApiKey, checkApiLimits, async (req, res) => {
  try {
    const { transaction_id } = req.params
    const clientId = req.apiClient.id

    const transaction = await transactionService.getTransactionByIdAndClient(transaction_id, clientId)
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" })
    }

    await logApiUsage(clientId, "get_transaction_status", req.ip)

    res.json({
      success: true,
      data: {
        transaction_id: transaction.id,
        hash: transaction.hash,
        status: transaction.status,
        type: transaction.type,
        amount: transaction.amount,
        from_address: transaction.from_address,
        to_address: transaction.to_address,
        confirmations: transaction.confirmations,
        created_at: transaction.created_at,
        confirmed_at: transaction.confirmed_at,
      },
    })
  } catch (error) {
    logger.error("API Error - Get Transaction Status:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Webhook management
router.post(
  "/webhooks",
  authenticateApiKey,
  [
    body("url").isURL().withMessage("Invalid webhook URL"),
    body("events").isArray().withMessage("Events must be an array"),
    body("events.*").isIn(["wallet.created", "transaction.created", "transaction.confirmed", "transaction.failed"]),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: "Validation failed", details: errors.array() })
      }

      const { url, events, secret } = req.body
      const clientId = req.apiClient.id

      const webhook = await webhookService.createWebhook({
        clientId,
        url,
        events,
        secret,
      })

      res.json({
        success: true,
        data: {
          webhook_id: webhook.id,
          url: webhook.url,
          events: webhook.events,
          status: "active",
          created_at: webhook.created_at,
        },
      })
    } catch (error) {
      logger.error("API Error - Create Webhook:", error)
      res.status(500).json({ error: "Internal server error" })
    }
  },
)

// Helper function to log API usage
async function logApiUsage(clientId, action, ip, metadata = {}) {
  try {
    const db = require("../../../config/database")
    await db.query(
      `INSERT INTO api_usage_logs (client_id, action, ip_address, metadata, created_at) 
       VALUES ($1, $2, $3, $4, NOW())`,
      [clientId, action, ip, JSON.stringify(metadata)],
    )
  } catch (error) {
    logger.error("Failed to log API usage:", error)
  }
}

module.exports = router
