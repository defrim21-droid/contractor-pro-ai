-- Create trial_usage table to track emails and payment methods that have used trials
-- This prevents users from creating multiple accounts to get free trials

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create trial_usage table
CREATE TABLE IF NOT EXISTS trial_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_method_id TEXT,
  stripe_customer_id TEXT,
  plan_type TEXT NOT NULL,
  trial_start_date TIMESTAMPTZ NOT NULL,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one trial per email
  CONSTRAINT unique_email UNIQUE (email)
);

-- Create indexes for fast lookups (must be separate statements)
CREATE INDEX IF NOT EXISTS idx_trial_usage_email ON trial_usage(email);
CREATE INDEX IF NOT EXISTS idx_trial_usage_payment_method ON trial_usage(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_trial_usage_stripe_customer ON trial_usage(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_trial_usage_user_id ON trial_usage(user_id);

-- Enable Row Level Security
ALTER TABLE trial_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own trial usage
-- Drop policy if exists to avoid conflicts
DROP POLICY IF EXISTS "Users can view own trial usage" ON trial_usage;
CREATE POLICY "Users can view own trial usage"
  ON trial_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert (for backend/Edge Functions)
-- Note: This requires service role key, not anon key
-- Drop policy if exists to avoid conflicts
DROP POLICY IF EXISTS "Service can insert trial usage" ON trial_usage;
CREATE POLICY "Service can insert trial usage"
  ON trial_usage FOR INSERT
  WITH CHECK (true);

-- Policy: Service role can update (for marking as used)
DROP POLICY IF EXISTS "Service can update trial usage" ON trial_usage;
CREATE POLICY "Service can update trial usage"
  ON trial_usage FOR UPDATE
  USING (true);

-- Function to check if email has used trial (for use in Edge Functions)
CREATE OR REPLACE FUNCTION has_email_used_trial(check_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM trial_usage 
    WHERE email = LOWER(check_email)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if payment method has been used
CREATE OR REPLACE FUNCTION has_payment_method_used_trial(check_payment_method_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM trial_usage 
    WHERE payment_method_id = check_payment_method_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
