# Database Setup Guide

## How to Execute SQL Migrations in Supabase

### Method 1: Supabase Dashboard (Easiest - Recommended)

1. **Go to your Supabase Dashboard**
   - Visit https://app.supabase.com
   - Sign in to your account
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy and Paste the Migration**
   - Open the file: `supabase/migrations/create_trial_usage_table.sql`
   - Copy all the SQL code
   - Paste it into the SQL Editor

4. **Run the Migration**
   - Click the "Run" button (or press Cmd/Ctrl + Enter)
   - Wait for the query to complete
   - You should see "Success. No rows returned" or similar success message

5. **Verify the Table was Created**
   - Go to "Table Editor" in the left sidebar
   - You should see `trial_usage` table in the list
   - Click on it to verify the columns are correct

### Method 2: Supabase CLI (For Development)

If you have Supabase CLI installed locally:

1. **Install Supabase CLI** (if not already installed)
   ```bash
   npm install -g supabase
   ```

2. **Link your project**
   ```bash
   supabase link --project-ref your-project-ref
   ```
   (Get your project ref from Supabase Dashboard → Settings → General)

3. **Run the migration**
   ```bash
   supabase db push
   ```
   Or if you want to run a specific migration:
   ```bash
   supabase migration up
   ```

### Method 3: Direct SQL Execution via API

You can also execute SQL programmatically, but this requires service role key and is not recommended for migrations.

## Verification Steps

After running the migration, verify it worked:

1. **Check Table Exists**
   ```sql
   SELECT * FROM trial_usage LIMIT 1;
   ```
   Should return 0 rows (empty table is fine)

2. **Check Table Structure**
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'trial_usage';
   ```

3. **Check Indexes**
   ```sql
   SELECT indexname, indexdef 
   FROM pg_indexes 
   WHERE tablename = 'trial_usage';
   ```

4. **Check Policies**
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'trial_usage';
   ```

## Troubleshooting

### Error: "relation already exists"
- The table might already exist
- Drop it first: `DROP TABLE IF EXISTS trial_usage CASCADE;`
- Then run the migration again

### Error: "permission denied"
- Make sure you're using the SQL Editor (not a restricted user)
- Check that you have the correct permissions

### Error: "function uuid_generate_v4() does not exist"
- Enable the uuid extension:
  ```sql
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  ```

### Error: "policy already exists"
- Drop existing policies first:
  ```sql
  DROP POLICY IF EXISTS "Users can view own trial usage" ON trial_usage;
  DROP POLICY IF EXISTS "Service can insert trial usage" ON trial_usage;
  DROP POLICY IF EXISTS "Service can update trial usage" ON trial_usage;
  ```
- Then run the migration again

## Quick Setup Script

If you want to run everything at once, here's a complete script:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop table if exists (for re-running)
DROP TABLE IF EXISTS trial_usage CASCADE;

-- Create trial_usage table
CREATE TABLE trial_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_method_id TEXT,
  stripe_customer_id TEXT,
  plan_type TEXT NOT NULL,
  trial_start_date TIMESTAMPTZ NOT NULL,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_email UNIQUE (email)
);

-- Create indexes
CREATE INDEX idx_trial_usage_email ON trial_usage(email);
CREATE INDEX idx_trial_usage_payment_method ON trial_usage(payment_method_id);
CREATE INDEX idx_trial_usage_stripe_customer ON trial_usage(stripe_customer_id);
CREATE INDEX idx_trial_usage_user_id ON trial_usage(user_id);

-- Enable RLS
ALTER TABLE trial_usage ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own trial usage" ON trial_usage;
DROP POLICY IF EXISTS "Service can insert trial usage" ON trial_usage;
DROP POLICY IF EXISTS "Service can update trial usage" ON trial_usage;

-- Create policies
CREATE POLICY "Users can view own trial usage"
  ON trial_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert trial usage"
  ON trial_usage FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can update trial usage"
  ON trial_usage FOR UPDATE
  USING (true);

-- Create helper functions
CREATE OR REPLACE FUNCTION has_email_used_trial(check_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM trial_usage 
    WHERE email = LOWER(check_email)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION has_payment_method_used_trial(check_payment_method_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM trial_usage 
    WHERE payment_method_id = check_payment_method_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Next Steps

After running the migration:

1. ✅ Table created and verified
2. ⏳ Test trial prevention by trying to sign up with same email twice
3. ⏳ Monitor `trial_usage` table for entries
4. ⏳ Set up Stripe integration to track payment methods
5. ⏳ Consider adding IP tracking for additional security
