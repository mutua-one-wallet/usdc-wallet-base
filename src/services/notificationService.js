const { query } = require("../config/database")
const logger = require("../utils/logger")

class NotificationService {
  // Create notification
  async createNotification(userId, type, title, message, data = null) {
    try {
      const result = await query(
        `
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at
      `,
        [userId, type, title, message, JSON.stringify(data)],
      )

      const notification = result.rows[0]

      logger.info(`Notification created for user ${userId}: ${type}`)

      return {
        id: notification.id,
        createdAt: notification.created_at,
      }
    } catch (error) {
      logger.error("Error creating notification:", error)
      throw error
    }
  }

  // Get user notifications
  async getNotifications(userId, limit = 50, offset = 0) {
    try {
      const result = await query(
        `
        SELECT id, type, title, message, data, is_read, created_at
        FROM notifications 
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
        [userId, limit, offset],
      )

      return result.rows.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data ? JSON.parse(notification.data) : null,
        isRead: notification.is_read,
        createdAt: notification.created_at,
      }))
    } catch (error) {
      logger.error("Error getting notifications:", error)
      throw new Error("Failed to get notifications")
    }
  }

  // Mark notification as read
  async markAsRead(userId, notificationId) {
    try {
      const result = await query(
        `
        UPDATE notifications 
        SET is_read = true, updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `,
        [notificationId, userId],
      )

      if (result.rows.length === 0) {
        throw new Error("Notification not found or access denied")
      }

      return { success: true }
    } catch (error) {
      logger.error("Error marking notification as read:", error)
      throw error
    }
  }

  // Mark all notifications as read
  async markAllAsRead(userId) {
    try {
      await query(
        `
        UPDATE notifications 
        SET is_read = true, updated_at = NOW()
        WHERE user_id = $1 AND is_read = false
      `,
        [userId],
      )

      logger.info(`All notifications marked as read for user ${userId}`)

      return { success: true }
    } catch (error) {
      logger.error("Error marking all notifications as read:", error)
      throw error
    }
  }

  // Get unread count
  async getUnreadCount(userId) {
    try {
      const result = await query("SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false", [
        userId,
      ])

      return {
        unreadCount: Number.parseInt(result.rows[0].count),
      }
    } catch (error) {
      logger.error("Error getting unread count:", error)
      throw new Error("Failed to get unread count")
    }
  }

  // Notification types for transactions
  async notifyTransactionSent(userId, transactionHash, amount, toAddress) {
    return this.createNotification(
      userId,
      "transaction_sent",
      "Transaction Sent",
      `Successfully sent ${amount} USDC to ${toAddress.substring(0, 6)}...${toAddress.substring(38)}`,
      { transactionHash, amount, toAddress },
    )
  }

  async notifyTransactionReceived(userId, transactionHash, amount, fromAddress) {
    return this.createNotification(
      userId,
      "transaction_received",
      "USDC Received",
      `Received ${amount} USDC from ${fromAddress.substring(0, 6)}...${fromAddress.substring(38)}`,
      { transactionHash, amount, fromAddress },
    )
  }

  async notifyTransactionConfirmed(userId, transactionHash, amount) {
    return this.createNotification(
      userId,
      "transaction_confirmed",
      "Transaction Confirmed",
      `Your transaction of ${amount} USDC has been confirmed on the blockchain`,
      { transactionHash, amount },
    )
  }

  async notifyTransactionFailed(userId, transactionHash, amount, reason) {
    return this.createNotification(
      userId,
      "transaction_failed",
      "Transaction Failed",
      `Your transaction of ${amount} USDC failed: ${reason}`,
      { transactionHash, amount, reason },
    )
  }
}

module.exports = new NotificationService()
