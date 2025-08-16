const express = require("express")
const { body, validationResult } = require("express-validator")
const { authenticateToken } = require("../middleware/auth")
const backupService = require("../services/backupService")
const logger = require("../utils/logger")

const router = express.Router()

// All backup routes require authentication
router.use(authenticateToken)

// Create backup
router.post(
  "/create",
  [
    body("password")
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage("Password must be at least 8 characters with uppercase, lowercase, and number"),
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

      const { password } = req.body
      const userId = req.user.id

      const backup = await backupService.createBackup(userId, password)

      res.json({
        success: true,
        message: "Backup created successfully",
        data: backup,
      })
    } catch (error) {
      logger.error("Create backup error:", error)
      res.status(400).json({
        success: false,
        message: error.message,
      })
    }
  },
)

// Restore from backup
router.post(
  "/restore",
  [
    body("backup").notEmpty().withMessage("Backup data is required"),
    body("password").notEmpty().withMessage("Password is required"),
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

      const { backup, password } = req.body
      const userId = req.user.id
      const whitelabelClientId = req.user.whitelabelClientId

      const result = await backupService.restoreFromBackup(userId, backup, password, whitelabelClientId)

      res.json({
        success: true,
        message: "Backup restored successfully",
        data: result,
      })
    } catch (error) {
      logger.error("Restore backup error:", error)
      res.status(400).json({
        success: false,
        message: error.message,
      })
    }
  },
)

// Import wallet
router.post(
  "/import",
  [
    body("privateKey").notEmpty().withMessage("Private key is required"),
    body("walletName")
      .trim()
      .isLength({ min: 1, max: 100 })
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage("Invalid wallet name"),
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

      const { privateKey, walletName } = req.body
      const userId = req.user.id
      const whitelabelClientId = req.user.whitelabelClientId

      const wallet = await backupService.importWallet(userId, privateKey, walletName, whitelabelClientId)

      res.status(201).json({
        success: true,
        message: "Wallet imported successfully",
        data: wallet,
      })
    } catch (error) {
      logger.error("Import wallet error:", error)
      res.status(400).json({
        success: false,
        message: error.message,
      })
    }
  },
)

module.exports = router
