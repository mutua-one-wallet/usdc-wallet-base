const logger = require("../utils/logger")

const errorHandler = (err, req, res, next) => {
  logger.error("Unhandled error:", {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  })

  // Default error response
  const error = {
    success: false,
    message: "Internal server error",
  }

  // Handle specific error types
  if (err.name === "ValidationError") {
    error.message = "Validation failed"
    error.details = err.details
    return res.status(400).json(error)
  }

  if (err.name === "UnauthorizedError") {
    error.message = "Unauthorized access"
    return res.status(401).json(error)
  }

  if (err.code === "23505") {
    // PostgreSQL unique violation
    error.message = "Resource already exists"
    return res.status(409).json(error)
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === "production") {
    return res.status(500).json(error)
  }

  // Include error details in development
  error.details = err.message
  error.stack = err.stack

  res.status(500).json(error)
}

module.exports = errorHandler
