const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const speakeasy = require("speakeasy")
const QRCode = require("qrcode")
const { body, validationResult } = require("express-validator")
const { query } = require("../config/database")
const { authenticateToken } = require("../middleware/auth")
const logger = require("../utils/logger")

const router = express.Router()

// Register new user
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password")
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
    body("firstName").trim().isLength({ min: 1, max: 100 }),
    body("lastName").trim().isLength({ min: 1, max: 100 }),
    body("phone").optional().isMobilePhone(),
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

      const { email, password, firstName, lastName, phone } = req.body

      // Check if user already exists
      const existingUser = await query("SELECT id FROM users WHERE email = $1", [email])
      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "User already exists with this email",
        })
      }

      // Hash password
      const saltRounds = 12
      const passwordHash = await bcrypt.hash(password, saltRounds)

      // Create user
      const result = await query(
        `
      INSERT INTO users (email, password_hash, first_name, last_name, phone)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, first_name, last_name, created_at
    `,
        [email, passwordHash, firstName, lastName, phone],
      )

      const user = result.rows[0]

      // Generate JWT token
      const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "24h" })

      logger.info(`New user registered: ${email}`)

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            createdAt: user.created_at,
          },
          token,
        },
      })
    } catch (error) {
      logger.error("Registration error:", error)
      res.status(500).json({
        success: false,
        message: "Registration failed",
      })
    }
  },
)

// Login user
router.post("/login", [body("email").isEmail().normalizeEmail(), body("password").notEmpty()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      })
    }

    const { email, password, twoFactorCode } = req.body

    // Get user
    const userResult = await query(
      `
      SELECT id, email, password_hash, first_name, last_name, 
             two_factor_enabled, two_factor_secret, status
      FROM users WHERE email = $1
    `,
      [email],
    )

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      })
    }

    const user = userResult.rows[0]

    if (user.status !== "active") {
      return res.status(401).json({
        success: false,
        message: "Account is suspended or inactive",
      })
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash)
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      })
    }

    // Check 2FA if enabled
    if (user.two_factor_enabled) {
      if (!twoFactorCode) {
        return res.status(200).json({
          success: true,
          requiresTwoFactor: true,
          message: "2FA code required",
        })
      }

      const verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: "base32",
        token: twoFactorCode,
        window: 2,
      })

      if (!verified) {
        return res.status(401).json({
          success: false,
          message: "Invalid 2FA code",
        })
      }
    }

    // Update last login
    await query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id])

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "24h" })

    logger.info(`User logged in: ${email}`)

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          twoFactorEnabled: user.two_factor_enabled,
        },
        token,
      },
    })
  } catch (error) {
    logger.error("Login error:", error)
    res.status(500).json({
      success: false,
      message: "Login failed",
    })
  }
})

// Setup 2FA
router.post("/setup-2fa", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
    const email = req.user.email

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `USDC Wallet (${email})`,
      issuer: "USDC Wallet",
    })

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url)

    // Store secret temporarily (not enabled until verified)
    await query("UPDATE users SET two_factor_secret = $1 WHERE id = $2", [secret.base32, userId])

    res.json({
      success: true,
      data: {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32,
      },
    })
  } catch (error) {
    logger.error("2FA setup error:", error)
    res.status(500).json({
      success: false,
      message: "2FA setup failed",
    })
  }
})

// Verify and enable 2FA
router.post(
  "/verify-2fa",
  authenticateToken,
  [body("token").isLength({ min: 6, max: 6 }).isNumeric()],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Invalid 2FA token format",
        })
      }

      const userId = req.user.id
      const { token } = req.body

      // Get user's secret
      const userResult = await query("SELECT two_factor_secret FROM users WHERE id = $1", [userId])

      if (userResult.rows.length === 0 || !userResult.rows[0].two_factor_secret) {
        return res.status(400).json({
          success: false,
          message: "2FA not set up",
        })
      }

      const secret = userResult.rows[0].two_factor_secret

      // Verify token
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: "base32",
        token: token,
        window: 2,
      })

      if (!verified) {
        return res.status(400).json({
          success: false,
          message: "Invalid 2FA token",
        })
      }

      // Enable 2FA
      await query("UPDATE users SET two_factor_enabled = true WHERE id = $1", [userId])

      logger.info(`2FA enabled for user: ${req.user.email}`)

      res.json({
        success: true,
        message: "2FA enabled successfully",
      })
    } catch (error) {
      logger.error("2FA verification error:", error)
      res.status(500).json({
        success: false,
        message: "2FA verification failed",
      })
    }
  },
)

module.exports = router
