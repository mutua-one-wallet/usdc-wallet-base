const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
require("dotenv").config()

const { connectDB } = require("./config/database")
const logger = require("./utils/logger")
const errorHandler = require("./middleware/errorHandler")
const { applyWhitelabelConfig } = require("./middleware/whitelabel")

// Import routes
const authRoutes = require("./routes/auth")
const userRoutes = require("./routes/users")
const walletRoutes = require("./routes/wallets")
const transactionRoutes = require("./routes/transactions")
const whitelabelRoutes = require("./routes/whitelabel")
const backupRoutes = require("./routes/backup")
const contactRoutes = require("./routes/contacts")
const developerApiRoutes = require("./routes/api/v1/developer")
const developerDashboardRoutes = require("./routes/developer-dashboard")
const billingRoutes = require("./routes/billing")

const app = express()
const PORT = process.env.PORT || 3000

// Security middleware
app.use(helmet())
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
    credentials: true,
  }),
)

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
})
app.use("/api/", limiter)

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))

app.use(applyWhitelabelConfig)

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`)
  next()
})

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// API routes
app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/wallets", walletRoutes)
app.use("/api/transactions", transactionRoutes)
app.use("/api/whitelabel", whitelabelRoutes)
app.use("/api/backup", backupRoutes)
app.use("/api/contacts", contactRoutes)
app.use("/api/v1", developerApiRoutes)
app.use("/api/developer", developerDashboardRoutes)
app.use("/api/billing", billingRoutes)

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  })
})

// Error handling middleware
app.use(errorHandler)

// Start server
async function startServer() {
  try {
    await connectDB()
    app.listen(PORT, () => {
      logger.info(`USDC Wallet API Server running on port ${PORT}`)
      logger.info(`Environment: ${process.env.NODE_ENV || "development"}`)
    })
  } catch (error) {
    logger.error("Failed to start server:", error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully")
  process.exit(0)
})

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully")
  process.exit(0)
})

startServer()

module.exports = app
