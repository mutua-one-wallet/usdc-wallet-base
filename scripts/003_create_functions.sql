-- Utility functions for USDC Wallet

-- Function to generate new wallet address (placeholder - actual implementation would use proper key generation)
CREATE OR REPLACE FUNCTION generate_wallet_keypair()
RETURNS TABLE(address VARCHAR(42), encrypted_private_key TEXT) AS $$
BEGIN
    -- This is a placeholder - in production, use proper cryptographic libraries
    -- The actual implementation should be done in the Node.js backend
    RETURN QUERY SELECT 
        '0x' || encode(gen_random_bytes(20), 'hex') as address,
        encode(encrypt(gen_random_bytes(32), 'wallet_encryption_key', 'aes'), 'base64') as encrypted_private_key;
END;
$$ LANGUAGE plpgsql;

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    p_user_id UUID,
    p_wallet_id UUID,
    p_white_label_client_id UUID,
    p_action VARCHAR(100),
    p_details JSONB,
    p_ip_address INET,
    p_user_agent TEXT,
    p_success BOOLEAN
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO security_logs (
        user_id, wallet_id, white_label_client_id, action, details,
        ip_address, user_agent, success
    ) VALUES (
        p_user_id, p_wallet_id, p_white_label_client_id, p_action, p_details,
        p_ip_address, p_user_agent, p_success
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update wallet balance
CREATE OR REPLACE FUNCTION update_wallet_balance(
    p_wallet_id UUID,
    p_new_balance DECIMAL(20,6)
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE wallets 
    SET balance_usdc = p_new_balance,
        last_balance_update = NOW()
    WHERE id = p_wallet_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to create webhook event
CREATE OR REPLACE FUNCTION create_webhook_event(
    p_client_id UUID,
    p_event_type VARCHAR(50),
    p_payload JSONB
) RETURNS UUID AS $$
DECLARE
    webhook_url VARCHAR(500);
    event_id UUID;
BEGIN
    -- Get webhook URL for client
    SELECT wlc.webhook_url INTO webhook_url
    FROM white_label_clients wlc
    WHERE wlc.id = p_client_id AND wlc.is_active = TRUE;
    
    IF webhook_url IS NOT NULL THEN
        INSERT INTO webhook_events (
            white_label_client_id, event_type, payload, webhook_url, next_attempt_at
        ) VALUES (
            p_client_id, p_event_type, p_payload, webhook_url, NOW()
        ) RETURNING id INTO event_id;
    END IF;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql;
