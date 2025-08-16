const { Pool } = require("pg")
const logger = require("../utils/logger")

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "usdc_wallet",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

const connectDB = async () => {
  try {
    const client = await pool.connect()
    logger.info("PostgreSQL connected successfully")
    client.release()
  } catch (error) {
    logger.error("Database connection failed:", error)
    throw error
  }
}

const query = async (text, params) => {
  const start = Date.now()
  try {
    const res = await pool.query(text, params)
    const duration = Date.now() - start
    logger.debug(`Query executed in ${duration}ms: ${text}`)
    return res
  } catch (error) {
    logger.error("Database query error:", error)
    throw error
  }
}

module.exports = {
  connectDB,
  query,
  pool,
}
