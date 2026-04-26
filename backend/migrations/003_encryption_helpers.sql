-- ============================================================
-- RUPIQ — TOKEN ENCRYPTION HELPERS
-- Run AFTER 002_gmail_tables.sql
-- Requires pgcrypto extension (enabled in 001)
-- ============================================================

-- Encrypt a token string using AES with a shared secret
CREATE OR REPLACE FUNCTION encrypt_token(token TEXT, secret TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(encrypt(token::bytea, secret::bytea, 'aes'), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrypt a previously encrypted token
CREATE OR REPLACE FUNCTION decrypt_token(encrypted TEXT, secret TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN convert_from(decrypt(decode(encrypted, 'base64'), secret::bytea, 'aes'), 'UTF8');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
