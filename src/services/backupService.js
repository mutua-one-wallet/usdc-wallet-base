const crypto = require("crypto")
const { query } = require("../config/database")
const blockchainService = require("./blockchain")
const logger = require("../utils/logger")

class BackupService {
  // Generate mnemonic phrase for wallet backup
  generateMnemonic() {
    try {
      // Generate 12-word mnemonic using ethers
      const { ethers } = require("ethers")
      const wallet = ethers.Wallet.createRandom()
      return wallet.mnemonic.phrase
    } catch (error) {
      logger.error("Error generating mnemonic:", error)
      throw new Error("Failed to generate backup phrase")
    }
  }

  // Create wallet from mnemonic
  createWalletFromMnemonic(mnemonic, derivationPath = "m/44'/60'/0'/0/0") {
    try {
      const { ethers } = require("ethers")
      const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic, null, derivationPath)

      const encryptedPrivateKey = blockchainService.encryptPrivateKey(hdNode.privateKey)

      return {
        address: hdNode.address,
        encryptedPrivateKey: encryptedPrivateKey,
        publicKey: hdNode.publicKey,
        derivationPath: derivationPath,
        mnemonic: mnemonic,
      }
    } catch (error) {
      logger.error("Error creating wallet from mnemonic:", error)
      throw new Error("Invalid mnemonic phrase")
    }
  }

  // Import existing wallet
  async importWallet(userId, privateKey, walletName, whitelabelClientId = null) {
    try {
      const { ethers } = require("ethers")

      // Validate private key
      let wallet
      try {
        wallet = new ethers.Wallet(privateKey)
      } catch (error) {
        throw new Error("Invalid private key")
      }

      // Check if wallet already exists
      const existingWallet = await query("SELECT id FROM wallets WHERE address = $1", [wallet.address])

      if (existingWallet.rows.length > 0) {
        throw new Error("Wallet with this address already exists")
      }

      // Encrypt private key
      const encryptedPrivateKey = blockchainService.encryptPrivateKey(privateKey)

      // Check if this is the user's first wallet
      const userWallets = await query("SELECT COUNT(*) as count FROM wallets WHERE user_id = $1", [userId])
      const isPrimary = userWallets.rows[0].count === "0"

      // Store wallet in database
      const result = await query(
        `
        INSERT INTO wallets (user_id, white_label_client_id, wallet_name, address, encrypted_private_key, is_primary)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, address, wallet_name, is_primary, created_at
      `,
        [userId, whitelabelClientId, walletName, wallet.address, JSON.stringify(encryptedPrivateKey), isPrimary],
      )

      const importedWallet = result.rows[0]

      logger.info(`Wallet imported for user ${userId}: ${wallet.address}`)

      return {
        id: importedWallet.id,
        address: importedWallet.address,
        walletName: importedWallet.wallet_name,
        isPrimary: importedWallet.is_primary,
        createdAt: importedWallet.created_at,
      }
    } catch (error) {
      logger.error("Error importing wallet:", error)
      throw error
    }
  }

  // Generate encrypted backup data
  async createBackup(userId, password) {
    try {
      // Get all user wallets
      const walletsResult = await query(
        `
        SELECT id, wallet_name, address, encrypted_private_key, is_primary, created_at
        FROM wallets 
        WHERE user_id = $1 AND status = 'active'
      `,
        [userId],
      )

      if (walletsResult.rows.length === 0) {
        throw new Error("No wallets found to backup")
      }

      const backupData = {
        version: "1.0",
        timestamp: new Date().toISOString(),
        userId: userId,
        wallets: walletsResult.rows.map((wallet) => ({
          id: wallet.id,
          walletName: wallet.wallet_name,
          address: wallet.address,
          encryptedPrivateKey: wallet.encrypted_private_key,
          isPrimary: wallet.is_primary,
          createdAt: wallet.created_at,
        })),
      }

      // Encrypt backup with user password
      const backupJson = JSON.stringify(backupData)
      const encryptedBackup = this.encryptBackup(backupJson, password)

      logger.info(`Backup created for user ${userId}`)

      return {
        backup: encryptedBackup,
        walletCount: walletsResult.rows.length,
        createdAt: new Date().toISOString(),
      }
    } catch (error) {
      logger.error("Error creating backup:", error)
      throw error
    }
  }

  // Restore wallets from backup
  async restoreFromBackup(userId, encryptedBackup, password, whitelabelClientId = null) {
    try {
      // Decrypt backup
      const backupJson = this.decryptBackup(encryptedBackup, password)
      const backupData = JSON.parse(backupJson)

      if (backupData.version !== "1.0") {
        throw new Error("Unsupported backup version")
      }

      const restoredWallets = []

      for (const walletData of backupData.wallets) {
        try {
          // Check if wallet already exists
          const existingWallet = await query("SELECT id FROM wallets WHERE address = $1", [walletData.address])

          if (existingWallet.rows.length > 0) {
            logger.warn(`Wallet ${walletData.address} already exists, skipping`)
            continue
          }

          // Restore wallet
          const result = await query(
            `
            INSERT INTO wallets (user_id, white_label_client_id, wallet_name, address, encrypted_private_key, is_primary)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, address, wallet_name
          `,
            [
              userId,
              whitelabelClientId,
              walletData.walletName,
              walletData.address,
              walletData.encryptedPrivateKey,
              false, // Don't restore primary status
            ],
          )

          restoredWallets.push(result.rows[0])
        } catch (error) {
          logger.error(`Error restoring wallet ${walletData.address}:`, error)
          // Continue with other wallets
        }
      }

      logger.info(`Restored ${restoredWallets.length} wallets for user ${userId}`)

      return {
        restoredWallets: restoredWallets,
        totalInBackup: backupData.wallets.length,
        restoredCount: restoredWallets.length,
      }
    } catch (error) {
      logger.error("Error restoring backup:", error)
      throw error
    }
  }

  // Encrypt backup data
  encryptBackup(data, password) {
    try {
      const algorithm = "aes-256-gcm"
      const salt = crypto.randomBytes(16)
      const key = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256")
      const iv = crypto.randomBytes(16)

      const cipher = crypto.createCipher(algorithm, key)

      let encrypted = cipher.update(data, "utf8", "hex")
      encrypted += cipher.final("hex")

      const authTag = cipher.getAuthTag()

      return {
        encrypted: encrypted,
        salt: salt.toString("hex"),
        iv: iv.toString("hex"),
        authTag: authTag.toString("hex"),
      }
    } catch (error) {
      logger.error("Error encrypting backup:", error)
      throw new Error("Failed to encrypt backup")
    }
  }

  // Decrypt backup data
  decryptBackup(encryptedData, password) {
    try {
      const algorithm = "aes-256-gcm"
      const salt = Buffer.from(encryptedData.salt, "hex")
      const key = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256")

      const decipher = crypto.createDecipher(algorithm, key)
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, "hex"))

      let decrypted = decipher.update(encryptedData.encrypted, "hex", "utf8")
      decrypted += decipher.final("utf8")

      return decrypted
    } catch (error) {
      logger.error("Error decrypting backup:", error)
      throw new Error("Failed to decrypt backup - invalid password or corrupted data")
    }
  }
}

module.exports = new BackupService()
