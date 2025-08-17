# USDC Wallet - Autocustodial Wallet for Base Network

A complete **autocustodial USDC wallet solution** built for the Base network with **white-labeling capabilities** and **Wallet-as-a-Service (WaaS) APIs**. This enterprise-grade platform allows businesses to offer branded wallet services while maintaining full custody control for end users.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-18+-green.svg)
![Flutter](https://img.shields.io/badge/flutter-3.10+-blue.svg)
![PostgreSQL](https://img.shields.io/badge/postgresql-14+-blue.svg)

## 🚀 Features

### Core Wallet Features
- **Autocustodial wallets** - Users maintain full control of their private keys
- **Multi-wallet support** - Multiple USDC wallets per user
- **Base network integration** - Native USDC transactions on Base L2
- **Real-time balance tracking** - Live balance updates and transaction monitoring
- **Secure key management** - Encrypted private key storage and backup
- **Contact management** - Save and manage contacts for easy transactions

### Mobile Application
- **Cross-platform Flutter app** - Single codebase for iOS and Android
- **Biometric authentication** - Fingerprint and face recognition
- **Modern Material Design UI** - Intuitive and responsive interface
- **Offline capability** - View balances and history without internet

### White-Label System
- **Complete brand customization** - Custom logos, colors, and app names
- **Feature control** - Enable/disable features per client
- **Transaction limits** - Configurable limits per white-label client
- **Custom domains** - Subdomain support for each client
- **Admin dashboard** - Management interface for white-label clients

### Wallet-as-a-Service APIs
- **RESTful APIs** - Complete wallet operations via HTTP
- **Developer dashboard** - API key management and usage analytics
- **Webhooks** - Real-time notifications for transaction events
- **Rate limiting** - Usage controls and billing integration
- **Comprehensive documentation** - Built-in API docs at `/docs`

## 🛠 Tech Stack

**Backend:**
- Node.js + Express.js
- PostgreSQL with connection pooling
- ethers.js for blockchain interaction
- JWT authentication with 2FA
- Winston logging

**Mobile:**
- Flutter (Dart)
- Provider for state management
- Biometric authentication
- Secure local storage

**Blockchain:**
- Base network (Ethereum L2)
- USDC token contract
- MetaMask-compatible wallet generation

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Flutter 3.10+ (for mobile development)
- Base network RPC access

## 🚀 Quick Start

### 1. Clone the Repository
\`\`\`bash
git clone https://github.com/yourusername/usdc-wallet.git
cd usdc-wallet
\`\`\`

### 2. Backend Setup
\`\`\`bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
nano .env

# Run database migrations
npm run migrate

# Start development server
npm run dev
\`\`\`

### 3. Mobile App Setup
\`\`\`bash
cd mobile_app

# Install Flutter dependencies
flutter pub get

# Run on iOS simulator
flutter run -d ios

# Run on Android emulator
flutter run -d android
\`\`\`

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

\`\`\`env
# Server Configuration
NODE_ENV=development
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-here

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=usdc_wallet
DB_USER=postgres
DB_PASSWORD=your-database-password

# Base Network Configuration
BASE_RPC_URL=https://mainnet.base.org
BASE_CHAIN_ID=8453
USDC_CONTRACT_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Encryption Keys
WALLET_ENCRYPTION_KEY=your-32-byte-encryption-key-here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
\`\`\`

### Database Setup

Run the migration scripts in order:

\`\`\`bash
# Create database schema
psql -d usdc_wallet -f scripts/001_create_database_schema.sql

# Seed initial data
psql -d usdc_wallet -f scripts/002_seed_initial_data.sql

# Create database functions
psql -d usdc_wallet -f scripts/003_create_functions.sql

# Add additional tables
psql -d usdc_wallet -f scripts/004_add_additional_tables.sql

# Create API tables
psql -d usdc_wallet -f scripts/005_create_api_tables.sql
\`\`\`

## 📁 Project Structure

\`\`\`
├── src/                          # Backend source code
│   ├── config/                   # Configuration files
│   ├── middleware/               # Express middleware
│   ├── routes/                   # API routes
│   │   ├── api/v1/              # Developer API endpoints
│   │   ├── auth.js              # Authentication routes
│   │   ├── wallets.js           # Wallet management
│   │   ├── transactions.js      # Transaction handling
│   │   ├── whitelabel.js        # White-label management
│   │   ├── backup.js            # Backup and recovery
│   │   ├── contacts.js          # Contact management
│   │   └── developer-dashboard.js # Developer dashboard
│   ├── services/                # Business logic services
│   │   ├── blockchain.js        # Base network integration
│   │   ├── walletService.js     # Wallet operations
│   │   ├── whitelabelService.js # White-label management
│   │   ├── webhookService.js    # Webhook handling
│   │   ├── backupService.js     # Backup and recovery
│   │   ├── contactService.js    # Contact management
│   │   └── notificationService.js # Notification system
│   └── server.js                # Main server file
├── mobile_app/                  # Flutter mobile application
│   ├── lib/
│   │   ├── config/              # App configuration
│   │   ├── models/              # Data models (User, Wallet, etc.)
│   │   ├── providers/           # State management (Provider pattern)
│   │   ├── screens/             # UI screens and pages
│   │   │   └── auth/            # Authentication screens
│   │   └── services/            # API services and utilities
│   ├── android/                 # Android-specific configuration
│   ├── ios/                     # iOS-specific configuration
│   └── pubspec.yaml             # Flutter dependencies
├── scripts/                     # Database migration scripts
│   ├── 001_create_database_schema.sql    # Main database schema
│   ├── 002_seed_initial_data.sql         # Initial data seeding
│   ├── 003_create_functions.sql          # Database functions
│   ├── 004_add_additional_tables.sql     # Additional tables
│   └── 005_create_api_tables.sql         # API management tables
└── README.md                    # This file
\`\`\`

## 🔌 API Usage

### Authentication
All API requests require an API key in the header:
\`\`\`bash
curl -H "X-API-Key: your_api_key_here" \
     https://api.yourdomain.com/api/v1/wallets
\`\`\`

### Create a Wallet
\`\`\`bash
curl -X POST \
  -H "X-API-Key: your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user123", "name": "My USDC Wallet"}' \
  https://api.yourdomain.com/api/v1/wallets
\`\`\`

### Send USDC
\`\`\`bash
curl -X POST \
  -H "X-API-Key: your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "to_address": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
    "amount": 10.50
  }' \
  https://api.yourdomain.com/api/v1/wallets/{wallet_id}/send
\`\`\`

### Get Balance
\`\`\`bash
curl -H "X-API-Key: your_api_key_here" \
     https://api.yourdomain.com/api/v1/wallets/{wallet_id}/balance
\`\`\`

### Manage Contacts
\`\`\`bash
curl -X POST \
  -H "X-API-Key: your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "contact_name": "John Doe",
    "contact_address": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
  }' \
  https://api.yourdomain.com/api/v1/wallets/{wallet_id}/contacts
\`\`\`

## 📚 Documentation

- **API Documentation**: Available at `/api/developer-dashboard/docs` when running the server
- **Developer Dashboard**: Access at `/api/developer-dashboard/dashboard` with valid API key
- **White-Label Admin**: Available at `/api/whitelabel/admin` for white-label management

## 🔒 Security Features

- **Private key encryption** - All private keys encrypted at rest using AES-256
- **2FA authentication** - Time-based one-time passwords (TOTP)
- **Biometric authentication** - Mobile app fingerprint/face recognition
- **Rate limiting** - API abuse prevention with configurable limits
- **Input validation** - Comprehensive request validation and sanitization
- **Audit logging** - Complete transaction and security event logs

## 🚀 Deployment

### Docker Deployment
\`\`\`bash
# Build and run with Docker Compose
docker-compose up -d
\`\`\`

### Manual Deployment
\`\`\`bash
# Install production dependencies
npm ci --production

# Run database migrations
npm run migrate

# Start production server
npm start
\`\`\`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the built-in API docs at `/docs`
- **Issues**: Report bugs and request features via GitHub Issues
- **Community**: Join our Discord server for community support

## 🗺 Roadmap

- [ ] Multi-token support (ETH, other ERC-20 tokens)
- [ ] Cross-chain bridge integration
- [ ] DeFi protocol integrations
- [ ] Advanced analytics dashboard
- [ ] Mobile SDK for third-party apps
- [ ] Hardware wallet integration

---

**Built with ❤️ for the Base ecosystem**
