const express = require("express")
const { param, validationResult } = require("express-validator")
const { authenticateToken } = require("../middleware/auth")
const blockchainService = require("../services/blockchain")
const { query } = require("../config/database")
const logger = require("../utils/logger")

const router = express.Router()

// All transaction routes require authentication
router.use(authenticateToken)

// Get transaction details by hash
router.get("/:txHash", [param("txHash").isLength({ min: 66, max: 66 })], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction hash",
      })
    }

    const { txHash } = req.params
    const userId = req.user.id

    // Check if user has access to this transaction
    const txResult = await query(
      `
      SELECT t.*, w.user_id 
      FROM transactions t
      JOIN wallets w ON t.wallet_id = w.id
      WHERE t.transaction_hash = $1 AND w.user_id = $2
    `,
      [txHash, userId],
    )

    if (txResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found or access denied",
      })
    }

    // Get latest blockchain data
    const blockchainTx = await blockchainService.getTransaction(txHash)

    // Update database if status changed
    if (blockchainTx.status !== txResult.rows[0].status) {
      await query(
        `
        UPDATE transactions 
        SET status = $1, confirmations = $2, confirmed_at = $3
        WHERE transaction_hash = $4
      `,
        [
          blockchainTx.status,
          blockchainTx.confirmations,
          blockchainTx.status === "confirmed" ? new Date() : null,
          txHash,
        ],
      )
    }

    res.json({
      success: true,
      data: {
        ...blockchainTx,
        memo: txResult.rows[0].memo,
        type: txResult.rows[0].transaction_type,
      },
    })
  } catch (error) {
    logger.error("Get transaction error:", error)
    res.status(400).json({
      success: false,
      message: error.message,
    })
  }
})

// Get network information
router.get("/network/info", async (req, res) => {
  try {
    const networkInfo = await blockchainService.getNetworkInfo()

    res.json({
      success: true,
      data: networkInfo,
    })
  } catch (error) {
    logger.error("Get network info error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to get network information",
    })
  }
})

module.exports = router
