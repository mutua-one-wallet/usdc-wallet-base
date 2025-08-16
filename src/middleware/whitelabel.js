const { query } = require("../config/database")
const logger = require("../utils/logger")

// Middleware to detect and apply white label configuration
const applyWhitelabelConfig = async (req, res, next) => {
  try {
    let clientConfig = null

    // Try to detect client from subdomain or custom domain
    const host = req.get("host")

    if (host) {
      // Check if it's a subdomain (e.g., client.usdcwallet.com)
      const subdomainMatch = host.match(/^([^.]+)\./)
      if (subdomainMatch && subdomainMatch[1] !== "www" && subdomainMatch[1] !== "api") {
        const subdomain = subdomainMatch[1]

        try {
          const result = await query(
            `
            SELECT id, client_name, brand_config, features_config
            FROM white_label_clients
            WHERE subdomain = $1 AND is_active = true
          `,
            [subdomain],
          )

          if (result.rows.length > 0) {
            clientConfig = {
              id: result.rows[0].id,
              clientName: result.rows[0].client_name,
              brandConfig: result.rows[0].brand_config,
              featuresConfig: result.rows[0].features_config,
            }
          }
        } catch (error) {
          logger.error("Error checking subdomain:", error)
        }
      }

      // If no subdomain match, check custom domains
      if (!clientConfig) {
        try {
          const result = await query(
            `
            SELECT id, client_name, brand_config, features_config
            FROM white_label_clients
            WHERE custom_domain = $1 AND is_active = true
          `,
            [host],
          )

          if (result.rows.length > 0) {
            clientConfig = {
              id: result.rows[0].id,
              clientName: result.rows[0].client_name,
              brandConfig: result.rows[0].brand_config,
              featuresConfig: result.rows[0].features_config,
            }
          }
        } catch (error) {
          logger.error("Error checking custom domain:", error)
        }
      }
    }

    // Attach client config to request
    req.whitelabelClient = clientConfig

    next()
  } catch (error) {
    logger.error("Error in whitelabel middleware:", error)
    next() // Continue without white label config
  }
}

// Middleware to check feature permissions
const checkFeaturePermission = (feature) => {
  return (req, res, next) => {
    const clientConfig = req.whitelabelClient

    if (!clientConfig) {
      // No white label client, allow all features
      return next()
    }

    const featuresConfig = clientConfig.featuresConfig
    const allowedFeatures = featuresConfig?.features || []

    if (!allowedFeatures.includes(feature)) {
      return res.status(403).json({
        success: false,
        message: `Feature '${feature}' is not enabled for this client`,
      })
    }

    next()
  }
}

// Middleware to check transaction limits
const checkTransactionLimits = async (req, res, next) => {
  try {
    const clientConfig = req.whitelabelClient
    const userId = req.user?.id

    if (!clientConfig || !userId) {
      return next()
    }

    const { amount } = req.body
    const featuresConfig = clientConfig.featuresConfig

    if (!featuresConfig) {
      return next()
    }

    const dailyLimit = featuresConfig.dailyTransactionLimit || 10000
    const monthlyLimit = featuresConfig.monthlyTransactionLimit || 100000

    // Check daily limit
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const dailyResult = await query(
      `
      SELECT COALESCE(SUM(t.amount), 0) as daily_total
      FROM transactions t
      JOIN wallets w ON t.wallet_id = w.id
      WHERE w.user_id = $1 AND w.white_label_client_id = $2
      AND t.created_at >= $3 AND t.created_at < $4
      AND t.status != 'failed'
    `,
      [userId, clientConfig.id, today, tomorrow],
    )

    const dailyTotal = Number.parseFloat(dailyResult.rows[0].daily_total)

    if (dailyTotal + Number.parseFloat(amount) > dailyLimit) {
      return res.status(400).json({
        success: false,
        message: `Daily transaction limit of $${dailyLimit} would be exceeded`,
        data: {
          dailyLimit,
          dailyUsed: dailyTotal,
          dailyRemaining: dailyLimit - dailyTotal,
        },
      })
    }

    // Check monthly limit
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1)

    const monthlyResult = await query(
      `
      SELECT COALESCE(SUM(t.amount), 0) as monthly_total
      FROM transactions t
      JOIN wallets w ON t.wallet_id = w.id
      WHERE w.user_id = $1 AND w.white_label_client_id = $2
      AND t.created_at >= $3 AND t.created_at < $4
      AND t.status != 'failed'
    `,
      [userId, clientConfig.id, monthStart, monthEnd],
    )

    const monthlyTotal = Number.parseFloat(monthlyResult.rows[0].monthly_total)

    if (monthlyTotal + Number.parseFloat(amount) > monthlyLimit) {
      return res.status(400).json({
        success: false,
        message: `Monthly transaction limit of $${monthlyLimit} would be exceeded`,
        data: {
          monthlyLimit,
          monthlyUsed: monthlyTotal,
          monthlyRemaining: monthlyLimit - monthlyTotal,
        },
      })
    }

    next()
  } catch (error) {
    logger.error("Error checking transaction limits:", error)
    next() // Continue without limit check
  }
}

module.exports = {
  applyWhitelabelConfig,
  checkFeaturePermission,
  checkTransactionLimits,
}
