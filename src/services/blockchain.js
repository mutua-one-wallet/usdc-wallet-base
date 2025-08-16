const { ethers } = require("ethers")
const crypto = require("crypto")
const logger = require("../utils/logger")

// USDC Contract ABI (simplified for essential functions)
const USDC_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]

class BlockchainService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL)
    this.chainId = Number.parseInt(process.env.BASE_CHAIN_ID)
    this.usdcContractAddress = process.env.USDC_CONTRACT_ADDRESS
    this.usdcContract = new ethers.Contract(this.usdcContractAddress, USDC_ABI, this.provider)
    this.encryptionKey = process.env.WALLET_ENCRYPTION_KEY
  }

  // Generate new wallet with secure key generation
  generateWallet() {
    try {
      const wallet = ethers.Wallet.createRandom()
      const encryptedPrivateKey = this.encryptPrivateKey(wallet.privateKey)

      return {
        address: wallet.address,
        encryptedPrivateKey: encryptedPrivateKey,
        publicKey: wallet.publicKey,
      }
    } catch (error) {
      logger.error("Error generating wallet:", error)
      throw new Error("Failed to generate wallet")
    }
  }

  // Encrypt private key for secure storage
  encryptPrivateKey(privateKey) {
    try {
      const algorithm = "aes-256-gcm"
      const iv = crypto.randomBytes(16)
      const cipher = crypto.createCipher(algorithm, this.encryptionKey)

      let encrypted = cipher.update(privateKey, "utf8", "hex")
      encrypted += cipher.final("hex")

      const authTag = cipher.getAuthTag()

      return {
        encrypted: encrypted,
        iv: iv.toString("hex"),
        authTag: authTag.toString("hex"),
      }
    } catch (error) {
      logger.error("Error encrypting private key:", error)
      throw new Error("Failed to encrypt private key")
    }
  }

  // Decrypt private key for transaction signing
  decryptPrivateKey(encryptedData) {
    try {
      const algorithm = "aes-256-gcm"
      const decipher = crypto.createDecipher(algorithm, this.encryptionKey)

      decipher.setAuthTag(Buffer.from(encryptedData.authTag, "hex"))

      let decrypted = decipher.update(encryptedData.encrypted, "hex", "utf8")
      decrypted += decipher.final("utf8")

      return decrypted
    } catch (error) {
      logger.error("Error decrypting private key:", error)
      throw new Error("Failed to decrypt private key")
    }
  }

  // Get USDC balance for an address
  async getUSDCBalance(address) {
    try {
      const balance = await this.usdcContract.balanceOf(address)
      const decimals = await this.usdcContract.decimals()

      // Convert from wei to USDC (6 decimals)
      const formattedBalance = ethers.formatUnits(balance, decimals)

      return {
        balance: formattedBalance,
        balanceWei: balance.toString(),
        decimals: decimals,
      }
    } catch (error) {
      logger.error(`Error getting USDC balance for ${address}:`, error)
      throw new Error("Failed to get USDC balance")
    }
  }

  // Get ETH balance for gas fees
  async getETHBalance(address) {
    try {
      const balance = await this.provider.getBalance(address)
      const formattedBalance = ethers.formatEther(balance)

      return {
        balance: formattedBalance,
        balanceWei: balance.toString(),
      }
    } catch (error) {
      logger.error(`Error getting ETH balance for ${address}:`, error)
      throw new Error("Failed to get ETH balance")
    }
  }

  // Send USDC transaction
  async sendUSDC(fromEncryptedKey, toAddress, amount, gasPrice = null) {
    try {
      // Decrypt private key
      const privateKey = this.decryptPrivateKey(fromEncryptedKey)
      const wallet = new ethers.Wallet(privateKey, this.provider)

      // Get contract with signer
      const usdcWithSigner = this.usdcContract.connect(wallet)

      // Convert amount to wei (USDC has 6 decimals)
      const decimals = await this.usdcContract.decimals()
      const amountWei = ethers.parseUnits(amount.toString(), decimals)

      // Estimate gas
      const gasEstimate = await usdcWithSigner.transfer.estimateGas(toAddress, amountWei)

      // Get current gas price if not provided
      if (!gasPrice) {
        const feeData = await this.provider.getFeeData()
        gasPrice = feeData.gasPrice
      }

      // Send transaction
      const tx = await usdcWithSigner.transfer(toAddress, amountWei, {
        gasLimit: gasEstimate,
        gasPrice: gasPrice,
      })

      logger.info(`USDC transaction sent: ${tx.hash}`)

      return {
        transactionHash: tx.hash,
        from: wallet.address,
        to: toAddress,
        amount: amount,
        gasUsed: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
        blockNumber: null, // Will be filled when confirmed
        status: "pending",
      }
    } catch (error) {
      logger.error("Error sending USDC:", error)
      throw new Error(`Failed to send USDC: ${error.message}`)
    }
  }

  // Get transaction details
  async getTransaction(txHash) {
    try {
      const tx = await this.provider.getTransaction(txHash)
      const receipt = await this.provider.getTransactionReceipt(txHash)

      if (!tx) {
        throw new Error("Transaction not found")
      }

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value.toString(),
        gasPrice: tx.gasPrice.toString(),
        gasLimit: tx.gasLimit.toString(),
        gasUsed: receipt ? receipt.gasUsed.toString() : null,
        blockNumber: tx.blockNumber,
        blockHash: tx.blockHash,
        transactionIndex: tx.transactionIndex,
        confirmations: await tx.confirmations(),
        status: receipt ? (receipt.status === 1 ? "confirmed" : "failed") : "pending",
        timestamp: tx.blockNumber ? (await this.provider.getBlock(tx.blockNumber)).timestamp : null,
      }
    } catch (error) {
      logger.error(`Error getting transaction ${txHash}:`, error)
      throw new Error("Failed to get transaction details")
    }
  }

  // Validate Ethereum address
  isValidAddress(address) {
    return ethers.isAddress(address)
  }

  // Estimate gas for USDC transfer
  async estimateTransferGas(fromAddress, toAddress, amount) {
    try {
      const decimals = await this.usdcContract.decimals()
      const amountWei = ethers.parseUnits(amount.toString(), decimals)

      const gasEstimate = await this.usdcContract.transfer.estimateGas(toAddress, amountWei)
      const feeData = await this.provider.getFeeData()

      const estimatedCost = gasEstimate * feeData.gasPrice
      const estimatedCostETH = ethers.formatEther(estimatedCost)

      return {
        gasLimit: gasEstimate.toString(),
        gasPrice: feeData.gasPrice.toString(),
        estimatedCost: estimatedCostETH,
        estimatedCostWei: estimatedCost.toString(),
      }
    } catch (error) {
      logger.error("Error estimating gas:", error)
      throw new Error("Failed to estimate gas")
    }
  }

  // Monitor transaction status
  async waitForTransaction(txHash, confirmations = 1) {
    try {
      const receipt = await this.provider.waitForTransaction(txHash, confirmations)

      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1 ? "confirmed" : "failed",
        confirmations: confirmations,
      }
    } catch (error) {
      logger.error(`Error waiting for transaction ${txHash}:`, error)
      throw new Error("Failed to monitor transaction")
    }
  }

  // Get current network info
  async getNetworkInfo() {
    try {
      const network = await this.provider.getNetwork()
      const blockNumber = await this.provider.getBlockNumber()
      const feeData = await this.provider.getFeeData()

      return {
        chainId: network.chainId.toString(),
        name: network.name,
        currentBlock: blockNumber,
        gasPrice: feeData.gasPrice.toString(),
        maxFeePerGas: feeData.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
      }
    } catch (error) {
      logger.error("Error getting network info:", error)
      throw new Error("Failed to get network information")
    }
  }
}

module.exports = new BlockchainService()
