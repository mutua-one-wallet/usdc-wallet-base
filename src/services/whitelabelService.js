const { query } = require("../config/database")
const crypto = require("crypto")
const logger = require("../utils/logger")

class WhitelabelService {
  // Create new white label client
  async createClient({
    clientName,
    subdomain,
    customDomain = null,
    brandConfig = null,
    featuresConfig = null,
    webhookUrl = null,
  }) {
    try {
      // Check if subdomain already exists
      const existingSubdomain = await query("SELECT id FROM white_label_clients WHERE subdomain = $1", [subdomain])

      if (existingSubdomain.rows.length > 0) {
        throw new Error("Subdomain already exists")
      }

      // Check if custom domain already exists
      if (customDomain) {
        const existingDomain = await query("SELECT id FROM white_label_clients WHERE custom_domain = $1", [
          customDomain,
        ])

        if (existingDomain.rows.length > 0) {
          throw new Error("Custom domain already exists")
        }
      }

      // Generate API credentials
      const apiKey = "wl_" + crypto.randomBytes(16).toString("hex")
      const apiSecret = crypto.randomBytes(32).toString("hex")

      // Default brand configuration
      const defaultBrandConfig = {
        appName: clientName,
        primaryColor: "#0052FF",
        secondaryColor: "#1A73E8",
        accentColor: "#00D4AA",
        logoUrl: null,
        faviconUrl: null,
        customCss: null,
        ...brandConfig,
      }

      // Default features configuration
      const defaultFeaturesConfig = {
        maxWalletsPerUser: 10,
        dailyTransactionLimit: 10000,
        monthlyTransactionLimit: 100000,
        features: ["send", "receive", "transaction_history", "multiple_wallets", "contacts", "backup"],
        enableBiometricAuth: true,
        enable2FA: true,
        enableNotifications: true,
        customBranding: true,
        ...featuresConfig,
      }

      const result = await query(
        `
        INSERT INTO white_label_clients (
          client_name, subdomain, custom_domain, api_key, api_secret,
          brand_config, features_config, webhook_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, client_name, subdomain, custom_domain, api_key, 
                 brand_config, features_config, webhook_url, is_active, created_at
      `,
        [
          clientName,
          subdomain,
          customDomain,
          apiKey,
          apiSecret,
          JSON.stringify(defaultBrandConfig),
          JSON.stringify(defaultFeaturesConfig),
          webhookUrl,
        ],
      )

      const client = result.rows[0]

      logger.info(`White label client created: ${clientName} (${subdomain})`)

      return {
        id: client.id,
        clientName: client.client_name,
        subdomain: client.subdomain,
        customDomain: client.custom_domain,
        apiKey: client.api_key,
        apiSecret: apiSecret, // Only return on creation
        brandConfig: client.brand_config,
        featuresConfig: client.features_config,
        webhookUrl: client.webhook_url,
        isActive: client.is_active,
        createdAt: client.created_at,
      }
    } catch (error) {
      logger.error("Error creating white label client:", error)
      throw error
    }
  }

  // Get all white label clients with pagination
  async getClients({ page = 1, limit = 20, search = null }) {
    try {
      const offset = (page - 1) * limit

      let whereClause = ""
      const queryParams = [limit, offset]

      if (search) {
        whereClause = "WHERE client_name ILIKE $3 OR subdomain ILIKE $3"
        queryParams.push(`%${search}%`)
      }

      const result = await query(
        `
        SELECT id, client_name, subdomain, custom_domain, brand_config,
               features_config, webhook_url, is_active, created_at, updated_at
        FROM white_label_clients
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `,
        queryParams,
      )

      // Get total count
      const countResult = await query(
        `
        SELECT COUNT(*) as total
        FROM white_label_clients
        ${whereClause}
      `,
        search ? [`%${search}%`] : [],
      )

      const total = Number.parseInt(countResult.rows[0].total)

      return {
        clients: result.rows.map((client) => ({
          id: client.id,
          clientName: client.client_name,
          subdomain: client.subdomain,
          customDomain: client.custom_domain,
          brandConfig: client.brand_config,
          featuresConfig: client.features_config,
          webhookUrl: client.webhook_url,
          isActive: client.is_active,
          createdAt: client.created_at,
          updatedAt: client.updated_at,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      }
    } catch (error) {
      logger.error("Error getting white label clients:", error)
      throw new Error("Failed to get clients")
    }
  }

  // Get specific white label client
  async getClient(clientId) {
    try {
      const result = await query(
        `
        SELECT id, client_name, subdomain, custom_domain, api_key,
               brand_config, features_config, webhook_url, is_active,
               created_at, updated_at
        FROM white_label_clients
        WHERE id = $1
      `,
        [clientId],
      )

      if (result.rows.length === 0) {
        throw new Error("Client not found")
      }

      const client = result.rows[0]

      return {
        id: client.id,
        clientName: client.client_name,
        subdomain: client.subdomain,
        customDomain: client.custom_domain,
        apiKey: client.api_key,
        brandConfig: client.brand_config,
        featuresConfig: client.features_config,
        webhookUrl: client.webhook_url,
        isActive: client.is_active,
        createdAt: client.created_at,
        updatedAt: client.updated_at,
      }
    } catch (error) {
      logger.error("Error getting white label client:", error)
      throw error
    }
  }

  // Update white label client
  async updateClient(clientId, updateData) {
    try {
      const { clientName, customDomain, brandConfig, featuresConfig, webhookUrl, isActive } = updateData

      const updates = []
      const values = []
      let paramIndex = 1

      if (clientName !== undefined) {
        updates.push(`client_name = $${paramIndex++}`)
        values.push(clientName)
      }

      if (customDomain !== undefined) {
        // Check if custom domain already exists (for other clients)
        if (customDomain) {
          const existingDomain = await query(
            "SELECT id FROM white_label_clients WHERE custom_domain = $1 AND id != $2",
            [customDomain, clientId],
          )

          if (existingDomain.rows.length > 0) {
            throw new Error("Custom domain already exists")
          }
        }

        updates.push(`custom_domain = $${paramIndex++}`)
        values.push(customDomain)
      }

      if (brandConfig !== undefined) {
        updates.push(`brand_config = $${paramIndex++}`)
        values.push(JSON.stringify(brandConfig))
      }

      if (featuresConfig !== undefined) {
        updates.push(`features_config = $${paramIndex++}`)
        values.push(JSON.stringify(featuresConfig))
      }

      if (webhookUrl !== undefined) {
        updates.push(`webhook_url = $${paramIndex++}`)
        values.push(webhookUrl)
      }

      if (isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`)
        values.push(isActive)
      }

      if (updates.length === 0) {
        throw new Error("No fields to update")
      }

      updates.push(`updated_at = NOW()`)
      values.push(clientId)

      const result = await query(
        `
        UPDATE white_label_clients
        SET ${updates.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING id, client_name, subdomain, custom_domain, brand_config,
                 features_config, webhook_url, is_active, updated_at
      `,
        values,
      )

      if (result.rows.length === 0) {
        throw new Error("Client not found")
      }

      const client = result.rows[0]

      logger.info(`White label client updated: ${clientId}`)

      return {
        id: client.id,
        clientName: client.client_name,
        subdomain: client.subdomain,
        customDomain: client.custom_domain,
        brandConfig: client.brand_config,
        featuresConfig: client.features_config,
        webhookUrl: client.webhook_url,
        isActive: client.is_active,
        updatedAt: client.updated_at,
      }
    } catch (error) {
      logger.error("Error updating white label client:", error)
      throw error
    }
  }

  // Delete white label client
  async deleteClient(clientId) {
    try {
      const result = await query("DELETE FROM white_label_clients WHERE id = $1 RETURNING id", [clientId])

      if (result.rows.length === 0) {
        throw new Error("Client not found")
      }

      logger.info(`White label client deleted: ${clientId}`)

      return { success: true }
    } catch (error) {
      logger.error("Error deleting white label client:", error)
      throw error
    }
  }

  // Get client configuration by subdomain
  async getClientConfigBySubdomain(subdomain) {
    try {
      const result = await query(
        `
        SELECT client_name, subdomain, custom_domain, brand_config, features_config
        FROM white_label_clients
        WHERE subdomain = $1 AND is_active = true
      `,
        [subdomain],
      )

      if (result.rows.length === 0) {
        throw new Error("Client configuration not found")
      }

      const client = result.rows[0]

      return {
        clientName: client.client_name,
        subdomain: client.subdomain,
        customDomain: client.custom_domain,
        brandConfig: client.brand_config,
        featuresConfig: client.features_config,
      }
    } catch (error) {
      logger.error("Error getting client config by subdomain:", error)
      throw error
    }
  }

  // Get client configuration by custom domain
  async getClientConfigByDomain(domain) {
    try {
      const result = await query(
        `
        SELECT client_name, subdomain, custom_domain, brand_config, features_config
        FROM white_label_clients
        WHERE custom_domain = $1 AND is_active = true
      `,
        [domain],
      )

      if (result.rows.length === 0) {
        throw new Error("Client configuration not found")
      }

      const client = result.rows[0]

      return {
        clientName: client.client_name,
        subdomain: client.subdomain,
        customDomain: client.custom_domain,
        brandConfig: client.brand_config,
        featuresConfig: client.features_config,
      }
    } catch (error) {
      logger.error("Error getting client config by domain:", error)
      throw error
    }
  }

  // Get client statistics
  async getClientStats(clientId, { startDate, endDate } = {}) {
    try {
      const dateFilter = this._buildDateFilter(startDate, endDate)

      // Get user count
      const userCountResult = await query(
        `
        SELECT COUNT(*) as count
        FROM users u
        JOIN wallets w ON u.id = w.user_id
        WHERE w.white_label_client_id = $1
        ${dateFilter.userClause}
      `,
        [clientId, ...dateFilter.userParams],
      )

      // Get wallet count
      const walletCountResult = await query(
        `
        SELECT COUNT(*) as count
        FROM wallets
        WHERE white_label_client_id = $1
        ${dateFilter.walletClause}
      `,
        [clientId, ...dateFilter.walletParams],
      )

      // Get transaction count and volume
      const transactionStatsResult = await query(
        `
        SELECT 
          COUNT(*) as transaction_count,
          COALESCE(SUM(amount), 0) as total_volume,
          COALESCE(AVG(amount), 0) as avg_transaction_amount
        FROM transactions t
        JOIN wallets w ON t.wallet_id = w.id
        WHERE w.white_label_client_id = $1
        ${dateFilter.transactionClause}
      `,
        [clientId, ...dateFilter.transactionParams],
      )

      // Get total USDC balance
      const balanceResult = await query(
        `
        SELECT COALESCE(SUM(balance_usdc), 0) as total_balance
        FROM wallets
        WHERE white_label_client_id = $1 AND status = 'active'
      `,
        [clientId],
      )

      const userCount = Number.parseInt(userCountResult.rows[0].count)
      const walletCount = Number.parseInt(walletCountResult.rows[0].count)
      const transactionStats = transactionStatsResult.rows[0]
      const totalBalance = Number.parseFloat(balanceResult.rows[0].total_balance)

      return {
        userCount,
        walletCount,
        transactionCount: Number.parseInt(transactionStats.transaction_count),
        totalVolume: Number.parseFloat(transactionStats.total_volume),
        averageTransactionAmount: Number.parseFloat(transactionStats.avg_transaction_amount),
        totalBalance,
        period: {
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
        },
      }
    } catch (error) {
      logger.error("Error getting client stats:", error)
      throw new Error("Failed to get client statistics")
    }
  }

  // Get client users
  async getClientUsers(clientId, { page = 1, limit = 20, search = null }) {
    try {
      const offset = (page - 1) * limit

      let whereClause = "WHERE w.white_label_client_id = $1"
      const queryParams = [clientId, limit, offset]

      if (search) {
        whereClause += " AND (u.email ILIKE $4 OR u.first_name ILIKE $4 OR u.last_name ILIKE $4)"
        queryParams.push(`%${search}%`)
      }

      const result = await query(
        `
        SELECT DISTINCT u.id, u.email, u.first_name, u.last_name, 
               u.created_at, u.last_login, u.status
        FROM users u
        JOIN wallets w ON u.id = w.user_id
        ${whereClause}
        ORDER BY u.created_at DESC
        LIMIT $2 OFFSET $3
      `,
        queryParams,
      )

      // Get total count
      const countParams = search ? [clientId, `%${search}%`] : [clientId]
      const countResult = await query(
        `
        SELECT COUNT(DISTINCT u.id) as total
        FROM users u
        JOIN wallets w ON u.id = w.user_id
        ${whereClause}
      `,
        countParams,
      )

      const total = Number.parseInt(countResult.rows[0].total)

      return {
        users: result.rows.map((user) => ({
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          createdAt: user.created_at,
          lastLogin: user.last_login,
          status: user.status,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      }
    } catch (error) {
      logger.error("Error getting client users:", error)
      throw new Error("Failed to get client users")
    }
  }

  // Get client transactions
  async getClientTransactions(clientId, { page = 1, limit = 50, startDate, endDate }) {
    try {
      const offset = (page - 1) * limit
      const dateFilter = this._buildDateFilter(startDate, endDate)

      const result = await query(
        `
        SELECT t.id, t.transaction_hash, t.from_address, t.to_address,
               t.amount, t.transaction_type, t.status, t.memo,
               t.created_at, t.confirmed_at, w.wallet_name
        FROM transactions t
        JOIN wallets w ON t.wallet_id = w.id
        WHERE w.white_label_client_id = $1
        ${dateFilter.transactionClause}
        ORDER BY t.created_at DESC
        LIMIT $2 OFFSET $3
      `,
        [clientId, limit, offset, ...dateFilter.transactionParams],
      )

      // Get total count
      const countResult = await query(
        `
        SELECT COUNT(*) as total
        FROM transactions t
        JOIN wallets w ON t.wallet_id = w.id
        WHERE w.white_label_client_id = $1
        ${dateFilter.transactionClause}
      `,
        [clientId, ...dateFilter.transactionParams],
      )

      const total = Number.parseInt(countResult.rows[0].total)

      return {
        transactions: result.rows.map((tx) => ({
          id: tx.id,
          transactionHash: tx.transaction_hash,
          fromAddress: tx.from_address,
          toAddress: tx.to_address,
          amount: tx.amount,
          type: tx.transaction_type,
          status: tx.status,
          memo: tx.memo,
          walletName: tx.wallet_name,
          createdAt: tx.created_at,
          confirmedAt: tx.confirmed_at,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      }
    } catch (error) {
      logger.error("Error getting client transactions:", error)
      throw new Error("Failed to get client transactions")
    }
  }

  // Helper method to build date filters
  _buildDateFilter(startDate, endDate) {
    let userClause = ""
    let walletClause = ""
    let transactionClause = ""
    let userParams = []
    let walletParams = []
    let transactionParams = []

    if (startDate || endDate) {
      if (startDate && endDate) {
        userClause = "AND u.created_at BETWEEN $2 AND $3"
        walletClause = "AND created_at BETWEEN $2 AND $3"
        transactionClause = "AND t.created_at BETWEEN $4 AND $5"
        userParams = [startDate, endDate]
        walletParams = [startDate, endDate]
        transactionParams = [startDate, endDate]
      } else if (startDate) {
        userClause = "AND u.created_at >= $2"
        walletClause = "AND created_at >= $2"
        transactionClause = "AND t.created_at >= $4"
        userParams = [startDate]
        walletParams = [startDate]
        transactionParams = [startDate]
      } else if (endDate) {
        userClause = "AND u.created_at <= $2"
        walletClause = "AND created_at <= $2"
        transactionClause = "AND t.created_at <= $4"
        userParams = [endDate]
        walletParams = [endDate]
        transactionParams = [endDate]
      }
    }

    return {
      userClause,
      walletClause,
      transactionClause,
      userParams,
      walletParams,
      transactionParams,
    }
  }
}

module.exports = new WhitelabelService()
