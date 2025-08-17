# Developer Instructions

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ and npm
- **PostgreSQL** 14+
- **Flutter** 3.0+ and Dart SDK
- **Git** for version control
- **Base network RPC access** (Alchemy, Infura, or public RPC)

## Initial Setup

### 1. Clone and Install Dependencies

\`\`\`bash
# Clone the repository
git clone https://github.com/your-username/usdc-wallet-base.git
cd usdc-wallet-base

# Install backend dependencies
npm install

# Install mobile app dependencies
cd mobile_app
flutter pub get
cd ..
\`\`\`

### 2. Environment Configuration

Create a `.env` file in the root directory:

\`\`\`bash
cp .env.example .env
\`\`\`

Configure the following environment variables:

\`\`\`env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/usdc_wallet

# Authentication
JWT_SECRET=your-super-secret-jwt-key-here
WALLET_ENCRYPTION_KEY=32-character-encryption-key-here

# Blockchain Configuration
BASE_RPC_URL=https://mainnet.base.org
USDC_CONTRACT_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# API Configuration
API_BASE_URL=http://localhost:3000
PORT=3000

# Logging
LOG_LEVEL=development
\`\`\`

### 3. Database Setup

\`\`\`bash
# Create database
createdb usdc_wallet

# Run migrations
npm run migrate

# Seed initial data (optional)
npm run seed
\`\`\`

## Running the Application

### Backend Server

\`\`\`bash
# Development mode with hot reload
npm run dev

# Production mode
npm start

# Run tests
npm test
\`\`\`

The API will be available at `http://localhost:3000`

### Mobile Application

\`\`\`bash
cd mobile_app

# Run on iOS simulator
flutter run -d ios

# Run on Android emulator
flutter run -d android

# Build for production
flutter build apk --release  # Android
flutter build ios --release  # iOS
\`\`\`

## Development Workflow

### 1. Database Migrations

When making database changes:

\`\`\`bash
# Create new migration script
touch scripts/00X_your_migration_name.sql

# Add your SQL changes to the file
# Run the migration
npm run migrate
\`\`\`

### 2. API Development

- All API routes are in `src/routes/`
- Business logic goes in `src/services/`
- Middleware in `src/middleware/`
- Follow RESTful conventions

### 3. Mobile Development

- Use Provider pattern for state management
- Follow Flutter/Dart style guide
- Implement proper error handling
- Use secure storage for sensitive data

## API Testing

### Authentication

\`\`\`bash
# Register new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
\`\`\`

### Wallet Operations

\`\`\`bash
# Create wallet (requires auth token)
curl -X POST http://localhost:3000/api/wallets \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My USDC Wallet"}'

# Get wallet balance
curl -X GET http://localhost:3000/api/wallets/{walletId}/balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
\`\`\`

### Developer API Testing

\`\`\`bash
# Get API key (for WaaS)
curl -X POST http://localhost:3000/api/developer-dashboard/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My App","permissions":["wallet:read","wallet:write"]}'

# Use developer API
curl -X GET http://localhost:3000/api/v1/wallets \
  -H "X-API-Key: YOUR_API_KEY"
\`\`\`

## Code Standards

### Backend (Node.js)

- Use ES6+ features
- Implement proper error handling
- Add input validation for all endpoints
- Use async/await instead of callbacks
- Follow RESTful API conventions
- Add JSDoc comments for functions

### Mobile (Flutter/Dart)

- Follow Dart style guide
- Use meaningful widget names
- Implement proper state management
- Add error boundaries
- Use const constructors where possible
- Add documentation comments

### Database

- Use descriptive table and column names
- Add proper indexes for performance
- Include foreign key constraints
- Add created_at/updated_at timestamps
- Use transactions for multi-table operations

## Security Guidelines

### Backend Security

- Never log sensitive data (private keys, passwords)
- Validate all inputs
- Use parameterized queries
- Implement rate limiting
- Add CORS protection
- Use HTTPS in production

### Mobile Security

- Use Flutter secure storage
- Implement biometric authentication
- Validate server certificates
- Don't store sensitive data in plain text
- Use proper key derivation functions

## Testing

### Backend Tests

\`\`\`bash
# Run all tests
npm test

# Run specific test file
npm test -- --grep "wallet service"

# Run with coverage
npm run test:coverage
\`\`\`

### Mobile Tests

\`\`\`bash
cd mobile_app

# Run unit tests
flutter test

# Run integration tests
flutter test integration_test/
\`\`\`

## Deployment

### Backend Deployment

1. Set production environment variables
2. Run database migrations
3. Build and deploy to your hosting platform
4. Configure SSL certificates
5. Set up monitoring and logging

### Mobile Deployment

1. Update version numbers in `pubspec.yaml`
2. Build release versions
3. Test on physical devices
4. Submit to app stores following their guidelines

## Troubleshooting

### Common Issues

**Database Connection Issues:**
- Check PostgreSQL is running
- Verify DATABASE_URL format
- Ensure database exists

**Blockchain Connection Issues:**
- Verify BASE_RPC_URL is accessible
- Check network connectivity
- Validate contract addresses

**Mobile Build Issues:**
- Run `flutter clean` and `flutter pub get`
- Check Flutter and Dart versions
- Verify platform-specific configurations

### Debug Mode

Enable debug logging:

\`\`\`env
LOG_LEVEL=debug
\`\`\`

Add debug statements in code:

\`\`\`javascript
console.log("[v0] Debug info:", variable);
\`\`\`

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes following the code standards
4. Add tests for new functionality
5. Run tests: `npm test`
6. Commit changes: `git commit -m "Add your feature"`
7. Push to branch: `git push origin feature/your-feature`
8. Create a Pull Request

## Support

- Check existing issues on GitHub
- Create new issues with detailed descriptions
- Include error logs and reproduction steps
- Tag issues appropriately (bug, feature, documentation)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
