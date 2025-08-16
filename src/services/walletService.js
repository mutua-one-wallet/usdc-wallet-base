const { query } = require("../config/database")
const blockchainService = require("./blockchain")
const logger = require("../utils/logger")

class WalletService {
  // Create new wallet for user
  async createWallet(userId, walletName, whitelabelClientId = null) {
    try {
      // Check if user already has a wallet with this name
      const existingWallet = await query("SELECT id FROM wallets WHERE user_id = $1 AND wallet_name = $2", [
        userId,
        walletName,
      ])

      if (existingWallet.rows.length > 0) {
        throw new Error("Wallet with this name already exists")
      }

      // Generate new wallet
      const walletData = blockchainService.generateWallet()

      // Check if this is the user's first wallet (make it primary)
      const userWallets = await query("SELECT COUNT(*) as count FROM wallets WHERE user_id = $1", [userId])
      const isPrimary = userWallets.rows[0].count === "0"

      // Store wallet in database
      const result = await query(
        `
        INSERT INTO wallets (user_id, white_label_client_id, wallet_name, address, encrypted_private_key, is_primary)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, address, wallet_name, is_primary, created_at
      `,
        [
          userId,
          whitelabelClientId,
          walletName,
          walletData.address,
          JSON.stringify(walletData.encryptedPrivateKey),
          isPrimary,
        ],
      )

      const wallet = result.rows[0]

      // Get initial balance
      const balance = await this.updateWalletBalance(wallet.id)

      logger.info(`New wallet created for user ${userId}: ${wallet.address}`)

      return {
        id: wallet.id,
        address: wallet.address,
        walletName: wallet.wallet_name,
        isPrimary: wallet.is_primary,
        balance: balance.balance_usdc,
        createdAt: wallet.created_at,
      }
    } catch (error) {
      logger.error("Error creating wallet:", error)
      throw error
    }
  }

  // Get user's wallets
  async getUserWallets(userId) {
    try {
      const result = await query(
        `
        SELECT id, wallet_name, address, balance_usdc, is_primary, 
               last_balance_update, created_at, status
        FROM wallets 
        WHERE user_id = $1 AND status = 'active'
        ORDER BY is_primary DESC, created_at ASC
      `,
        [userId],
      )

      return result.rows.map((wallet) => ({
        id: wallet.id,
        walletName: wallet.wallet_name,
        address: wallet.address,
        balance: wallet.balance_usdc || "0",
        isPrimary: wallet.is_primary,
        lastBalanceUpdate: wallet.last_balance_update,
        createdAt: wallet.created_at,
        status: wallet.status,
      }))
    } catch (error) {
      logger.error("Error getting user wallets:", error)
      throw new Error("Failed to get user wallets")
    }
  }

  // Get wallet by ID (with ownership check)
  async getWallet(walletId, userId) {
    try {
      const result = await query(
        `
        SELECT id, user_id, wallet_name, address, balance_usdc, is_primary,
               last_balance_update, created_at, status
        FROM wallets 
        WHERE id = $1 AND user_id = $2 AND status = 'active'
      `,
        [walletId, userId],
      )

      if (result.rows.length === 0) {
        throw new Error("Wallet not found or access denied")
      }

      const wallet = result.rows[0]

      return {
        id: wallet.id,
        walletName: wallet.wallet_name,
        address: wallet.address,
        balance: wallet.balance_usdc || "0",
        isPrimary: wallet.is_primary,
        lastBalanceUpdate: wallet.last_balance_update,
        createdAt: wallet.created_at,
        status: wallet.status,
      }
    } catch (error) {
      logger.error("Error getting wallet:", error)
      throw error
    }
  }

  // Update wallet balance from blockchain
  async updateWalletBalance(walletId) {
    try {
      const walletResult = await query("SELECT address FROM wallets WHERE id = $1", [walletId])

      if (walletResult.rows.length === 0) {
        throw new Error("Wallet not found")
      }

      const address = walletResult.rows[0].address
      const balanceData = await blockchainService.getUSDCBalance(address)

      // Update balance in database
      await query("UPDATE wallets SET balance_usdc = $1, last_balance_update = NOW() WHERE id = $2", [
        balanceData.balance,
        walletId,
      ])

      logger.info(`Updated balance for wallet ${walletId}: ${balanceData.balance} USDC`)

      return {
        walletId: walletId,
        address: address,
        balance_usdc: balanceData.balance,
        balance_wei: balanceData.balanceWei,
      }
    } catch (error) {
      logger.error("Error updating wallet balance:", error)
      throw error
    }
  }

  // Send USDC from wallet
  async sendUSDC(walletId, userId, toAddress, amount, memo = null) {
    try {
      // Validate recipient address
      if (!blockchainService.isValidAddress(toAddress)) {
        throw new Error("Invalid recipient address")
      }

      // Get wallet with encrypted private key
      const walletResult = await query(
        `
        SELECT id, address, encrypted_private_key, balance_usdc
        FROM wallets 
        WHERE id = $1 AND user_id = $2 AND status = 'active'
      `,
        [walletId, userId],
      )

      if (walletResult.rows.length === 0) {
        throw new Error("Wallet not found or access denied")
      }

      const wallet = walletResult.rows[0]
      const encryptedPrivateKey = JSON.parse(wallet.encrypted_private_key)

      // Check sufficient balance
      const currentBalance = Number.parseFloat(wallet.balance_usdc || "0")
      if (currentBalance < Number.parseFloat(amount)) {
        throw new Error("Insufficient USDC balance")
      }

      // Check ETH balance for gas
      const ethBalance = await blockchainService.getETHBalance(wallet.address)
      if (Number.parseFloat(ethBalance.balance) < 0.001) {
        // Minimum ETH for gas
        throw new Error("Insufficient ETH balance for gas fees")
      }

      // Send transaction
      const txResult = await blockchainService.sendUSDC(encryptedPrivateKey, toAddress, amount)

      // Record transaction in database
      const transactionResult = await query(
        `
        INSERT INTO transactions (
          wallet_id, transaction_hash, from_address, to_address, amount,
          gas_used, gas_price, transaction_type, status, memo
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, created_at
      `,
        [
          walletId,
          txResult.transactionHash,
          wallet.address,
          toAddress,
          amount,
          txResult.gasUsed,
          txResult.gasPrice,
          "send",
          "pending",
          memo,
        ],
      )

      const transaction = transactionResult.rows[0]

      logger.info(`USDC sent from wallet ${walletId}: ${amount} USDC to ${toAddress}`)

      return {
        transactionId: transaction.id,
        transactionHash: txResult.transactionHash,
        from: wallet.address,
        to: toAddress,
        amount: amount,
        status: "pending",
        createdAt: transaction.created_at,
      }
    } catch (error) {
      logger.error("Error sending USDC:", error)
      throw error
    }
  }

  // Get wallet transaction history
  async getTransactionHistory(walletId, userId, limit = 50, offset = 0) {
    try {
      // Verify wallet ownership
      const walletResult = await query("SELECT id FROM wallets WHERE id = $1 AND user_id = $2", [walletId, userId])

      if (walletResult.rows.length === 0) {
        throw new Error("Wallet not found or access denied")
      }

      const result = await query(
        `
        SELECT id, transaction_hash, from_address, to_address, amount,
               transaction_type, status, memo, created_at, confirmed_at,
               gas_used, transaction_fee, confirmations
        FROM transactions 
        WHERE wallet_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
        [walletId, limit, offset],
      )

      return result.rows.map((tx) => ({
        id: tx.id,
        transactionHash: tx.transaction_hash,
        from: tx.from_address,
        to: tx.to_address,
        amount: tx.amount,
        type: tx.transaction_type,
        status: tx.status,
        memo: tx.memo,
        createdAt: tx.created_at,
        confirmedAt: tx.confirmed_at,
        gasUsed: tx.gas_used,
        transactionFee: tx.transaction_fee,
        confirmations: tx.confirmations,
      }))
    } catch (error) {
      logger.error("Error getting transaction history:", error)
      throw error
    }
  }

  // Set primary wallet
  async setPrimaryWallet(walletId, userId) {
    try {
      // Verify wallet ownership
      const walletResult = await query("SELECT id FROM wallets WHERE id = $1 AND user_id = $2", [walletId, userId])

      if (walletResult.rows.length === 0) {
        throw new Error("Wallet not found or access denied")
      }

      // Remove primary flag from all user's wallets
      await query("UPDATE wallets SET is_primary = false WHERE user_id = $1", [userId])

      // Set new primary wallet
      await query("UPDATE wallets SET is_primary = true WHERE id = $1", [walletId])

      logger.info(`Set primary wallet for user ${userId}: ${walletId}`)

      return { success: true }
    } catch (error) {
      logger.error("Error setting primary wallet:", error)
      throw error
    }
  }
}

module.exports = new WalletService()
