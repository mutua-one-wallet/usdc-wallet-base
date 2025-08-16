const express = require("express")
const { body, param, query, validationResult } = require("express-validator")
const { authenticateToken } = require("../middleware/auth")
const { checkFeaturePermission, checkTransactionLimits } = require("../middleware/whitelabel")
const walletService = require("../services/walletService")
const blockchainService = require("../services/blockchain")
const logger = require("../utils/logger")

const router = express.Router()

// All wallet routes require authentication
router.use(authenticateToken)

// Create new wallet
router.post(
  "/",
  checkFeaturePermission("multiple_wallets"),
  [
    body("walletName")
      .trim()
      .isLength({ min: 1, max: 100 })
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage("Wallet name can only contain letters, numbers, spaces, hyphens, and underscores"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        })
      }

      const { walletName } = req.body
      const userId = req.user.id
      const whitelabelClientId = req.whitelabelClient?.id

      const wallet = await walletService.createWallet(userId, walletName, whitelabelClientId)

      res.status(201).json({
        success: true,
        message: "Wallet created successfully",
        data: wallet,
      })
    } catch (error) {
      logger.error("Create wallet error:", error)
      res.status(400).json({
        success: false,
        message: error.message,
      })
    }
  },
)

// Get user's wallets
router.get("/", async (req, res) => {
  try {
    const userId = req.user.id
    const wallets = await walletService.getUserWallets(userId)

    res.json({
      success: true,
      data: wallets,
    })
  } catch (error) {
    logger.error("Get wallets error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to get wallets",
    })
  }
})

// Get specific wallet
router.get("/:walletId", [param("walletId").isUUID()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Invalid wallet ID",
      })
    }

    const { walletId } = req.params
    const userId = req.user.id

    const wallet = await walletService.getWallet(walletId, userId)

    res.json({
      success: true,
      data: wallet,
    })
  } catch (error) {
    logger.error("Get wallet error:", error)
    res.status(404).json({
      success: false,
      message: error.message,
    })
  }
})

// Update wallet balance
router.post("/:walletId/balance", [param("walletId").isUUID()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Invalid wallet ID",
      })
    }

    const { walletId } = req.params
    const userId = req.user.id

    // Verify wallet ownership
    await walletService.getWallet(walletId, userId)

    const balanceData = await walletService.updateWalletBalance(walletId)

    res.json({
      success: true,
      message: "Balance updated successfully",
      data: balanceData,
    })
  } catch (error) {
    logger.error("Update balance error:", error)
    res.status(400).json({
      success: false,
      message: error.message,
    })
  }
})

// Send USDC
router.post(
  "/:walletId/send",
  checkFeaturePermission("send"),
  checkTransactionLimits,
  [
    param("walletId").isUUID(),
    body("toAddress").custom((value) => {
      if (!blockchainService.isValidAddress(value)) {
        throw new Error("Invalid recipient address")
      }
      return true
    }),
    body("amount").isFloat({ min: 0.000001 }).withMessage("Amount must be greater than 0.000001"),
    body("memo").optional().trim().isLength({ max: 500 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        })
      }

      const { walletId } = req.params
      const { toAddress, amount, memo } = req.body
      const userId = req.user.id

      const transaction = await walletService.sendUSDC(walletId, userId, toAddress, amount, memo)

      res.json({
        success: true,
        message: "Transaction sent successfully",
        data: transaction,
      })
    } catch (error) {
      logger.error("Send USDC error:", error)
      res.status(400).json({
        success: false,
        message: error.message,
      })
    }
  },
)

// Get transaction history
router.get(
  "/:walletId/transactions",
  [
    param("walletId").isUUID(),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("offset").optional().isInt({ min: 0 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        })
      }

      const { walletId } = req.params
      const limit = Number.parseInt(req.query.limit) || 50
      const offset = Number.parseInt(req.query.offset) || 0
      const userId = req.user.id

      const transactions = await walletService.getTransactionHistory(walletId, userId, limit, offset)

      res.json({
        success: true,
        data: {
          transactions,
          pagination: {
            limit,
            offset,
            hasMore: transactions.length === limit,
          },
        },
      })
    } catch (error) {
      logger.error("Get transactions error:", error)
      res.status(400).json({
        success: false,
        message: error.message,
      })
    }
  },
)

// Set primary wallet
router.post("/:walletId/set-primary", [param("walletId").isUUID()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Invalid wallet ID",
      })
    }

    const { walletId } = req.params
    const userId = req.user.id

    await walletService.setPrimaryWallet(walletId, userId)

    res.json({
      success: true,
      message: "Primary wallet updated successfully",
    })
  } catch (error) {
    logger.error("Set primary wallet error:", error)
    res.status(400).json({
      success: false,
      message: error.message,
    })
  }
})

// Estimate transaction gas
router.post(
  "/estimate-gas",
  [
    body("fromAddress").custom((value) => {
      if (!blockchainService.isValidAddress(value)) {
        throw new Error("Invalid from address")
      }
      return true
    }),
    body("toAddress").custom((value) => {
      if (!blockchainService.isValidAddress(value)) {
        throw new Error("Invalid to address")
      }
      return true
    }),
    body("amount").isFloat({ min: 0.000001 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        })
      }

      const { fromAddress, toAddress, amount } = req.body

      const gasEstimate = await blockchainService.estimateTransferGas(fromAddress, toAddress, amount)

      res.json({
        success: true,
        data: gasEstimate,
      })
    } catch (error) {
      logger.error("Gas estimation error:", error)
      res.status(400).json({
        success: false,
        message: error.message,
      })
    }
  },
)

module.exports = router
