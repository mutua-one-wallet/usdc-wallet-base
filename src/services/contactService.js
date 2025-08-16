const { query } = require("../config/database")
const blockchainService = require("./blockchain")
const logger = require("../utils/logger")

class ContactService {
  // Add new contact
  async addContact(userId, name, address, notes = null) {
    try {
      // Validate address
      if (!blockchainService.isValidAddress(address)) {
        throw new Error("Invalid Ethereum address")
      }

      // Check if contact already exists
      const existingContact = await query("SELECT id FROM contacts WHERE user_id = $1 AND address = $2", [
        userId,
        address,
      ])

      if (existingContact.rows.length > 0) {
        throw new Error("Contact with this address already exists")
      }

      const result = await query(
        `
        INSERT INTO contacts (user_id, name, address, notes)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, address, notes, created_at
      `,
        [userId, name, address, notes],
      )

      const contact = result.rows[0]

      logger.info(`Contact added for user ${userId}: ${name} (${address})`)

      return {
        id: contact.id,
        name: contact.name,
        address: contact.address,
        notes: contact.notes,
        createdAt: contact.created_at,
      }
    } catch (error) {
      logger.error("Error adding contact:", error)
      throw error
    }
  }

  // Get user's contacts
  async getContacts(userId) {
    try {
      const result = await query(
        `
        SELECT id, name, address, notes, created_at, updated_at
        FROM contacts 
        WHERE user_id = $1
        ORDER BY name ASC
      `,
        [userId],
      )

      return result.rows.map((contact) => ({
        id: contact.id,
        name: contact.name,
        address: contact.address,
        notes: contact.notes,
        createdAt: contact.created_at,
        updatedAt: contact.updated_at,
      }))
    } catch (error) {
      logger.error("Error getting contacts:", error)
      throw new Error("Failed to get contacts")
    }
  }

  // Update contact
  async updateContact(userId, contactId, name, notes = null) {
    try {
      const result = await query(
        `
        UPDATE contacts 
        SET name = $1, notes = $2, updated_at = NOW()
        WHERE id = $3 AND user_id = $4
        RETURNING id, name, address, notes, updated_at
      `,
        [name, notes, contactId, userId],
      )

      if (result.rows.length === 0) {
        throw new Error("Contact not found or access denied")
      }

      const contact = result.rows[0]

      logger.info(`Contact updated for user ${userId}: ${contactId}`)

      return {
        id: contact.id,
        name: contact.name,
        address: contact.address,
        notes: contact.notes,
        updatedAt: contact.updated_at,
      }
    } catch (error) {
      logger.error("Error updating contact:", error)
      throw error
    }
  }

  // Delete contact
  async deleteContact(userId, contactId) {
    try {
      const result = await query("DELETE FROM contacts WHERE id = $1 AND user_id = $2 RETURNING id", [
        contactId,
        userId,
      ])

      if (result.rows.length === 0) {
        throw new Error("Contact not found or access denied")
      }

      logger.info(`Contact deleted for user ${userId}: ${contactId}`)

      return { success: true }
    } catch (error) {
      logger.error("Error deleting contact:", error)
      throw error
    }
  }

  // Search contacts
  async searchContacts(userId, searchTerm) {
    try {
      const result = await query(
        `
        SELECT id, name, address, notes, created_at
        FROM contacts 
        WHERE user_id = $1 AND (
          name ILIKE $2 OR 
          address ILIKE $2 OR 
          notes ILIKE $2
        )
        ORDER BY name ASC
        LIMIT 20
      `,
        [userId, `%${searchTerm}%`],
      )

      return result.rows.map((contact) => ({
        id: contact.id,
        name: contact.name,
        address: contact.address,
        notes: contact.notes,
        createdAt: contact.created_at,
      }))
    } catch (error) {
      logger.error("Error searching contacts:", error)
      throw new Error("Failed to search contacts")
    }
  }
}

module.exports = new ContactService()
