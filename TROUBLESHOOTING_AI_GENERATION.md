# Troubleshooting AI Generation

## Issue: "AI generation started" but no image appears

### Step 1: Check Project Status

1. Go to Supabase Dashboard → Table Editor → `projects`
2. Find your project
3. Check the `status` column:
   - `processing` = Still running (wait 1-2 minutes)
   - `completed` = Should have `generated_image_url` populated
   - `failed` = Something went wrong

### Step 2: Check Edge Function Logs

1. Go to Supabase Dashboard → Edge Functions → `generate-renovation`
2. Click **Logs** tab
3. Look for:
   - ✅ Success messages
   - ❌ Error messages (red)
   - ⏳ Processing messages

### Step 3: Common Issues

#### Issue: Edge Function not deployed
**Solution**: Deploy the function via Dashboard or CLI

#### Issue: REPLICATE_API_TOKEN not set
**Error**: "REPLICATE_API_TOKEN not configured"
**Solution**: 
1. Go to Settings → Edge Functions → Secrets
2. Add `REPLICATE_API_TOKEN` with your Replicate token

#### Issue: Replicate API error
**Error**: "Replicate API error: ..."
**Solution**:
- Check Replicate account has credits
- Verify API token is correct
- Check Replicate status page

#### Issue: Image download failed
**Error**: "Failed to download original image"
**Solution**:
- Verify image URLs are accessible
- Check Supabase Storage bucket permissions
- Ensure images are public

#### Issue: Storage upload failed
**Error**: "Failed to upload result"
**Solution**:
- Check `project-images` bucket exists
- Verify bucket policies allow uploads
- Check service role has storage permissions

### Step 4: Manual Testing

Test the Edge Function directly:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-renovation \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"projectId": "YOUR_PROJECT_ID"}'
```

Replace:
- `YOUR_PROJECT_REF` - Found in Supabase Dashboard → Settings → General
- `YOUR_ANON_KEY` - Found in Supabase Dashboard → Settings → API
- `YOUR_PROJECT_ID` - UUID of your project from `projects` table

### Step 5: Check Real-time Updates

The frontend uses Supabase real-time subscriptions. If updates aren't appearing:

1. Check browser console for WebSocket errors
2. Verify RLS policies allow SELECT on `projects` table
3. Try refreshing the page

### Step 6: Verify Database Schema

Ensure your `projects` table has:
- `status` column (text)
- `generated_image_url` column (text, nullable)
- `mask_url` column (text, nullable)
- `swatch_data` column (jsonb, nullable)

### Step 7: Check Replicate Account

1. Go to https://replicate.com/account
2. Check:
   - Account has credits
   - API token is active
   - No rate limits exceeded

## Quick Fixes

### Refresh Project Status
If status is stuck on `processing`:
1. Check Edge Function logs for errors
2. Manually update status in database if needed
3. Retry generation

### Retry Generation
1. Go back to project editor
2. Click "Generate AI Render" again
3. Check logs for new errors

## Still Not Working?

1. **Check all logs**: Edge Function logs, browser console, Supabase logs
2. **Verify setup**: API tokens, function deployment, database schema
3. **Test manually**: Use curl to test Edge Function directly
4. **Check Replicate**: Verify account status and API access

## Debug Mode

To see more detailed logs, add console.log statements in the Edge Function:

```typescript
console.log('Processing project:', projectId)
console.log('Project data:', JSON.stringify(project, null, 2))
console.log('Replicate token exists:', !!REPLICATE_API_TOKEN)
```

Then check Edge Function logs for these messages.
