# Required APIs & Keys

## Summary

To enable AI generation, you need **one API key**:

### ✅ Required Now

1. **Replicate API Token** (`r8_...`)
   - **Purpose**: AI inpainting (apply finish to mask), upscaling, and swatch description (LLaVA) if OpenAI not set
   - **Where to get**: https://replicate.com → Account Settings → API Tokens
   - **Where to add**: Supabase Dashboard → Settings → Edge Functions → Secrets
   - **Cost**: Pay-per-run (inpainting, upscale, LLaVA)

### Optional (recommended for best swatch results)

2. **OpenAI API Key** (`sk-...`)
   - **Purpose**: Describes uploaded swatch images so the AI can prompt itself with the most accurate finish description (GPT-4o-mini vision). Without it, Replicate LLaVA is used.
   - **Where to get**: https://platform.openai.com/api-keys
   - **Via CLI**: `supabase secrets set OPENAI_API_KEY=sk-your_key_here`
   - **Cost**: Low (short vision call per swatch)

### ⏳ Required Later (for payments)

2. **Stripe API Keys**
   - **Publishable Key** (`pk_test_...` or `pk_live_...`)
   - **Secret Key** (`sk_test_...` or `sk_live_...`)
   - **Where to get**: https://stripe.com → Developers → API keys
   - **Where to add**: 
     - Publishable: `.env.local` (frontend)
     - Secret: Supabase Edge Function secrets (backend)

### ✅ Already Configured

3. **Supabase Keys** (you already have these)
   - `SUPABASE_URL` - Your project URL
   - `SUPABASE_ANON_KEY` - Public anon key (frontend)
   - `SUPABASE_SERVICE_ROLE_KEY` - Admin key (auto-set in Edge Functions)

## Quick Setup Steps

### 1. Get Replicate Token (5 minutes)

```bash
# 1. Go to https://replicate.com
# 2. Sign up / Login
# 3. Account Settings → API Tokens → Create token
# 4. Copy token (starts with r8_...)
```

### 2. Add to Supabase (2 minutes)

**Via Dashboard:**
1. Supabase Dashboard → Settings → Edge Functions → Secrets
2. Click "Add Secret"
3. Name: `REPLICATE_API_TOKEN`
4. Value: `r8_your_token_here`
5. Save

**Via CLI:**
```bash
supabase secrets set REPLICATE_API_TOKEN=r8_your_token_here
```

### 2b. (Optional) Add OpenAI key via CLI for better swatch descriptions

Get an API key from https://platform.openai.com/api-keys, then set it as an Edge Function secret:

```bash
supabase secrets set OPENAI_API_KEY=sk-your_openai_key_here
```

To set both Replicate and OpenAI in one go:

```bash
supabase secrets set REPLICATE_API_TOKEN=r8_your_token_here OPENAI_API_KEY=sk-your_openai_key_here
```

List current secrets (names only; values are hidden):

```bash
supabase secrets list
```

### 3. Deploy Function (2 minutes)

**Via Dashboard:**
1. Edge Functions → Create Function
2. Name: `generate-renovation`
3. Copy code from `supabase/functions/generate-renovation/index.ts`
4. Deploy

**Via CLI:**
```bash
supabase functions deploy generate-renovation
```

## That's It! 🎉

Once you've added the Replicate token and deployed the function, AI generation will work automatically when users click "Generate AI Render".

## Testing

After setup, test by:
1. Creating a project in your app
2. Uploading an image
3. Adding swatches and drawing masks
4. Clicking "Generate AI Render"
5. Checking Edge Function logs for success/errors

## Cost Tracking

- **Replicate**: Check usage at https://replicate.com/account/usage
- **Supabase**: Check usage in Supabase Dashboard → Settings → Usage

## Need Help?

See `DEPLOYMENT_GUIDE.md` for detailed troubleshooting and setup instructions.
