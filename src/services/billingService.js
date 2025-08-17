const db = require("../config/database")
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const logger = require("../utils/logger")

class BillingService {
  // Create subscription for white label client
  async createSubscription(clientId, planId, paymentMethodId) {
    try {
      const client = await db.query("SELECT * FROM white_label_clients WHERE id = $1", [clientId])
      const plan = await db.query("SELECT * FROM subscription_plans WHERE id = $1", [planId])

      if (!client.rows[0] || !plan.rows[0]) {
        throw new Error("Client or plan not found")
      }

      // Create Stripe customer if not exists
      let stripeCustomer
      if (!client.rows[0].stripe_customer_id) {
        stripeCustomer = await stripe.customers.create({
          email: client.rows[0].contact_email,
          name: client.rows[0].client_name,
          metadata: { client_id: clientId },
        })

        await db.query("UPDATE white_label_clients SET stripe_customer_id = $1 WHERE id = $2", [
          stripeCustomer.id,
          clientId,
        ])
      }

      // Create Stripe subscription
      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomer.id,
        items: [{ price: plan.rows[0].stripe_price_id }],
        default_payment_method: paymentMethodId,
        metadata: { client_id: clientId, plan_id: planId },
      })

      // Save subscription to database
      await db.query(
        `INSERT INTO client_subscriptions 
         (client_id, plan_id, stripe_subscription_id, status, current_period_start, current_period_end)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          clientId,
          planId,
          subscription.id,
          subscription.status,
          new Date(subscription.current_period_start * 1000),
          new Date(subscription.current_period_end * 1000),
        ],
      )

      return subscription
    } catch (error) {
      logger.error("Create Subscription Error:", error)
      throw error
    }
  }

  // Calculate usage billing for API clients
  async calculateUsageBilling(clientId, periodStart, periodEnd) {
    try {
      // Get usage statistics
      const usageStats = await db.query(
        `SELECT 
          COUNT(*) as api_calls,
          COUNT(CASE WHEN action = 'send_transaction' THEN 1 END) as transactions,
          COUNT(CASE WHEN action = 'create_wallet' THEN 1 END) as wallets_created
         FROM api_usage_logs 
         WHERE client_id = $1 AND created_at BETWEEN $2 AND $3`,
        [clientId, periodStart, periodEnd],
      )

      // Get transaction volume
      const volumeStats = await db.query(
        `SELECT COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total_volume
         FROM transactions 
         WHERE api_client_id = $1 AND created_at BETWEEN $2 AND $3`,
        [clientId, periodStart, periodEnd],
      )

      const stats = usageStats.rows[0]
      const volume = volumeStats.rows[0].total_volume

      // Calculate costs based on pricing model
      const apiCallsCost = Number.parseInt(stats.api_calls) * 0.01 // $0.01 per API call
      const transactionCost = Number.parseInt(stats.transactions) * 0.5 // $0.50 per transaction
      const walletCost = Number.parseInt(stats.wallets_created) * 0.5 // $0.50 per wallet
      const volumeFee = Number.parseFloat(volume) * 0.001 // 0.1% of volume

      const totalCost = apiCallsCost + transactionCost + walletCost + volumeFee

      // Save billing record
      const billing = await db.query(
        `INSERT INTO usage_billing 
         (client_id, billing_period_start, billing_period_end, api_calls_count, 
          transactions_count, wallets_created, total_volume, api_calls_cost, 
          transaction_cost, wallet_cost, total_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          clientId,
          periodStart,
          periodEnd,
          stats.api_calls,
          stats.transactions,
          stats.wallets_created,
          volume,
          apiCallsCost,
          transactionCost,
          walletCost,
          totalCost,
        ],
      )

      return billing.rows[0]
    } catch (error) {
      logger.error("Calculate Usage Billing Error:", error)
      throw error
    }
  }

  // Process revenue sharing for partners
  async calculateRevenueSharing(partnerId, periodStart, periodEnd) {
    try {
      // Get referred clients and their revenue
      const revenueData = await db.query(
        `SELECT 
          wlc.id as client_id,
          COALESCE(SUM(ub.total_cost), 0) as client_revenue
         FROM white_label_clients wlc
         LEFT JOIN usage_billing ub ON wlc.id = ub.client_id
         WHERE wlc.referred_by = $1 
         AND ub.billing_period_start >= $2 
         AND ub.billing_period_end <= $3
         GROUP BY wlc.id`,
        [partnerId, periodStart, periodEnd],
      )

      const totalRevenue = revenueData.rows.reduce((sum, row) => sum + Number.parseFloat(row.client_revenue), 0)
      const commissionRate = 0.2 // 20% commission
      const commissionAmount = totalRevenue * commissionRate

      // Save revenue sharing record
      const revenueSharing = await db.query(
        `INSERT INTO revenue_sharing 
         (partner_id, revenue_period_start, revenue_period_end, total_revenue, 
          commission_rate, commission_amount)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [partnerId, periodStart, periodEnd, totalRevenue, commissionRate, commissionAmount],
      )

      return revenueSharing.rows[0]
    } catch (error) {
      logger.error("Calculate Revenue Sharing Error:", error)
      throw error
    }
  }

  // Get client billing dashboard
  async getBillingDashboard(clientId) {
    try {
      // Current subscription
      const subscription = await db.query(
        `SELECT cs.*, sp.name as plan_name, sp.price_monthly, sp.features
         FROM client_subscriptions cs
         JOIN subscription_plans sp ON cs.plan_id = sp.id
         WHERE cs.client_id = $1 AND cs.status = 'active'`,
        [clientId],
      )

      // Current month usage
      const currentMonth = new Date()
      currentMonth.setDate(1)
      const nextMonth = new Date(currentMonth)
      nextMonth.setMonth(nextMonth.getMonth() + 1)

      const usage = await db.query(
        `SELECT * FROM usage_billing 
         WHERE client_id = $1 AND billing_period_start >= $2`,
        [clientId, currentMonth],
      )

      // Revenue sharing if partner
      const revenueSharing = await db.query(
        `SELECT * FROM revenue_sharing 
         WHERE partner_id = $1 
         ORDER BY revenue_period_start DESC LIMIT 12`,
        [clientId],
      )

      return {
        subscription: subscription.rows[0] || null,
        current_usage: usage.rows[0] || null,
        revenue_sharing: revenueSharing.rows,
      }
    } catch (error) {
      logger.error("Get Billing Dashboard Error:", error)
      throw error
    }
  }
}

module.exports = new BillingService()
