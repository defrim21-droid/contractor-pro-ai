# Backend Requirements Summary

## Overview
This document outlines all backend work needed beyond what's already implemented in the frontend.

## ✅ Already Working (No Backend Needed)

1. **Plan Selection** - Stores in `user_metadata`, works immediately
2. **Email Verification** - Uses Supabase Auth, works out of the box
3. **Password Validation** - Frontend-only, works immediately
4. **Trial Tracking Display** - Reads from `user_metadata`, works immediately
5. **Trial Prevention Checks** - Reads from `trial_usage` table, should work (may need RLS policy adjustment)

## ⚠️ Needs Backend Integration

### 1. Stripe Payment Processing (High Priority)

**Status**: Frontend ready, backend needed

**What's Needed**:
- Supabase Edge Function: `create-setup-intent`
- Supabase Edge Function: `confirm-payment-setup`
- Stripe webhook handler for subscription events

**Files to Update**:
- `src/services/paymentService.js` - Uncomment Edge Function calls
- `src/components/PaymentForm.jsx` - Connect to real SetupIntent

**Documentation**: See `PAYMENT_INTEGRATION.md`

---

### 2. Email Service Integration (Medium Priority)

**Status**: Templates ready, sending service needed

**What's Needed**:
- Choose email service (Resend, SendGrid, Mailgun, or AWS SES)
- Create Supabase Edge Function: `send-email` OR integrate directly
- Set up API keys and environment variables

**Files to Update**:
- `src/services/emailService.js` - Replace placeholders with actual API calls

**Email Types**:
- Welcome email (after signup/verification)
- Trial ending reminder (3 days before)
- Trial expired notification
- First project celebration

**Documentation**: See `EMAIL_INTEGRATION.md`

---

### 3. Trial Usage Table RLS Policy Fix (Medium Priority)

**Issue**: The `markEmailTrialUsed()` function tries to insert directly from frontend, which may fail due to RLS policies.

**Current Code** (`src/utils/trialPrevention.js`):
```javascript
const { error } = await supabase
  .from('trial_usage')
  .insert({ email, user_id, ... });
```

**Problem**: The RLS policy "Service can insert trial usage" might not allow anon key inserts.

**Solutions**:

**Option A: Update RLS Policy** (Easiest)
```sql
-- Allow authenticated users to insert their own trial usage
DROP POLICY IF EXISTS "Users can insert own trial usage" ON trial_usage;
CREATE POLICY "Users can insert own trial usage"
  ON trial_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

**Option B: Create Edge Function** (More Secure)
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
    const { email, userId, planType, paymentMethodId, stripeCustomerId } = await req.json()

    const { error } = await supabase
      .from('trial_usage')
      .insert({
        email: email.toLowerCase(),
        user_id: userId,
        payment_method_id: paymentMethodId || null,
        stripe_customer_id: stripeCustomerId || null,
        plan_type: planType,
        trial_start_date: new Date().toISOString(),
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

Then update `src/utils/trialPrevention.js`:
```javascript
export const markEmailTrialUsed = async (email, userId, planType, paymentMethodId, stripeCustomerId) => {
  const { data, error } = await supabase.functions.invoke('mark-trial-used', {
    body: { email, userId, planType, paymentMethodId, stripeCustomerId }
  });
  if (error) throw error;
  return data;
};
```

**Recommendation**: Start with Option A (simpler), upgrade to Option B if you need more security.

---

### 4. AI Generation Edge Function (Low Priority - Already Commented)

**Status**: Code exists but is commented out

**What's Needed**:
- Uncomment the Edge Function call in `src/aiService.js`
- Ensure `generate-renovation` Edge Function exists and works

**File**: `src/aiService.js` line 58

---

## Priority Order

1. **Trial Usage RLS Fix** - Quick fix, enables trial prevention
2. **Stripe Payment Backend** - Required for payment collection
3. **Email Service** - Nice to have, improves UX
4. **AI Generation** - Already commented out, can wait

## Quick Wins

### Fix Trial Usage Insert (5 minutes)

Run this SQL in Supabase SQL Editor:

```sql
-- Allow authenticated users to insert their own trial usage
DROP POLICY IF EXISTS "Users can insert own trial usage" ON trial_usage;
CREATE POLICY "Users can insert own trial usage"
  ON trial_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

This will allow the frontend code to insert trial usage records directly.

---

## Testing Checklist

After implementing backend:

- [ ] Trial prevention works (try signing up with same email twice)
- [ ] Payment form connects to Stripe SetupIntent
- [ ] Welcome emails are sent after signup
- [ ] Trial reminders are sent 3 days before expiration
- [ ] Trial expired emails are sent on expiration
- [ ] First project emails are sent

---

## Summary

**Must Have**:
1. ✅ Trial Usage RLS policy fix (quick SQL change)
2. ⏳ Stripe payment backend (when ready to process payments)

**Nice to Have**:
3. ⏳ Email service integration (for automated emails)
4. ⏳ AI generation Edge Function (when AI service is ready)

The app is functional without email service - emails just won't be sent. Payment backend is needed before going live with payments.
