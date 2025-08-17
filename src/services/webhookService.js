const axios = require("axios")
const crypto = require("crypto")
const db = require("../config/database")
const logger = require("../utils/logger")

class WebhookService {
  // Create webhook endpoint
  async createWebhook({ clientId, url, events, secret }) {
    try {
      const result = await db.query(
        `INSERT INTO webhooks (client_id, url, events, secret, status, created_at) 
         VALUES ($1, $2, $3, $4, 'active', NOW()) RETURNING *`,
        [clientId, url, JSON.stringify(events), secret],
      )

      return result.rows[0]
    } catch (error) {
      logger.error("Create Webhook Error:", error)
      throw error
    }
  }

  // Send webhook notification
  async sendWebhook(clientId, event, data) {
    try {
      // Get all active webhooks for this client that listen to this event
      const webhooks = await db.query(
        `SELECT * FROM webhooks 
         WHERE client_id = $1 AND status = 'active' 
         AND events::jsonb ? $2`,
        [clientId, event],
      )

      for (const webhook of webhooks.rows) {
        await this.deliverWebhook(webhook, event, data)
      }
    } catch (error) {
      logger.error("Send Webhook Error:", error)
    }
  }

  // Deliver individual webhook
  async deliverWebhook(webhook, event, data) {
    try {
      const payload = {
        event: event,
        data: data,
        timestamp: new Date().toISOString(),
        webhook_id: webhook.id,
      }

      const signature = this.generateSignature(JSON.stringify(payload), webhook.secret)

      const response = await axios.post(webhook.url, payload, {
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "User-Agent": "USDC-Wallet-Webhook/1.0",
        },
        timeout: 10000,
      })

      // Log successful delivery
      await this.logWebhookDelivery(webhook.id, event, "success", response.status)
    } catch (error) {
      logger.error(`Webhook Delivery Failed for ${webhook.url}:`, error)

      // Log failed delivery
      await this.logWebhookDelivery(webhook.id, event, "failed", error.response?.status || 0, error.message)

      // Implement retry logic here if needed
    }
  }

  // Generate webhook signature
  generateSignature(payload, secret) {
    return crypto.createHmac("sha256", secret).update(payload).digest("hex")
  }

  // Log webhook delivery
  async logWebhookDelivery(webhookId, event, status, statusCode, errorMessage = null) {
    try {
      await db.query(
        `INSERT INTO webhook_logs (webhook_id, event, status, status_code, error_message, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [webhookId, event, status, statusCode, errorMessage],
      )
    } catch (error) {
      logger.error("Log Webhook Delivery Error:", error)
    }
  }

  // Get webhook logs for client
  async getWebhookLogs(clientId, page = 1, limit = 50) {
    try {
      const offset = (page - 1) * limit

      const result = await db.query(
        `SELECT wl.*, w.url, w.events 
         FROM webhook_logs wl
         JOIN webhooks w ON wl.webhook_id = w.id
         WHERE w.client_id = $1
         ORDER BY wl.created_at DESC
         LIMIT $2 OFFSET $3`,
        [clientId, limit, offset],
      )

      const countResult = await db.query(
        `SELECT COUNT(*) FROM webhook_logs wl
         JOIN webhooks w ON wl.webhook_id = w.id
         WHERE w.client_id = $1`,
        [clientId],
      )

      return {
        data: result.rows,
        total: Number.parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit),
      }
    } catch (error) {
      logger.error("Get Webhook Logs Error:", error)
      throw error
    }
  }
}

module.exports = new WebhookService()
