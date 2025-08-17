-- Billing and subscription system for USDC Wallet

-- Subscription plans table
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('white_label', 'waas', 'enterprise')),
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2),
    setup_fee DECIMAL(10,2) DEFAULT 0,
    features JSONB NOT NULL, -- Plan features and limits
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Client subscriptions
CREATE TABLE client_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES white_label_clients(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES subscription_plans(id),
    stripe_subscription_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid')),
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    trial_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usage billing for API clients
CREATE TABLE usage_billing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES api_clients(id) ON DELETE CASCADE,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    api_calls_count INTEGER DEFAULT 0,
    transactions_count INTEGER DEFAULT 0,
    wallets_created INTEGER DEFAULT 0,
    total_volume DECIMAL(20,6) DEFAULT 0,
    api_calls_cost DECIMAL(10,4) DEFAULT 0,
    transaction_cost DECIMAL(10,4) DEFAULT 0,
    wallet_cost DECIMAL(10,4) DEFAULT 0,
    total_cost DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'billed', 'paid')),
    stripe_invoice_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Revenue sharing for partners
CREATE TABLE revenue_sharing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES white_label_clients(id),
    referred_client_id UUID REFERENCES white_label_clients(id),
    revenue_period_start DATE NOT NULL,
    revenue_period_end DATE NOT NULL,
    total_revenue DECIMAL(10,2) NOT NULL,
    commission_rate DECIMAL(5,4) NOT NULL, -- e.g., 0.2000 for 20%
    commission_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'canceled')),
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, plan_type, price_monthly, price_yearly, setup_fee, features) VALUES
('Starter White Label', 'white_label', 299.00, 2990.00, 1500.00, '{
    "max_users": 1000,
    "custom_branding": true,
    "custom_domain": false,
    "api_access": false,
    "support_level": "email"
}'::jsonb),
('Professional White Label', 'white_label', 999.00, 9990.00, 3000.00, '{
    "max_users": 10000,
    "custom_branding": true,
    "custom_domain": true,
    "api_access": true,
    "support_level": "priority"
}'::jsonb),
('Enterprise White Label', 'white_label', 2999.00, 29990.00, 5000.00, '{
    "max_users": -1,
    "custom_branding": true,
    "custom_domain": true,
    "api_access": true,
    "support_level": "dedicated"
}'::jsonb),
('WaaS Startup', 'waas', 99.00, 990.00, 0.00, '{
    "monthly_api_calls": 50000,
    "monthly_transactions": 1000,
    "max_wallets": 500,
    "webhook_support": true
}'::jsonb),
('WaaS Scale', 'waas', 499.00, 4990.00, 0.00, '{
    "monthly_api_calls": 500000,
    "monthly_transactions": 10000,
    "max_wallets": 5000,
    "webhook_support": true
}'::jsonb);

-- Create indexes
CREATE INDEX idx_client_subscriptions_client_id ON client_subscriptions(client_id);
CREATE INDEX idx_client_subscriptions_status ON client_subscriptions(status);
CREATE INDEX idx_usage_billing_client_period ON usage_billing(client_id, billing_period_start);
CREATE INDEX idx_revenue_sharing_partner ON revenue_sharing(partner_id);
CREATE INDEX idx_revenue_sharing_period ON revenue_sharing(revenue_period_start, revenue_period_end);
