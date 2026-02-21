# Deployment Guide - AI Generation Setup

## Overview
This guide walks you through setting up the AI generation feature using Replicate API and Supabase Edge Functions.

## Prerequisites
- Supabase project with database and storage configured
- Replicate account (free tier available)
- Supabase CLI installed (for local testing)

## Step 1: Get Replicate API Token

1. **Sign up/Login**: Go to https://replicate.com and create an account
2. **Get API Token**:
   - Navigate to Account Settings → API Tokens
   - Click "Create token"
   - Copy the token (starts with `r8_...`)
   - ⚠️ Keep this secret - never commit to git!

## Step 2: Add Secrets to Supabase

### Option A: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Edge Functions** → **Secrets**
3. Click **Add Secret**
4. Add:
   - **Name**: `REPLICATE_API_TOKEN`
   - **Value**: Your Replicate token (e.g., `r8_abc123...`)
5. Click **Save**

### Option B: Via Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Set the secret
supabase secrets set REPLICATE_API_TOKEN=r8_your_token_here
```

## Step 3: Deploy Edge Function

### Option A: Via Supabase Dashboard

1. Go to **Edge Functions** in your Supabase dashboard
2. Click **Create Function**
3. Name it: `generate-renovation`
4. Copy the contents of `supabase/functions/generate-renovation/index.ts`
5. Paste into the editor
6. Click **Deploy**

### Option B: Via Supabase CLI

```bash
# Make sure you're in the project root
cd /path/to/contractor-pro-ai

# Deploy the function
supabase functions deploy generate-renovation
```

## Step 4: Verify Deployment

### Test the Function

You can test the function using curl or Postman:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-renovation \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"projectId": "test-project-id"}'
```

**Note**: Replace:
- `YOUR_PROJECT_REF` with your Supabase project reference
- `YOUR_ANON_KEY` with your Supabase anon key (found in Settings → API)

### Check Logs

1. Go to **Edge Functions** → **generate-renovation** → **Logs**
2. Look for any errors or successful invocations

## Step 5: Test End-to-End

1. **Create a test project** in your app:
   - Upload an image
   - Add a swatch
   - Draw a mask
   - Click "Generate AI Render"

2. **Monitor the process**:
   - Check project status in database (should change: `processing` → `completed`)
   - Check Edge Function logs for any errors
   - Check Replicate dashboard for API usage

## Troubleshooting

### Error: "REPLICATE_API_TOKEN not configured"
- **Solution**: Make sure you added the secret in Supabase Dashboard → Settings → Edge Functions → Secrets
- Verify the secret name is exactly `REPLICATE_API_TOKEN` (case-sensitive)

### Error: "Project not found"
- **Solution**: Verify the `projectId` exists in your `projects` table
- Check that RLS policies allow the service role to read projects

### Error: "Replicate API error"
- **Solution**: 
  - Verify your Replicate token is valid
  - Check Replicate account has credits
  - Review Replicate API status page

### Function times out
- **Solution**: 
  - Edge Functions have a 60-second timeout by default
  - For longer processing, consider:
    - Using Supabase Database webhooks to trigger async processing
    - Breaking up the work into smaller chunks
    - Using Replicate's webhook callbacks

### Images not uploading to Storage
- **Solution**:
  - Verify `project-images` bucket exists
  - Check bucket policies allow uploads
  - Verify service role has storage permissions

## Cost Estimation

### Replicate Costs (per rendering):
- **Inpainting**: ~$0.004 per swatch area
- **Upscaling**: ~$0.002 per image
- **Total**: ~$0.006-0.010 per rendering (varies by number of swatches)

### Supabase Costs:
- **Edge Function invocations**: Included in free tier (500K/month)
- **Storage**: $0.021/GB/month
- **Bandwidth**: $0.09/GB

## Next Steps

1. ✅ Set up Replicate API token
2. ✅ Deploy Edge Function
3. ✅ Test with a sample project
4. ⏳ Monitor costs and usage
5. ⏳ Optimize prompts for better results
6. ⏳ Add retry logic for failed generations
7. ⏳ Set up webhooks for async processing (optional)

## Additional Resources

- [Replicate API Docs](https://replicate.com/docs)
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Stable Diffusion Inpainting Model](https://replicate.com/stability-ai/stable-diffusion-inpainting)
- [Real-ESRGAN Upscaling Model](https://replicate.com/nightmareai/real-esrgan)

## Support

If you encounter issues:
1. Check Edge Function logs in Supabase Dashboard
2. Check Replicate API dashboard for errors
3. Review the error messages in browser console
4. Verify all environment variables are set correctly
