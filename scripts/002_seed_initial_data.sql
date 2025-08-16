-- Seed initial data for USDC Wallet

-- Insert default white label client for direct service
INSERT INTO white_label_clients (
    client_name,
    subdomain,
    api_key,
    api_secret,
    brand_config,
    features_config
) VALUES (
    'USDC Wallet Direct',
    'app',
    'wl_' || encode(gen_random_bytes(16), 'hex'),
    encode(gen_random_bytes(32), 'hex'),
    '{
        "app_name": "USDC Wallet",
        "primary_color": "#0052FF",
        "secondary_color": "#1A73E8",
        "logo_url": "/assets/logo.png",
        "favicon_url": "/assets/favicon.ico"
    }',
    '{
        "max_wallets_per_user": 10,
        "daily_transaction_limit": 10000,
        "features": ["send", "receive", "transaction_history", "multiple_wallets", "biometric_auth"]
    }'
);

-- Insert sample API permissions structure
INSERT INTO api_keys (
    white_label_client_id,
    key_name,
    api_key,
    api_secret_hash,
    permissions,
    rate_limit_per_minute
) VALUES (
    (SELECT id FROM white_label_clients WHERE subdomain = 'app'),
    'Master API Key',
    'ak_' || encode(gen_random_bytes(16), 'hex'),
    crypt('sample_secret_' || encode(gen_random_bytes(8), 'hex'), gen_salt('bf')),
    '["wallet:create", "wallet:read", "transaction:create", "transaction:read", "user:create", "user:read"]',
    1000
);
