# Payment Integration Setup Guide

## Overview
Payment collection has been integrated into the signup flow using Stripe. The frontend is ready, but backend integration is required for full functionality.

## What's Implemented

### Frontend Components
1. **PaymentForm Component** (`src/components/PaymentForm.jsx`)
   - Uses Stripe Elements for secure payment collection
   - Handles payment method setup
   - Shows plan details and pricing

2. **Payment Service** (`src/services/paymentService.js`)
   - Placeholder functions for backend integration
   - Ready to connect to Supabase Edge Functions

3. **Auth Flow Updates** (`src/Auth.jsx`)
   - Two-step signup: User Info → Payment
   - Integrated Stripe Elements wrapper
   - Payment form appears after plan selection

## Backend Requirements

### 1. Environment Variables
Add to your `.env.local`:
```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
```

### 2. Supabase Edge Function: Create SetupIntent

Create a Supabase Edge Function at `supabase/functions/create-setup-intent/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

serve(async (req) => {
  try {
    const { userId, planType } = await req.json()

    // Create SetupIntent for subscription payment method collection
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId, // Get or create Stripe customer
      payment_method_types: ['card'],
      metadata: {
        userId,
        planType,
      },
    })

    return new Response(
      JSON.stringify({ clientSecret: setupIntent.client_secret }),
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

### 3. Supabase Edge Function: Confirm Payment Setup

Create `supabase/functions/confirm-payment-setup/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

serve(async (req) => {
  try {
    const { setupIntentId, userId } = await req.json()

    // Retrieve setup intent
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId)

    if (setupIntent.status !== 'succeeded') {
      throw new Error('Setup intent not succeeded')
    }

    // Create or update subscription
    const customerId = setupIntent.customer
    const paymentMethodId = setupIntent.payment_method

    // Create subscription in Stripe
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: getPriceIdForPlan(planType) }], // Map planType to Stripe Price ID
      default_payment_method: paymentMethodId,
      trial_period_days: planType === 'pro' ? 14 : 0,
    })

    // Update user metadata in Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status,
      },
    })

    return new Response(
      JSON.stringify({ success: true, subscriptionId: subscription.id }),
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

### 4. Stripe Configuration

1. **Create Stripe Account**: https://stripe.com
2. **Get API Keys**: Dashboard → Developers → API keys
3. **Create Products & Prices**:
   - Starter Plan: $149/month
   - Contractor Pro: $199/month (with 14-day trial)
   - Elite: $249/month
4. **Set up Webhooks**: Listen for subscription events
5. **Add Webhook Secret** to Supabase environment variables

### 5. Update Payment Service

Once Edge Functions are deployed, update `src/services/paymentService.js`:

```javascript
export const createSetupIntent = async (userId, planType) => {
  const { data, error } = await supabase.functions.invoke('create-setup-intent', {
    body: { userId, planType }
  });
  
  if (error) throw error;
  return data.clientSecret;
};
```

## Testing

### Test Cards (Stripe Test Mode)
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0027 6000 3184`

### Test Flow
1. Sign up with test card
2. Verify SetupIntent creation
3. Confirm payment method is saved
4. Check subscription creation
5. Verify trial period (Pro plan)

## Next Steps

1. ✅ Frontend payment form integrated
2. ⏳ Set up Stripe account and get API keys
3. ⏳ Create Supabase Edge Functions
4. ⏳ Configure webhooks for subscription events
5. ⏳ Test end-to-end payment flow
6. ⏳ Handle subscription updates/cancellations

## Notes

- Payment form currently validates but doesn't process without backend
- For development, the form will show a message about backend integration
- All payment data is handled securely through Stripe Elements
- PCI compliance is handled by Stripe
