# API Keys Setup Guide

## Required API Keys

To enable AI generation, you need to set up the following:

### 1. Replicate API Token (Required for AI Generation)

**How to get it:**
1. Go to https://replicate.com
2. Sign in to your account
3. Go to Account Settings → API Tokens
4. Click "Create token"
5. Copy the token (starts with `r8_...`)

**Where to add it:**
- Supabase Dashboard → Project Settings → Edge Functions → Secrets
- Add secret: `REPLICATE_API_TOKEN` = `r8_your_token_here`

**Or via Supabase CLI:**
```bash
supabase secrets set REPLICATE_API_TOKEN=r8_your_token_here
```

### 2. Supabase Service Role Key (Already have this)

**Where to find it:**
- Supabase Dashboard → Project Settings → API
- Copy the "service_role" key (keep this secret!)

**Where it's used:**
- Already configured in Edge Functions environment
- Used for admin operations in Edge Functions

### 3. Stripe API Keys (For Payment Processing - Optional for now)

**When you're ready for payments:**
- Stripe Dashboard → Developers → API keys
- Publishable key: `pk_test_...` or `pk_live_...`
- Secret key: `sk_test_...` or `sk_live_...`

**Where to add:**
- Frontend `.env.local`: `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...`
- Supabase Secrets: `STRIPE_SECRET_KEY=sk_test_...`

## Environment Variables Summary

### Supabase Edge Function Secrets
Add these in Supabase Dashboard → Settings → Edge Functions → Secrets:

```
REPLICATE_API_TOKEN=r8_your_replicate_token
OPENAI_API_KEY=sk-... (for generate-image)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key (usually auto-set)
```

### Frontend Environment Variables
Add to `.env.local` in project root:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_... (when ready for payments)
VITE_APP_URL=https://app.contractorproai.com (for email links)
```

## Testing the Setup

### Test Replicate Connection

You can test if your Replicate token works by running this in Supabase SQL Editor (or create a test Edge Function):

```typescript
// Test Edge Function: supabase/functions/test-replicate/index.ts
const response = await fetch('https://api.replicate.com/v1/models', {
  headers: { 'Authorization': `Token ${Deno.env.get('REPLICATE_API_TOKEN')}` }
})
const models = await response.json()
console.log('Replicate models:', models)
```

## Security Notes

⚠️ **Never commit API keys to git!**
- Use `.env.local` for frontend (already in `.gitignore`)
- Use Supabase Secrets for Edge Functions
- Never expose service role keys in frontend code

## Next Steps

1. ✅ Get Replicate API token
2. ✅ Add to Supabase Edge Function secrets
3. ✅ Deploy Edge Function
4. ✅ Test AI generation
5. ⏳ Add Stripe keys when ready for payments
