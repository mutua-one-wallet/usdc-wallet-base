const express = require("express")
const { body, param, query, validationResult } = require("express-validator")
const { authenticateToken, authenticateApiKey } = require("../middleware/auth")
const whitelabelService = require("../services/whitelabelService")
const logger = require("../utils/logger")

const router = express.Router()

// Admin routes (require user authentication)
router.use("/admin", authenticateToken)

// Create new white label client (admin only)
router.post(
  "/admin/clients",
  [
    body("clientName").trim().isLength({ min: 1, max: 255 }).withMessage("Client name is required"),
    body("subdomain")
      .trim()
      .isLength({ min: 3, max: 100 })
      .matches(/^[a-z0-9-]+$/)
      .withMessage("Subdomain must be 3-100 characters, lowercase letters, numbers, and hyphens only"),
    body("customDomain").optional().isURL().withMessage("Invalid custom domain"),
    body("brandConfig").optional().isObject(),
    body("featuresConfig").optional().isObject(),
    body("webhookUrl").optional().isURL().withMessage("Invalid webhook URL"),
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

      const { clientName, subdomain, customDomain, brandConfig, featuresConfig, webhookUrl } = req.body

      const client = await whitelabelService.createClient({
        clientName,
        subdomain,
        customDomain,
        brandConfig,
        featuresConfig,
        webhookUrl,
      })

      res.status(201).json({
        success: true,
        message: "White label client created successfully",
        data: client,
      })
    } catch (error) {
      logger.error("Create white label client error:", error)
      res.status(400).json({
        success: false,
        message: error.message,
      })
    }
  },
)

// Get all white label clients (admin only)
router.get("/admin/clients", async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query

    const result = await whitelabelService.getClients({
      page: Number.parseInt(page),
      limit: Number.parseInt(limit),
      search,
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    logger.error("Get white label clients error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to get clients",
    })
  }
})

// Get specific white label client (admin only)
router.get("/admin/clients/:clientId", [param("clientId").isUUID()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Invalid client ID",
      })
    }

    const { clientId } = req.params
    const client = await whitelabelService.getClient(clientId)

    res.json({
      success: true,
      data: client,
    })
  } catch (error) {
    logger.error("Get white label client error:", error)
    res.status(404).json({
      success: false,
      message: error.message,
    })
  }
})

// Update white label client (admin only)
router.put(
  "/admin/clients/:clientId",
  [
    param("clientId").isUUID(),
    body("clientName").optional().trim().isLength({ min: 1, max: 255 }),
    body("customDomain").optional().isURL(),
    body("brandConfig").optional().isObject(),
    body("featuresConfig").optional().isObject(),
    body("webhookUrl").optional().isURL(),
    body("isActive").optional().isBoolean(),
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

      const { clientId } = req.params
      const updateData = req.body

      const client = await whitelabelService.updateClient(clientId, updateData)

      res.json({
        success: true,
        message: "Client updated successfully",
        data: client,
      })
    } catch (error) {
      logger.error("Update white label client error:", error)
      res.status(400).json({
        success: false,
        message: error.message,
      })
    }
  },
)

// Delete white label client (admin only)
router.delete("/admin/clients/:clientId", [param("clientId").isUUID()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Invalid client ID",
      })
    }

    const { clientId } = req.params
    await whitelabelService.deleteClient(clientId)

    res.json({
      success: true,
      message: "Client deleted successfully",
    })
  } catch (error) {
    logger.error("Delete white label client error:", error)
    res.status(400).json({
      success: false,
      message: error.message,
    })
  }
})

// Get client statistics (admin only)
router.get("/admin/clients/:clientId/stats", [param("clientId").isUUID()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Invalid client ID",
      })
    }

    const { clientId } = req.params
    const { startDate, endDate } = req.query

    const stats = await whitelabelService.getClientStats(clientId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    })

    res.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    logger.error("Get client stats error:", error)
    res.status(400).json({
      success: false,
      message: error.message,
    })
  }
})

// Public routes (no authentication required)

// Get client configuration by subdomain
router.get("/config/:subdomain", [param("subdomain").trim().isLength({ min: 1 })], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Invalid subdomain",
      })
    }

    const { subdomain } = req.params
    const config = await whitelabelService.getClientConfigBySubdomain(subdomain)

    res.json({
      success: true,
      data: config,
    })
  } catch (error) {
    logger.error("Get client config error:", error)
    res.status(404).json({
      success: false,
      message: "Configuration not found",
    })
  }
})

// Get client configuration by custom domain
router.get("/config/domain/:domain", [param("domain").trim().isLength({ min: 1 })], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Invalid domain",
      })
    }

    const { domain } = req.params
    const config = await whitelabelService.getClientConfigByDomain(domain)

    res.json({
      success: true,
      data: config,
    })
  } catch (error) {
    logger.error("Get client config by domain error:", error)
    res.status(404).json({
      success: false,
      message: "Configuration not found",
    })
  }
})

// Client dashboard routes (require API key authentication)
router.use("/dashboard", authenticateApiKey)

// Get client's own configuration
router.get("/dashboard/config", async (req, res) => {
  try {
    const clientId = req.apiKey.whitelabelClientId
    const client = await whitelabelService.getClient(clientId)

    res.json({
      success: true,
      data: {
        clientName: client.clientName,
        subdomain: client.subdomain,
        customDomain: client.customDomain,
        brandConfig: client.brandConfig,
        featuresConfig: client.featuresConfig,
        webhookUrl: client.webhookUrl,
        isActive: client.isActive,
      },
    })
  } catch (error) {
    logger.error("Get client config error:", error)
    res.status(400).json({
      success: false,
      message: error.message,
    })
  }
})

// Update client's own configuration
router.put(
  "/dashboard/config",
  [
    body("brandConfig").optional().isObject(),
    body("featuresConfig").optional().isObject(),
    body("webhookUrl").optional().isURL(),
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

      const clientId = req.apiKey.whitelabelClientId
      const { brandConfig, featuresConfig, webhookUrl } = req.body

      const client = await whitelabelService.updateClient(clientId, {
        brandConfig,
        featuresConfig,
        webhookUrl,
      })

      res.json({
        success: true,
        message: "Configuration updated successfully",
        data: {
          brandConfig: client.brandConfig,
          featuresConfig: client.featuresConfig,
          webhookUrl: client.webhookUrl,
        },
      })
    } catch (error) {
      logger.error("Update client config error:", error)
      res.status(400).json({
        success: false,
        message: error.message,
      })
    }
  },
)

// Get client's statistics
router.get("/dashboard/stats", async (req, res) => {
  try {
    const clientId = req.apiKey.whitelabelClientId
    const { startDate, endDate } = req.query

    const stats = await whitelabelService.getClientStats(clientId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    })

    res.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    logger.error("Get client dashboard stats error:", error)
    res.status(400).json({
      success: false,
      message: error.message,
    })
  }
})

// Get client's users
router.get("/dashboard/users", async (req, res) => {
  try {
    const clientId = req.apiKey.whitelabelClientId
    const { page = 1, limit = 20, search } = req.query

    const result = await whitelabelService.getClientUsers(clientId, {
      page: Number.parseInt(page),
      limit: Number.parseInt(limit),
      search,
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    logger.error("Get client users error:", error)
    res.status(400).json({
      success: false,
      message: error.message,
    })
  }
})

// Get client's transactions
router.get("/dashboard/transactions", async (req, res) => {
  try {
    const clientId = req.apiKey.whitelabelClientId
    const { page = 1, limit = 50, startDate, endDate } = req.query

    const result = await whitelabelService.getClientTransactions(clientId, {
      page: Number.parseInt(page),
      limit: Number.parseInt(limit),
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    logger.error("Get client transactions error:", error)
    res.status(400).json({
      success: false,
      message: error.message,
    })
  }
})

module.exports = router
