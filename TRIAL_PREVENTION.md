# Trial Abuse Prevention Guide

## Overview
This document outlines strategies to prevent users from creating multiple accounts to repeatedly take advantage of free trials.

## Prevention Strategies

### 1. Email-Based Tracking (Primary Method)

**Implementation:**
- Create a `trial_usage` table in Supabase to track emails that have used trials
- Check this table before assigning a trial
- Mark email as trial-used when trial starts

**Database Schema:**
```sql
CREATE TABLE trial_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id),
  plan_type TEXT NOT NULL,
  trial_start_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_email (email)
);
```

**Pros:**
- Simple to implement
- Effective for most cases
- Easy to query

**Cons:**
- Users can use different email addresses
- Email aliases can bypass (e.g., user+1@gmail.com)

### 2. Payment Method Tracking (Most Effective)

**Implementation:**
- Track Stripe customer IDs or payment method fingerprints
- Check if payment method has been used for trial before
- Store in Stripe customer metadata or separate database table

**Stripe Integration:**
```javascript
// Check Stripe customer metadata
const customer = await stripe.customers.retrieve(customerId);
if (customer.metadata.trial_used === 'true') {
  // Deny trial
}

// Mark as used
await stripe.customers.update(customerId, {
  metadata: { trial_used: 'true' }
});
```

**Pros:**
- Very effective - harder to bypass
- Works even with different emails
- Integrates with payment system

**Cons:**
- Requires payment method collection
- Users can use different cards
- More complex implementation

### 3. IP Address Tracking (Supporting Method)

**Implementation:**
- Track IP addresses that have used trials
- Flag suspicious patterns (multiple accounts from same IP)
- Use as supporting evidence, not primary prevention

**Pros:**
- Catches obvious abuse patterns
- Useful for fraud detection

**Cons:**
- Not reliable (shared IPs, VPNs)
- Can block legitimate users
- Privacy concerns

### 4. Device Fingerprinting (Advanced)

**Implementation:**
- Track device/browser fingerprints
- Combine multiple signals (screen size, timezone, plugins, etc.)
- Flag devices that have used trials

**Pros:**
- Harder to bypass
- Works across different accounts

**Cons:**
- Privacy concerns
- Can be bypassed with different devices
- Complex implementation

### 5. Domain-Based Restrictions (For Business Plans)

**Implementation:**
- Allow one trial per email domain
- Useful for business/enterprise plans
- Less effective for personal email providers

**Pros:**
- Prevents abuse within organizations
- Good for B2B scenarios

**Cons:**
- Not applicable for personal email providers
- Can block legitimate users in same company

## Recommended Approach

### Multi-Layer Defense

1. **Primary: Email + Payment Method Tracking**
   - Check email in `trial_usage` table
   - Check payment method in Stripe customer metadata
   - Deny trial if either has been used

2. **Secondary: Pattern Detection**
   - Monitor for suspicious patterns (multiple accounts, same IP, etc.)
   - Flag accounts for manual review
   - Implement rate limiting

3. **Tertiary: Manual Review**
   - Review flagged accounts
   - Contact users if needed
   - Ban abusive accounts

## Implementation Steps

### Step 1: Create Database Table

**Option A: Use Migration File**
Run the SQL migration file located at `supabase/migrations/create_trial_usage_table.sql` in your Supabase SQL Editor.

**Option B: Manual Creation**
Run this SQL in Supabase SQL Editor:

```sql
-- Run in Supabase SQL Editor
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
  CONSTRAINT unique_email UNIQUE (email),
  INDEX idx_trial_usage_email (email),
  INDEX idx_trial_usage_payment_method (payment_method_id),
  INDEX idx_trial_usage_stripe_customer (stripe_customer_id)
);

-- Enable RLS
ALTER TABLE trial_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own trial usage
CREATE POLICY "Users can view own trial usage"
  ON trial_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert (for backend)
CREATE POLICY "Service can insert trial usage"
  ON trial_usage FOR INSERT
  WITH CHECK (true);
```

### Step 2: Update Signup Flow

Update `src/Auth.jsx` to check trial eligibility before assigning trial:

```javascript
import { canUserGetTrial, markEmailTrialUsed } from './utils/trialPrevention';

// In handlePaymentSuccess:
const trialCheck = await canUserGetTrial(email, paymentMethodId);
if (selectedPlan === 'pro' && !trialCheck.canGetTrial) {
  // Don't assign trial, but still create account
  // Or show error and require payment
  alert(trialCheck.reason);
  return;
}

// If trial eligible, mark as used
if (selectedPlan === 'pro') {
  await markEmailTrialUsed(email, userId, selectedPlan);
}
```

### Step 3: Update Backend (Supabase Edge Function)

Create `supabase/functions/check-trial-eligibility/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

serve(async (req) => {
  try {
    const { email, paymentMethodId, stripeCustomerId } = await req.json()

    // Check email
    const { data: emailCheck } = await supabase
      .from('trial_usage')
      .select('email')
      .eq('email', email.toLowerCase())
      .single()

    if (emailCheck) {
      return new Response(
        JSON.stringify({ 
          canGetTrial: false, 
          reason: 'This email has already used a free trial.' 
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Check payment method if provided
    if (paymentMethodId) {
      const { data: paymentCheck } = await supabase
        .from('trial_usage')
        .select('payment_method_id')
        .eq('payment_method_id', paymentMethodId)
        .single()

      if (paymentCheck) {
        return new Response(
          JSON.stringify({ 
            canGetTrial: false, 
            reason: 'This payment method has already been used for a free trial.' 
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    // Check Stripe customer if provided
    if (stripeCustomerId) {
      const { data: stripeCheck } = await supabase
        .from('trial_usage')
        .select('stripe_customer_id')
        .eq('stripe_customer_id', stripeCustomerId)
        .single()

      if (stripeCheck) {
        return new Response(
          JSON.stringify({ 
            canGetTrial: false, 
            reason: 'This account has already used a free trial.' 
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ canGetTrial: true }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

### Step 4: Mark Trial as Used

Create `supabase/functions/mark-trial-used/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

serve(async (req) => {
  try {
    const { email, userId, paymentMethodId, stripeCustomerId, planType, ipAddress } = await req.json()

    const { error } = await supabase
      .from('trial_usage')
      .insert({
        email: email.toLowerCase(),
        user_id: userId,
        payment_method_id: paymentMethodId || null,
        stripe_customer_id: stripeCustomerId || null,
        plan_type: planType,
        trial_start_date: new Date().toISOString(),
        ip_address: ipAddress || null,
      })

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

## Additional Strategies

### Rate Limiting
- Limit signups per IP address (e.g., 3 accounts per IP per day)
- Use Supabase rate limiting or Cloudflare

### Account Verification
- Require phone verification for trial accounts
- Use services like Twilio Verify or Authy

### Credit Card Verification
- Require $1 authorization (refunded immediately)
- Prevents use of fake/virtual cards
- Implemented via Stripe

### Manual Review Queue
- Flag accounts with suspicious patterns
- Review before trial activation
- Contact users if needed

### Trial Terms Enforcement
- Clear terms of service
- One trial per person/household
- Legal enforcement if needed

## Monitoring & Detection

### Metrics to Track
- Signups per email domain
- Signups per IP address
- Payment method reuse
- Trial conversion rates
- Account deletion patterns

### Red Flags
- Multiple accounts from same IP
- Same payment method, different emails
- Rapid account creation/deletion
- Email patterns (user+1, user+2, etc.)

## Testing

### Test Scenarios
1. Same email, different account → Should deny trial
2. Same payment method, different email → Should deny trial
3. Legitimate new user → Should allow trial
4. User upgrading from Starter → Should allow (no trial used)

## Notes

- Start with email + payment method tracking (most effective)
- Add IP tracking as supporting evidence
- Monitor patterns and adjust as needed
- Consider requiring payment method upfront for trials
- Be transparent about trial terms in your TOS
