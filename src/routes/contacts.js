const express = require("express")
const { body, param, query, validationResult } = require("express-validator")
const { authenticateToken } = require("../middleware/auth")
const contactService = require("../services/contactService")
const logger = require("../utils/logger")

const router = express.Router()

// All contact routes require authentication
router.use(authenticateToken)

// Add new contact
router.post(
  "/",
  [
    body("name")
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Name is required and must be less than 100 characters"),
    body("address").custom((value) => {
      const { ethers } = require("ethers")
      if (!ethers.isAddress(value)) {
        throw new Error("Invalid Ethereum address")
      }
      return true
    }),
    body("notes").optional().trim().isLength({ max: 500 }),
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

      const { name, address, notes } = req.body
      const userId = req.user.id

      const contact = await contactService.addContact(userId, name, address, notes)

      res.status(201).json({
        success: true,
        message: "Contact added successfully",
        data: contact,
      })
    } catch (error) {
      logger.error("Add contact error:", error)
      res.status(400).json({
        success: false,
        message: error.message,
      })
    }
  },
)

// Get all contacts
router.get("/", async (req, res) => {
  try {
    const userId = req.user.id
    const contacts = await contactService.getContacts(userId)

    res.json({
      success: true,
      data: contacts,
    })
  } catch (error) {
    logger.error("Get contacts error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to get contacts",
    })
  }
})

// Search contacts
router.get(
  "/search",
  [query("q").trim().isLength({ min: 1 }).withMessage("Search term is required")],
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

      const { q: searchTerm } = req.query
      const userId = req.user.id

      const contacts = await contactService.searchContacts(userId, searchTerm)

      res.json({
        success: true,
        data: contacts,
      })
    } catch (error) {
      logger.error("Search contacts error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to search contacts",
      })
    }
  },
)

// Update contact
router.put(
  "/:contactId",
  [
    param("contactId").isUUID(),
    body("name").trim().isLength({ min: 1, max: 100 }),
    body("notes").optional().trim().isLength({ max: 500 }),
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

      const { contactId } = req.params
      const { name, notes } = req.body
      const userId = req.user.id

      const contact = await contactService.updateContact(userId, contactId, name, notes)

      res.json({
        success: true,
        message: "Contact updated successfully",
        data: contact,
      })
    } catch (error) {
      logger.error("Update contact error:", error)
      res.status(400).json({
        success: false,
        message: error.message,
      })
    }
  },
)

// Delete contact
router.delete("/:contactId", [param("contactId").isUUID()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID",
      })
    }

    const { contactId } = req.params
    const userId = req.user.id

    await contactService.deleteContact(userId, contactId)

    res.json({
      success: true,
      message: "Contact deleted successfully",
    })
  } catch (error) {
    logger.error("Delete contact error:", error)
    res.status(400).json({
      success: false,
      message: error.message,
    })
  }
})

module.exports = router
