-- API clients table for WaaS
CREATE TABLE IF NOT EXISTS api_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    api_key VARCHAR(64) UNIQUE NOT NULL,
    api_secret VARCHAR(64) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    rate_limits JSONB DEFAULT '{
        "monthly_requests": 100000,
        "daily_transactions": 1000,
        "max_wallets_per_user": 10
    }'::jsonb,
    transaction_limits JSONB DEFAULT '{
        "max_transaction_amount": 10000,
        "daily_transaction_volume": 50000
    }'::jsonb,
    webhook_url VARCHAR(500),
    allowed_origins TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP
);

-- API usage logs
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES api_clients(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    ip_address INET,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES api_clients(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    events JSONB NOT NULL, -- Array of events to listen to
    secret VARCHAR(100), -- For webhook signature verification
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhook delivery logs
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
    event VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'retry')),
    status_code INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add client_id to wallets table for API association
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS api_client_id UUID REFERENCES api_clients(id);

-- Add client_id to transactions table for API association  
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS api_client_id UUID REFERENCES api_clients(id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_client_created ON api_usage_logs(client_id, created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_action_created ON api_usage_logs(action, created_at);
CREATE INDEX IF NOT EXISTS idx_webhooks_client_status ON webhooks(client_id, status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_created ON webhook_logs(webhook_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wallets_api_client ON wallets(api_client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_api_client ON transactions(api_client_id);

-- Insert sample API client for testing
INSERT INTO api_clients (name, api_key, api_secret) VALUES 
('Test Client', 'test_api_key_12345', 'test_api_secret_67890')
ON CONFLICT (api_key) DO NOTHING;
