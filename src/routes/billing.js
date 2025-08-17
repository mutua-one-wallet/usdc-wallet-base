const express = require("express")
const router = express.Router()
const { body, validationResult } = require("express-validator")
const billingService = require("../services/billingService")
const { authenticateToken } = require("../middleware/auth")
const logger = require("../utils/logger")

// Get billing dashboard
router.get("/dashboard", authenticateToken, async (req, res) => {
  try {
    const clientId = req.user.white_label_client_id
    if (!clientId) {
      return res.status(403).json({ error: "Access denied" })
    }

    const dashboard = await billingService.getBillingDashboard(clientId)
    res.json({ success: true, data: dashboard })
  } catch (error) {
    logger.error("Billing Dashboard Error:", error)
    res.status(500).json({ error: "Failed to load billing dashboard" })
  }
})

// Get available subscription plans
router.get("/plans", async (req, res) => {
  try {
    const db = require("../config/database")
    const plans = await db.query("SELECT * FROM subscription_plans WHERE is_active = true ORDER BY price_monthly")

    res.json({ success: true, data: plans.rows })
  } catch (error) {
    logger.error("Get Plans Error:", error)
    res.status(500).json({ error: "Failed to load plans" })
  }
})

// Create subscription
router.post(
  "/subscribe",
  authenticateToken,
  [body("plan_id").isUUID().withMessage("Invalid plan ID"), body("payment_method_id").notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: "Validation failed", details: errors.array() })
      }

      const clientId = req.user.white_label_client_id
      const { plan_id, payment_method_id } = req.body

      const subscription = await billingService.createSubscription(clientId, plan_id, payment_method_id)

      res.json({
        success: true,
        data: {
          subscription_id: subscription.id,
          status: subscription.status,
          current_period_end: subscription.current_period_end,
        },
      })
    } catch (error) {
      logger.error("Create Subscription Error:", error)
      res.status(500).json({ error: "Failed to create subscription" })
    }
  },
)

// Webhook for Stripe events
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"]
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)

    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)

    // Handle subscription events
    switch (event.type) {
      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object)
        break
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object)
        break
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object)
        break
    }

    res.json({ received: true })
  } catch (error) {
    logger.error("Stripe Webhook Error:", error)
    res.status(400).json({ error: "Webhook error" })
  }
})

// Helper functions for webhook handling
async function handlePaymentSucceeded(invoice) {
  const db = require("../config/database")
  await db.query("UPDATE usage_billing SET status = 'paid' WHERE stripe_invoice_id = $1", [invoice.id])
}

async function handlePaymentFailed(invoice) {
  const db = require("../config/database")
  await db.query("UPDATE client_subscriptions SET status = 'past_due' WHERE stripe_subscription_id = $1", [
    invoice.subscription,
  ])
}

async function handleSubscriptionUpdated(subscription) {
  const db = require("../config/database")
  await db.query(
    "UPDATE client_subscriptions SET status = $1, current_period_end = $2 WHERE stripe_subscription_id = $3",
    [subscription.status, new Date(subscription.current_period_end * 1000), subscription.id],
  )
}

module.exports = router
